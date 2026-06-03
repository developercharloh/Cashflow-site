import app from "./app";
import { logger } from "./lib/logger";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";

async function ensureAdminCredentials() {
  try {
    const hash = await bcrypt.hash("Charloz!1999", 10);
    const targetEmail = "ckyalo011@gmail.com";

    // Try to promote the user with this email (may already exist as regular user)
    const promoted = await db.update(usersTable)
      .set({ password: hash, isAdmin: true, name: "Charles Kyalo" })
      .where(eq(usersTable.email, targetEmail))
      .returning({ id: usersTable.id });

    if (promoted.length === 0) {
      // Email not found — rename the existing admin account
      await db.update(usersTable)
        .set({ email: targetEmail, password: hash, name: "Charles Kyalo" })
        .where(eq(usersTable.isAdmin, true));
    }

    logger.info("Admin credentials synced");
  } catch (err) {
    logger.warn({ err }, "Admin credential sync skipped");
  }
}

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

ensureAdminCredentials().then(() => {
  app.listen(port, (err) => {
    if (err) {
      logger.error({ err }, "Error listening on port");
      process.exit(1);
    }
    logger.info({ port }, "Server listening");
  });
});
