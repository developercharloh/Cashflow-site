import { Router } from "express";
import { db, usersTable, transactionsTable, notificationsTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { timingSafeEqual } from "node:crypto";
import { hashPassword, comparePassword, signToken, generateReferralCode, generateResetToken } from "../lib/auth";
import { requireAuth, type AuthRequest } from "../middlewares/requireAuth";

const router = Router();
const adminLoginAttempts = new Map<string, { count: number; resetAt: number }>();
const ADMIN_LOGIN_LIMIT = 10;
const ADMIN_LOGIN_WINDOW_MS = 15 * 60 * 1000;

function matchesSecret(provided: string, expected: string): boolean {
  const providedBytes = Buffer.from(provided);
  const expectedBytes = Buffer.from(expected);
  if (providedBytes.length !== expectedBytes.length) {
    timingSafeEqual(expectedBytes, Buffer.alloc(expectedBytes.length));
    return false;
  }
  return timingSafeEqual(providedBytes, expectedBytes);
}

function isAdminLoginRateLimited(ip: string): boolean {
  const now = Date.now();
  const current = adminLoginAttempts.get(ip);
  if (current && current.resetAt > now) {
    current.count += 1;
    return current.count > ADMIN_LOGIN_LIMIT;
  }

  adminLoginAttempts.set(ip, { count: 1, resetAt: now + ADMIN_LOGIN_WINDOW_MS });
  if (adminLoginAttempts.size > 5000) {
    for (const [key, attempt] of adminLoginAttempts) {
      if (attempt.resetAt <= now) adminLoginAttempts.delete(key);
    }
    while (adminLoginAttempts.size > 4000) {
      const firstKey = adminLoginAttempts.keys().next().value;
      if (!firstKey) break;
      adminLoginAttempts.delete(firstKey);
    }
  }
  return false;
}

router.post("/auth/register", async (req, res) => {
  try {
    const { email, password, name, phone, country, referralCode } = req.body;
    if (!email || !password || !name) {
      res.status(400).json({ error: "Name, email, and password are required" });
      return;
    }
    const [existing] = await db.select().from(usersTable).where(eq(usersTable.email, email.toLowerCase()));
    if (existing) {
      res.status(400).json({ error: "Email already registered" });
      return;
    }
    const hashed = await hashPassword(password);
    const code = generateReferralCode();
    const normalizedReferralCode = typeof referralCode === "string" ? referralCode.trim().toUpperCase() : "";

    const user = await db.transaction(async (tx) => {
      const [referrer] = normalizedReferralCode
        ? await tx.select().from(usersTable).where(eq(usersTable.referralCode, normalizedReferralCode)).for("update")
        : [];
      const [createdUser] = await tx.insert(usersTable).values({
        email: email.toLowerCase(),
        password: hashed,
        name,
        phone: phone ?? null,
        country: country ?? null,
        referralCode: code,
        referredBy: referrer?.id ?? null,
        isEmailVerified: true,
        quizCompleted: true,
      }).returning();

      if (referrer) {
        const nextTotalEarned = referrer.totalEarned + 1;
        const level = nextTotalEarned >= 5000 ? 7 : nextTotalEarned >= 2000 ? 6 : nextTotalEarned >= 1000 ? 5 :
          nextTotalEarned >= 500 ? 4 : nextTotalEarned >= 200 ? 3 : nextTotalEarned >= 50 ? 2 : referrer.level;
        await tx.update(usersTable).set({
          balance: sql`${usersTable.balance} + 1`,
          totalEarned: sql`${usersTable.totalEarned} + 1`,
          totalReferralEarnings: sql`${usersTable.totalReferralEarnings} + 1`,
          referralCount: sql`${usersTable.referralCount} + 1`,
          level,
        }).where(eq(usersTable.id, referrer.id));
        await tx.insert(transactionsTable).values({
          userId: referrer.id,
          type: "referral",
          amount: 1,
          status: "completed",
          description: `Referral reward for ${name}'s signup`,
        });
        await tx.insert(notificationsTable).values({
          userId: referrer.id,
          type: "referral_reward",
          title: "Referral reward added",
          message: `$1.00 was added to your wallet for a new signup.`,
        });
      }

      return createdUser;
    });

    const token = signToken({ userId: user.id, isAdmin: user.isAdmin });
    res.status(201).json({
      user: sanitizeUser(user),
      token,
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      res.status(400).json({ error: "Email and password are required" });
      return;
    }
    const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email.toLowerCase()));
    if (!user) {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }
    if (user.isBanned) {
      res.status(401).json({ error: "Account is banned" });
      return;
    }
    const valid = await comparePassword(password, user.password);
    if (!valid) {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }
    const token = signToken({ userId: user.id, isAdmin: user.isAdmin });
    res.json({ user: sanitizeUser(user), token });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/auth/admin-login", async (req, res) => {
  try {
    if (isAdminLoginRateLimited(req.ip || req.socket.remoteAddress || "unknown")) {
      res.status(429).json({ error: "Too many login attempts. Try again later." });
      return;
    }

    const { username, password } = req.body as { username?: unknown; password?: unknown };
    const configuredUsername = process.env.LIPWA_ADMIN_USERNAME?.trim();
    const configuredPassword = process.env.LIPWA_ADMIN_PASSWORD;
    if (!configuredUsername || !configuredPassword) {
      res.status(503).json({ error: "Admin login is not configured." });
      return;
    }
    if (typeof username !== "string" || typeof password !== "string" ||
        username.length > 100 || password.length > 1024) {
      res.status(401).json({ error: "Invalid credentials." });
      return;
    }

    const usernameMatches = matchesSecret(
      username.trim().toLocaleLowerCase("en-US"),
      configuredUsername.toLocaleLowerCase("en-US"),
    );
    const passwordMatches = matchesSecret(password, configuredPassword);
    if (!usernameMatches || !passwordMatches) {
      res.status(401).json({ error: "Invalid credentials." });
      return;
    }

    const adminAccounts = await db.select({
      id: usersTable.id,
      name: usersTable.name,
      email: usersTable.email,
      isAdmin: usersTable.isAdmin,
      isBanned: usersTable.isBanned,
    }).from(usersTable).where(eq(usersTable.isAdmin, true)).limit(20);
    const admin = adminAccounts.find((account) => !account.isBanned);
    if (!admin) {
      res.status(503).json({ error: "No active administrator account is available." });
      return;
    }

    const token = signToken({ userId: admin.id, isAdmin: true });
    res.json({
      user: { id: admin.id, name: admin.name, email: admin.email, isAdmin: true },
      token,
    });
  } catch (err) {
    req.log.error(err, "Admin login failed");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/auth/logout", (req, res) => {
  res.json({ message: "Logged out successfully" });
});

router.get("/auth/me", requireAuth, async (req: AuthRequest, res) => {
  try {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.userId!));
    if (!user) {
      res.status(401).json({ error: "User not found" });
      return;
    }
    res.json(sanitizeUser(user));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

const resetAttempts = new Map<string, { count: number; resetAt: number }>();
const RESET_MAX_ATTEMPTS = 5;
const RESET_WINDOW_MS = 15 * 60 * 1000;

function checkResetRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = resetAttempts.get(ip);
  if (!entry || now > entry.resetAt) {
    resetAttempts.set(ip, { count: 1, resetAt: now + RESET_WINDOW_MS });
    return true;
  }
  if (entry.count >= RESET_MAX_ATTEMPTS) {
    return false;
  }
  entry.count += 1;
  return true;
}

router.post("/auth/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;
    const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email?.toLowerCase()));
    if (user) {
      const token = generateResetToken();
      const expires = new Date(Date.now() + 3600000);
      await db.update(usersTable).set({ resetPasswordToken: token, resetPasswordExpires: expires }).where(eq(usersTable.id, user.id));
    }
    res.json({ message: "If the email exists, a reset link has been sent" });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/auth/reset-password", async (req, res) => {
  try {
    const ip = (req.headers["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim() ?? req.socket.remoteAddress ?? "unknown";
    if (!checkResetRateLimit(ip)) {
      res.status(429).json({ error: "Too many reset attempts. Please try again later." });
      return;
    }
    const { token, email, password } = req.body;
    if (!token || !email || !password) {
      res.status(400).json({ error: "Token, email, and new password are required" });
      return;
    }
    const [user] = await db.select().from(usersTable).where(eq(usersTable.email, (email as string).toLowerCase()));
    if (
      !user ||
      !user.resetPasswordToken ||
      !user.resetPasswordExpires ||
      user.resetPasswordExpires < new Date() ||
      user.resetPasswordToken !== token
    ) {
      res.status(400).json({ error: "Invalid or expired reset token" });
      return;
    }
    const hashed = await hashPassword(password);
    await db.update(usersTable).set({ password: hashed, resetPasswordToken: null, resetPasswordExpires: null }).where(eq(usersTable.id, user.id));
    res.json({ message: "Password reset successfully" });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/auth/verify-email", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { code } = req.body;
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.userId!));
    if (!user) {
      res.status(400).json({ error: "User not found" });
      return;
    }
    if (user.isEmailVerified) {
      res.json({ message: "Email already verified" });
      return;
    }
    if (user.emailVerifyCode !== code) {
      res.status(400).json({ error: "Invalid verification code" });
      return;
    }
    await db.update(usersTable).set({ isEmailVerified: true, emailVerifyCode: null }).where(eq(usersTable.id, user.id));
    res.json({ message: "Email verified successfully" });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/auth/claim-welcome-gift", requireAuth, async (req: AuthRequest, res) => {
  try {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.userId!));
    if (!user) {
      res.status(401).json({ error: "User not found" });
      return;
    }
    if (user.welcomeGiftClaimed) {
      res.status(400).json({ error: "Starter Gift Card already claimed" });
      return;
    }
    await db.update(usersTable).set({
      welcomeGiftClaimed: true,
      balance: user.balance + 0.10,
      totalEarned: user.totalEarned + 0.10,
      totalBonusEarnings: user.totalBonusEarnings + 0.10,
    }).where(eq(usersTable.id, user.id));
    await db.insert(transactionsTable).values({
      userId: user.id,
      type: "bonus",
      amount: 0.10,
      status: "completed",
      description: "Starter Gift Card",
    });
    res.json({ message: "Starter Gift Card claimed! $0.10 added to your balance." });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

function sanitizeUser(user: typeof usersTable.$inferSelect) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    phone: user.phone,
    avatar: user.avatar,
    level: user.level,
    levelName: getLevelName(user.level),
    balance: user.balance,
    totalEarned: user.totalEarned,
    pendingEarnings: user.pendingEarnings,
    totalWithdrawn: user.totalWithdrawn,
    referralCode: user.referralCode,
    referralCount: user.referralCount,
    tasksCompleted: user.tasksCompleted,
    isEmailVerified: user.isEmailVerified,
    isAdmin: user.isAdmin,
    quizCompleted: user.quizCompleted,
    welcomeGiftClaimed: user.welcomeGiftClaimed,
    isBanned: user.isBanned,
    transcriptionMinutes: user.transcriptionMinutes,
    membershipPurchased: user.membershipPurchased,
    createdAt: user.createdAt.toISOString(),
  };
}

export function getLevelName(level: number): string {
  const names: Record<number, string> = {
    1: "🚀 Starter",
    2: "🥉 Bronze",
    3: "🥈 Silver",
    4: "🥇 Gold",
    5: "🔷 Platinum",
    6: "💎 Diamond",
    7: "👑 Elite",
  };
  return names[level] ?? "🚀 Starter";
}

export default router;
