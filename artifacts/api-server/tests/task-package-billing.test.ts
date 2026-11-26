import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  transaction: vi.fn(),
  claimedPayment: true,
  user: {
    id: 7,
    taskPackage: "free",
    balance: 0,
  },
  userUpdateValues: undefined as Record<string, unknown> | undefined,
  notificationValues: undefined as Record<string, unknown> | undefined,
}));

vi.mock("@workspace/db", () => ({
  db: { transaction: mocks.transaction },
  notificationsTable: { id: "notifications.id" },
  transactionsTable: { id: "transactions.id", userId: "transactions.user_id", type: "transactions.type", status: "transactions.status" },
  usersTable: { id: "users.id" },
}));

vi.mock("drizzle-orm", () => ({
  and: vi.fn((...conditions: unknown[]) => conditions),
  eq: vi.fn((column: unknown, value: unknown) => ({ column, value })),
}));

import {
  activateTaskPackageAfterPayment,
  calculateTaskPackageCharge,
} from "../src/lib/task-package-billing";

function makeTransactionDb() {
  const userQuery = {
    from: vi.fn(() => userQuery),
    where: vi.fn(() => userQuery),
    for: vi.fn(async () => [mocks.user]),
  };
  const transactionUpdate = {
    set: vi.fn(() => transactionUpdate),
    where: vi.fn(() => ({
      returning: vi.fn(async () => mocks.claimedPayment ? [{ id: 44 }] : []),
    })),
  };
  const userUpdate = {
    set: vi.fn((values: Record<string, unknown>) => {
      mocks.userUpdateValues = values;
      return userUpdate;
    }),
    where: vi.fn(async () => undefined),
  };
  const insert = {
    values: vi.fn(async (values: Record<string, unknown>) => {
      mocks.notificationValues = values;
      return undefined;
    }),
  };
  return {
    select: vi.fn(() => userQuery),
    update: vi.fn((table: { id?: string }) => table?.id === "users.id" ? userUpdate : transactionUpdate),
    insert: vi.fn(() => insert),
  };
}

beforeEach(() => {
  mocks.claimedPayment = true;
  mocks.user = { id: 7, taskPackage: "free", balance: 0 };
  mocks.userUpdateValues = undefined;
  mocks.notificationValues = undefined;
  mocks.transaction.mockImplementation(async (callback: (tx: unknown) => unknown) =>
    callback(makeTransactionDb()),
  );
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("direct M-Pesa task package billing", () => {
  it.each([
    ["free", "silver", 7.69, 1000],
    ["free", "diamond", 19.23, 2500],
    ["silver", "diamond", 11.54, 1500],
    ["legacy", "diamond", 11.54, 1500],
  ] as const)("charges the correct direct payment for %s → %s", (current, target, chargeUsd, amountKes) => {
    expect(calculateTaskPackageCharge(current, target)).toEqual({ chargeUsd, amountKes });
  });

  it.each([
    ["silver", "silver"],
    ["diamond", "silver"],
    ["diamond", "diamond"],
    ["legacy", "silver"],
  ] as const)("does not charge when %s already includes %s access", (current, target) => {
    expect(calculateTaskPackageCharge(current, target)).toHaveProperty("error");
  });

  it("activates a package after settlement without changing wallet balance", async () => {
    const activated = await activateTaskPackageAfterPayment(44, 7, "silver");

    expect(activated).toBe(true);
    expect(mocks.userUpdateValues).toMatchObject({ taskPackage: "silver" });
    expect(mocks.userUpdateValues).not.toHaveProperty("balance");
    expect(mocks.notificationValues).toMatchObject({
      userId: 7,
      type: "package_purchased",
      title: "Silver package active",
    });
  });

  it("does not activate a package twice for an already settled payment", async () => {
    mocks.claimedPayment = false;

    const activated = await activateTaskPackageAfterPayment(44, 7, "silver");

    expect(activated).toBe(false);
    expect(mocks.userUpdateValues).toBeUndefined();
    expect(mocks.notificationValues).toBeUndefined();
  });

  it("does not downgrade a package if a higher tier is already active", async () => {
    mocks.user = { id: 7, taskPackage: "diamond", balance: 0 };

    const activated = await activateTaskPackageAfterPayment(44, 7, "silver");

    expect(activated).toBe(true);
    expect(mocks.userUpdateValues).toBeUndefined();
    expect(mocks.notificationValues).toBeUndefined();
  });
});
