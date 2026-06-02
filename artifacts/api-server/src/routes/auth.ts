import { Router } from "express";
import { db, usersTable, transactionsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { hashPassword, comparePassword, signToken, generateReferralCode, generateOTP } from "../lib/auth";
import { requireAuth, type AuthRequest } from "../middlewares/requireAuth";

const router = Router();

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
    const otp = generateOTP();

    let referredById: number | undefined;
    if (referralCode) {
      const [referrer] = await db.select().from(usersTable).where(eq(usersTable.referralCode, referralCode.toUpperCase()));
      if (referrer) {
        referredById = referrer.id;
        await db.update(usersTable).set({ referralCount: referrer.referralCount + 1 }).where(eq(usersTable.id, referrer.id));
        await db.update(usersTable).set({
          balance: referrer.balance + 1.0,
          totalReferralEarnings: referrer.totalReferralEarnings + 1.0,
          totalEarned: referrer.totalEarned + 1.0,
        }).where(eq(usersTable.id, referrer.id));
      }
    }

    const [user] = await db.insert(usersTable).values({
      email: email.toLowerCase(),
      password: hashed,
      name,
      phone: phone ?? null,
      country: country ?? null,
      referralCode: code,
      referredBy: referredById ?? null,
      isEmailVerified: true,
      quizCompleted: true,
      balance: 0.10,
      totalEarned: 0.10,
    }).returning();

    await db.insert(transactionsTable).values({
      userId: user.id,
      type: "bonus",
      amount: 0.10,
      status: "completed",
      description: "Welcome bonus",
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

router.post("/auth/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;
    const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email?.toLowerCase()));
    if (user) {
      const token = generateOTP();
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
    const { token, password } = req.body;
    const [user] = await db.select().from(usersTable).where(eq(usersTable.resetPasswordToken, token));
    if (!user || !user.resetPasswordExpires || user.resetPasswordExpires < new Date()) {
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
    pendingEarnings: user.pendingEarnings,
    totalWithdrawn: user.totalWithdrawn,
    referralCode: user.referralCode,
    referralCount: user.referralCount,
    tasksCompleted: user.tasksCompleted,
    isEmailVerified: user.isEmailVerified,
    isAdmin: user.isAdmin,
    quizCompleted: user.quizCompleted,
    isBanned: user.isBanned,
    transcriptionMinutes: user.transcriptionMinutes,
    membershipPurchased: user.membershipPurchased,
    createdAt: user.createdAt.toISOString(),
  };
}

export function getLevelName(level: number): string {
  const names: Record<number, string> = { 1: "Explorer", 2: "Builder", 3: "Professional", 4: "Elite" };
  return names[level] ?? "Explorer";
}

export default router;
