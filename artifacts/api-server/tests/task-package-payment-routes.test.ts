import express, { type Express } from "express";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "pino-http";
import payheroRouter from "../src/routes/payhero";

const nativeFetch = globalThis.fetch;

const mocks = vi.hoisted(() => ({
  selectResults: [] as unknown[][],
  select: vi.fn(),
  transaction: vi.fn(),
  update: vi.fn(),
  insert: vi.fn(),
  verifyToken: vi.fn(),
  userUpdateValues: undefined as Record<string, unknown> | undefined,
  notificationValues: undefined as Record<string, unknown> | undefined,
  transactionValues: undefined as Record<string, unknown> | undefined,
  claimed: true,
  warn: vi.fn(),
  usersTable: { id: "users.id" },
  transactionsTable: {
    id: "transactions.id",
    userId: "transactions.userId",
    type: "transactions.type",
    status: "transactions.status",
    method: "transactions.method",
  },
  notificationsTable: { id: "notifications.id" },
}));

vi.mock("@workspace/db", () => ({
  db: {
    select: mocks.select,
    transaction: mocks.transaction,
    update: mocks.update,
    insert: mocks.insert,
  },
  usersTable: mocks.usersTable,
  transactionsTable: mocks.transactionsTable,
  notificationsTable: mocks.notificationsTable,
}));

vi.mock("drizzle-orm", () => ({
  and: vi.fn((...conditions: unknown[]) => conditions),
  eq: vi.fn((column: unknown, value: unknown) => ({ column, value })),
  inArray: vi.fn((column: unknown, values: unknown[]) => ({ column, values })),
  sql: vi.fn(),
}));

vi.mock("../src/lib/auth", () => ({
  verifyToken: mocks.verifyToken,
}));

function queryFor(results: unknown[]) {
  let query: Record<string, any>;
  query = {
    from: vi.fn(() => query),
    where: vi.fn(() => query),
    orderBy: vi.fn(() => query),
    limit: vi.fn(async () => results),
    for: vi.fn(async () => results),
    then: (resolve: (value: unknown[]) => unknown, reject?: (reason: unknown) => unknown) =>
      Promise.resolve(results).then(resolve, reject),
  };
  return query;
}

function activationTransactionDb(user: Record<string, unknown>) {
  const userQuery = queryFor([user]);
  const transactionUpdate = {
    set: vi.fn(() => transactionUpdate),
    where: vi.fn(() => ({
      returning: vi.fn(async () => mocks.claimed ? [{ id: 44 }] : []),
    })),
  };
  const userUpdate = {
    set: vi.fn((values: Record<string, unknown>) => {
      mocks.userUpdateValues = values;
      return userUpdate;
    }),
    where: vi.fn(async () => undefined),
  };
  const notificationInsert = {
    values: vi.fn(async (values: Record<string, unknown>) => {
      mocks.notificationValues = values;
      return undefined;
    }),
  };
  return {
    select: vi.fn(() => userQuery),
    update: vi.fn((table: { id?: string }) => table?.id === mocks.usersTable.id ? userUpdate : transactionUpdate),
    insert: vi.fn(() => notificationInsert),
  };
}

function createApp(): Express {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    Object.assign(req, { log: { error: vi.fn(), warn: mocks.warn } });
    next();
  });
  app.use("/api", payheroRouter);
  return app;
}

