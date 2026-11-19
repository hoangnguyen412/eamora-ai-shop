import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import dotenv from 'dotenv';
dotenv.config();
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });
async function main() {
  const categories = await prisma.category.findMany({ select: { id: true, name: true } });
  console.log('Categories:', JSON.stringify(categories, null, 2));
  const shops = await prisma.shop.findMany({ select: { id: true, sellerId: true, name: true } });
  console.log('Shops:', JSON.stringify(shops, null, 2));
}
main().then(() => prisma['$disconnect']());
