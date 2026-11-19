import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import dotenv from 'dotenv';
dotenv.config();
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });
async function main() {
  const users = await prisma.user.findMany({ where: { role: 'seller' }, select: { id: true, email: true, role: true } });
  console.log('Sellers:', JSON.stringify(users, null, 2));
}
main().then(() => prisma['$disconnect']());