async function request(
  app: Express,
  url: string,
  options: { method?: string; token?: string; body?: unknown } = {},
) {
  const server = app.listen(0);
  try {
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Test server did not bind.");
    return await nativeFetch(`http://127.0.0.1:${address.port}${url}`, {
      method: options.method ?? "GET",
      headers: {
        ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
        ...(options.body === undefined ? {} : { "Content-Type": "application/json" }),
      },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
}

const worker = {
  id: 7,
  isAdmin: false,
  isBanned: false,
  name: "Test Worker",
  email: "worker@example.invalid",
  taskPackage: "free",
  balance: 0,
};

beforeEach(() => {
  mocks.selectResults.length = 0;
  mocks.userUpdateValues = undefined;
  mocks.notificationValues = undefined;
  mocks.transactionValues = undefined;
  mocks.claimed = true;
  mocks.warn.mockClear();
  mocks.verifyToken.mockImplementation((token: string) => token === "worker" ? { userId: 7, isAdmin: false } : null);
  mocks.select.mockImplementation(() => queryFor(mocks.selectResults.shift() ?? []));
  mocks.transaction.mockImplementation(async (callback: (tx: unknown) => unknown) => callback({
    select: vi.fn()
      .mockReturnValueOnce(queryFor([worker]))
      .mockReturnValueOnce(queryFor([])),
    insert: vi.fn(() => ({
      values: vi.fn((values: Record<string, unknown>) => {
        mocks.transactionValues = values;
        return {
          returning: async () => [{
            id: 44,
            ...values,
          }],
        };
      }),
    })),
  }));
  mocks.update.mockImplementation(() => ({
    set: vi.fn((values: Record<string, unknown>) => {
      mocks.transactionValues = { ...mocks.transactionValues, ...values };
      return { where: vi.fn(async () => undefined) };
    }),
  }));
  mocks.insert.mockImplementation(() => ({
    values: vi.fn(async (values: Record<string, unknown>) => {
      mocks.notificationValues = values;
      return undefined;
    }),
  }));
  process.env.PAYHERO_AUTH_TOKEN = "test-token";
  process.env.PAYHERO_CHANNEL_ID = "123";
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    if (String(input).startsWith("http://127.0.0.1:")) return nativeFetch(input, init);
    if (init?.method === "POST") {
      return new Response(JSON.stringify({ success: true, reference: "provider-ref-1" }), { status: 200 });
    }
    return new Response(JSON.stringify({ success: true, status: "SUCCESS", reference: "provider-ref-1" }), { status: 200 });
  }));
});

