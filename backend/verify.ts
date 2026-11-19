import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import dotenv from 'dotenv';
dotenv.config();
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });
async function main() {
  const product = await prisma.product.findUnique({ where: { id: '953633e1-cb6d-44a7-94db-b8e87f781b48' }, include: { category: true, listings: true } });
  console.log('Product:', JSON.stringify(product, null, 2));
}
main().then(() => prisma['$disconnect']());
