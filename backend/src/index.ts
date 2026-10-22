import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg'; // <-- Thêm import adapter
import swaggerUi from 'swagger-ui-express';
import YAML from 'yamljs';
import path from 'path';

dotenv.config();
const app = express();

// Khởi tạo Prisma Client với driver adapter (Bắt buộc ở Prisma 7)
const connectionString = process.env.DATABASE_URL as string;
const adapter = new PrismaPg({ connectionString }); // <-- Tạo adapter
const prisma = new PrismaClient({ adapter }); // <-- Truyền adapter vào Client

const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

// Cấu hình Swagger UI
const swaggerDocument = YAML.load(path.join(__dirname, '../openapi.yaml'));
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// Endpoint /health
app.get('/health', async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`; // Test kết nối DB
    res.json({ status: 'ok', db: 'connected' });
  } catch (error) {
    res.status(500).json({ status: 'error', db: 'disconnected', details: error });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Backend đang chạy tại http://localhost:${PORT}`);
  console.log(`📚 Swagger UI tại http://localhost:${PORT}/docs`);
});