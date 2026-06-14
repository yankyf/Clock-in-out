/**
 * Seeds the initial OWNER account and default category rates ($33 Work,
 * $8 Babysitter — the values from the sheet). Idempotent: safe to re-run.
 *
 *   npm run seed -w @clock/server
 */
import bcrypt from "bcryptjs";
import { prisma } from "./db.js";

async function main() {
  const email = (process.env.SEED_OWNER_EMAIL ?? "owner@example.com").toLowerCase();
  const password = process.env.SEED_OWNER_PASSWORD ?? "changeme123";
  const name = process.env.SEED_OWNER_NAME ?? "Owner";

  const passwordHash = await bcrypt.hash(password, 10);

  const user = await prisma.user.upsert({
    where: { email },
    update: {},
    create: { email, name, role: "OWNER", passwordHash },
  });

  // Default rates from the sheet (cells I8 / L8).
  for (const [category, ratePerHour] of [["WORK", 33], ["BABYSITTER", 8]] as const) {
    await prisma.rate.upsert({
      where: { userId_category: { userId: user.id, category } },
      update: {},
      create: { userId: user.id, category, ratePerHour },
    });
  }

  console.log(`Seeded OWNER ${email} (password: ${password === "changeme123" ? "changeme123 — CHANGE IT" : "from env"})`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
