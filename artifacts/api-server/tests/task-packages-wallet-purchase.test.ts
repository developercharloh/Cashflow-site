import express, { type Express } from "express";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "pino-http";
import taskPackagesRouter from "../src/routes/task-packages";

const nativeFetch = globalThis.fetch;

const mocks = vi.hoisted(() => ({
  user: {
    id: 7,
    isAdmin: false,
    isBanned: false,
    taskPackage: "free",
    taskPackagePurchasedAt: null as Date | null,
    balance: 3,
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  },
  userUpdateValues: undefined as Record<string, unknown> | undefined,
  transactionValues: undefined as Record<string, unknown> | undefined,
  notificationValues: undefined as Record<string, unknown> | undefined,
  transaction: vi.fn(),
  verifyToken: vi.fn(),
}));

vi.mock("@workspace/db", () => ({
  db: {
    select: vi.fn(() => {
      const query: Record<string, any> = {
        from: vi.fn(() => query),
        where: vi.fn(() => query),
        then: (resolve: (value: unknown[]) => unknown, reject?: (reason: unknown) => unknown) =>
          Promise.resolve([mocks.user]).then(resolve, reject),
      };
      return query;
    }),
    transaction: mocks.transaction,
  },
  notificationsTable: { id: "notifications.id" },
  transactionsTable: { id: "transactions.id" },
  usersTable: { id: "users.id" },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((column: unknown, value: unknown) => ({ column, value })),
}));

vi.mock("../src/lib/auth", () => ({
  verifyToken: mocks.verifyToken,
}));

function makeTransactionDb() {
  const userQuery: Record<string, any> = {
    from: vi.fn(() => userQuery),
    where: vi.fn(() => userQuery),
    for: vi.fn(async () => [mocks.user]),
  };
  const userUpdate = {
    set: vi.fn((values: Record<string, unknown>) => {
      mocks.userUpdateValues = values;
      return {
        where: vi.fn(() => ({
          returning: vi.fn(async () => [{ ...mocks.user, ...values }]),
        })),
      };
    }),
  };
  const insert = {
    values: vi.fn(async (values: Record<string, unknown>) => {
      if (values.type === "package_purchase") mocks.transactionValues = values;
      else mocks.notificationValues = values;
    }),
  };
  return {
    select: vi.fn(() => userQuery),
    update: vi.fn(() => userUpdate),
    insert: vi.fn(() => insert),
  };
}

function createApp(): Express {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    Object.assign(req, { log: { error: vi.fn() } });
    next();
  });
  app.use("/api", taskPackagesRouter);
  return app;
}

async function postPurchase(packageCode: "silver" | "diamond") {
  const app = createApp();
  const server = app.listen(0);
  try {
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Test server did not bind.");
    return await nativeFetch(`http://127.0.0.1:${address.port}/api/task-packages/purchase`, {
      method: "POST",
      headers: {
        Authorization: "Bearer worker",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ package: packageCode }),
    });
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
}

beforeEach(() => {
  mocks.user = {
    id: 7,
    isAdmin: false,
    isBanned: false,
    taskPackage: "free",
    taskPackagePurchasedAt: null,
    balance: 3,
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  };
  mocks.userUpdateValues = undefined;
  mocks.transactionValues = undefined;
  mocks.notificationValues = undefined;
  mocks.verifyToken.mockImplementation((token: string) =>
    token === "worker" ? { userId: 7, isAdmin: false } : null,
  );
  mocks.transaction.mockImplementation(async (callback: (tx: unknown) => unknown) =>
    callback(makeTransactionDb()),
  );
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("wallet-funded task package purchases", () => {
  it("returns the exact shortfall without charging an insufficient wallet", async () => {
    const response = await postPurchase("silver");

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({
      error: "Your wallet balance is not enough for this package.",
      code: "insufficient_balance",
      walletBalance: 3,
      requiredAmount: 7.69,
      shortfall: 4.69,
    });
    expect(mocks.userUpdateValues).toBeUndefined();
    expect(mocks.transactionValues).toBeUndefined();
    expect(mocks.notificationValues).toBeUndefined();
  });

  it("deducts the package charge from the wallet and activates the package", async () => {
    mocks.user.balance = 10;

    const response = await postPurchase("silver");

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      currentPackage: "silver",
      walletBalance: 2.31,
    });
    expect(mocks.userUpdateValues).toMatchObject({
      balance: 2.31,
      taskPackage: "silver",
    });
    expect(mocks.transactionValues).toMatchObject({
      type: "package_purchase",
      amount: -7.69,
      status: "completed",
    });
    expect(mocks.notificationValues).toMatchObject({
      type: "package_purchased",
      title: "Silver package active",
    });
  });
});
