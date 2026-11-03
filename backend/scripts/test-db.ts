import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import "dotenv/config";

const connectionString = process.env.DATABASE_URL as string;
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

async function main() {
  try {
    // Test 1: Check if pg_trgm / similarity works
    console.log('=== Test 1: pg_trgm similarity ===');
    const result = await prisma.$queryRaw<{ count: string }[]>`
      SELECT count(*) AS count FROM "Product" WHERE similarity("name", immutable_unaccent('iphon')) > 0.1;
    `;
    console.log('Result:', result);

    // Test 2: Check if immutable_unaccent exists
    console.log('=== Test 2: immutable_unaccent function exists ===');
    const funcResult = await prisma.$queryRaw<{ funcname: string }[]>`
      SELECT proname AS funcname FROM pg_proc WHERE proname = 'immutable_unaccent';
    `;
    console.log('Result:', funcResult);

    // Test 3: Check if pg_trgm extension exists
    console.log('=== Test 3: pg_trgm extension ===');
    const extResult = await prisma.$queryRaw<{ extname: string }[]>`
      SELECT extname FROM pg_extension WHERE extname = 'pg_trgm';
    `;
    console.log('Result:', extResult);

    // Test 4: Check if unaccent extension exists
    console.log('=== Test 4: unaccent extension ===');
    const extResult2 = await prisma.$queryRaw<{ extname: string }[]>`
      SELECT extname FROM pg_extension WHERE extname = 'unaccent';
    `;
    console.log('Result:', extResult2);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
