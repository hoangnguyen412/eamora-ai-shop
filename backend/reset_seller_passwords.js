/**
 * reset_seller_passwords.js
 *
 * One-time script to reset the 4 seller users created by migrate_multi_vendor.py
 * so they can log in with password "123456".
 *
 * Prerequisites:
 *   - DATABASE_URL must be set in the environment (or in backend/.env)
 *   - Run from the backend directory:  node reset_seller_passwords.js
 *
 * What it does:
 *   1. Finds all Users with email ending in "@e-amora.test" AND role = "seller"
 *   2. Hashes "123456" with bcrypt (10 salt rounds) — same as the backend login flow
 *   3. Updates passwordHash for each matched user
 *   4. Prints a confirmation summary
 */

require("dotenv").config();
const { PrismaClient } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");
const bcrypt = require("bcryptjs");

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("LỖI: DATABASE_URL chưa được cấu hình trong môi trường.");
  console.error("Hãy set DATABASE_URL rồi chạy lại script.");
  process.exit(1);
}

const adapter = new PrismaPg({ connectionString: DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const PLAIN_PASSWORD = "123456";
const SALT_ROUNDS = 10;

async function main() {
  let hash;
  try {
    hash = await bcrypt.hash(PLAIN_PASSWORD, SALT_ROUNDS);
  } catch (err) {
    console.error("Lỗi khi băm mật khẩu:", err);
    process.exit(1);
  }

  // 1. Tìm 4 seller users có email kết thúc bằng @e-amora.test
  const sellers = await prisma.user.findMany({
    where: {
      role: "seller",
      email: { endsWith: "@e-amora.test" },
    },
    select: { id: true, email: true, role: true },
  });

  if (sellers.length === 0) {
    console.log("Không tìm thấy user seller nào có email @e-amora.test.");
    await prisma.$disconnect();
    return;
  }

  console.log(`Tìm thấy ${sellers.length} seller user:`);
  sellers.forEach((u) => console.log(`  - ${u.email} (id=${u.id})`));

  // 2. Cập nhật passwordHash cho mỗi user
  const results = await Promise.all(
    sellers.map((u) =>
      prisma.user.update({
        where: { id: u.id },
        data: { passwordHash: hash },
        select: { id: true, email: true },
      })
    )
  );

  console.log("\n✅ Đã cập nhật mật khẩu cho:");
  results.forEach((u) => console.log(`  - ${u.email} (id=${u.id})`));
  console.log(`\nMật khẩu mới cho tất cả: "${PLAIN_PASSWORD}"`);
  console.log("Bạn hiện có thể đăng nhập vào Seller Dashboard với email/mật khẩu trên.");

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("Lỗi chạy script:", err);
  process.exit(1);
});