afterEach(() => {
  delete process.env.PAYHERO_AUTH_TOKEN;
  delete process.env.PAYHERO_CHANNEL_ID;
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("direct M-Pesa package payments", () => {
  it("starts a package STK payment for an empty wallet without crediting the wallet", async () => {
    mocks.selectResults.push([worker]);
    const response = await request(createApp(), "/api/task-packages/purchase/mpesa", {
      method: "POST",
      token: "worker",
      body: { package: "silver", phone: "0712345678" },
    });
    const body = await response.json();
    const sentRequest = vi.mocked(fetch).mock.calls.find(([input]) =>
      String(input).includes("backend.payhero.co.ke"),
    );
    const paymentRequest = JSON.parse(String(sentRequest?.[1]?.body));

    expect(response.status).toBe(200);
    expect(body).toMatchObject({ status: "pending", package: "silver", chargeUsd: 7.69, amountKes: 1000 });
    expect(paymentRequest).toMatchObject({ amount: 1000, phone_number: "0712345678", provider: "m-pesa" });
    expect(paymentRequest.external_reference).toMatch(/^lp_7_[0-9a-f-]{36}$/i);
    expect(mocks.transactionValues).toMatchObject({
      type: "package_purchase",
      amount: -7.69,
      status: "pending",
      method: "mpesa",
    });
    expect(mocks.transactionValues).not.toHaveProperty("balance");
    expect(mocks.userUpdateValues).toBeUndefined();
  });

  it("logs safe PayHero rejection details without blaming the phone number", async () => {
    mocks.selectResults.push([worker]);
    vi.mocked(fetch).mockImplementation(async (input, init) => {
      if (String(input).startsWith("http://127.0.0.1:")) return nativeFetch(input, init);
      return new Response(JSON.stringify({
        success: false,
        error_code: "INVALID_AMOUNT",
        message: "Amount rejected for 0712345678",
      }), { status: 400 });
    });

    const response = await request(createApp(), "/api/task-packages/purchase/mpesa", {
      method: "POST",
      token: "worker",
      body: { package: "silver", phone: "0712345678" },
    });
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("We couldn't start the package payment prompt. Please try again shortly.");
    expect(mocks.warn).toHaveBeenCalledWith({
      status: 400,
      provider: { code: "INVALID_AMOUNT", message: "Amount rejected for [phone]" },
    }, "M-Pesa package payment request was rejected");
  });

  it("activates the selected package after provider status confirms payment", async () => {
    const transaction = {
      id: 44,
      userId: 7,
      type: "package_purchase",
      amount: -7.69,
      status: "pending",
      method: "mpesa",
      accountDetails: JSON.stringify({
        externalReference: "pkg_7_test-ref",
        providerReference: "provider-ref-1",
        packageCode: "silver",
        expectedKes: 1000,
      }),
    };
    mocks.selectResults.push([worker], [transaction]);
    mocks.transaction.mockImplementation(async (callback: (tx: unknown) => unknown) =>
      callback(activationTransactionDb(worker)),
    );

    const response = await request(
      createApp(),
      "/api/task-packages/purchase/mpesa/pkg_7_test-ref/status",
      { token: "worker" },
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({ status: "completed", package: "silver" });
    expect(mocks.userUpdateValues).toMatchObject({ taskPackage: "silver" });
    expect(mocks.userUpdateValues).not.toHaveProperty("balance");
    expect(mocks.notificationValues).toMatchObject({ type: "package_purchased", userId: 7 });
  });

  it("does not activate package access from a failed payment", async () => {
    const transaction = {
      id: 44,
      userId: 7,
      type: "package_purchase",
      amount: -7.69,
      status: "pending",
      method: "mpesa",
      accountDetails: JSON.stringify({
        externalReference: "pkg_7_test-ref",
        providerReference: "provider-ref-1",
        packageCode: "silver",
        expectedKes: 1000,
      }),
    };
    mocks.selectResults.push([worker], [transaction]);
    vi.stubGlobal("fetch", vi.fn(async () =>
      new Response(JSON.stringify({ success: true, status: "FAILED", reference: "provider-ref-1" }), { status: 200 }),
    ));

    const response = await request(
      createApp(),
      "/api/task-packages/purchase/mpesa/pkg_7_test-ref/status",
      { token: "worker" },
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.status, JSON.stringify(body)).toBe("rejected");
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("activates access from a verified PayHero callback with the exact amount", async () => {
    const transaction = {
      id: 44,
      userId: 7,
      type: "package_purchase",
      amount: -7.69,
      status: "pending",
      method: "mpesa",
      accountDetails: JSON.stringify({
        externalReference: "pkg_7_test-ref",
        providerReference: "provider-ref-1",
        packageCode: "silver",
        expectedKes: 1000,
      }),
    };
    mocks.selectResults.push([transaction]);
    mocks.transaction.mockImplementation(async (callback: (tx: unknown) => unknown) =>
      callback(activationTransactionDb(worker)),
    );

    const response = await request(createApp(), "/api/payhero/webhook", {
      method: "POST",
      body: {
        status: true,
        response: {
          ExternalReference: "pkg_7_test-ref",
          CheckoutRequestID: "provider-ref-1",
          Amount: 1000,
          ResultCode: 0,
          Status: "Success",
        },
      },
    });

    expect(response.status).toBe(200);
    expect(mocks.userUpdateValues).toMatchObject({ taskPackage: "silver" });
    expect(mocks.userUpdateValues).not.toHaveProperty("balance");
  });

  it("rejects a callback with the wrong amount instead of granting package access", async () => {
    const transaction = {
      id: 44,
      userId: 7,
      type: "package_purchase",
      amount: -7.69,
      status: "pending",
      method: "mpesa",
      accountDetails: JSON.stringify({
        externalReference: "pkg_7_test-ref",
        providerReference: "provider-ref-1",
        packageCode: "silver",
        expectedKes: 1000,
      }),
    };
    mocks.selectResults.push([transaction]);

    const response = await request(createApp(), "/api/payhero/webhook", {
      method: "POST",
      body: {
        status: true,
        response: {
          ExternalReference: "pkg_7_test-ref",
          CheckoutRequestID: "provider-ref-1",
          Amount: 999,
          ResultCode: 0,
          Status: "Success",
        },
      },
    });

    expect(response.status).toBe(200);
    expect(mocks.transaction).not.toHaveBeenCalled();
    expect(mocks.transactionValues).toMatchObject({
      status: "rejected",
      rejectionReason: "Payment amount did not match the requested amount. Contact support.",
    });
  });
});
