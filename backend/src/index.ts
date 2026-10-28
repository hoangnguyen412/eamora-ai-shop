import express, { type NextFunction, type Request, type Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import jwt, { type SignOptions } from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import swaggerUi from 'swagger-ui-express';
import YAML from 'yamljs';
import path from 'path';
import fs from 'fs';

dotenv.config();
const app = express();

const connectionString = process.env.DATABASE_URL as string;
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

const PORT = process.env.PORT || 4000;
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
const JWT_EXPIRES_IN = (process.env.JWT_EXPIRES_IN || '7d') as SignOptions['expiresIn'];
const ALLOWED_ROLES = ['buyer', 'seller'] as const;

type UserPayload = {
  id: string;
  email: string;
  role: string;
  createdAt: Date;
};

type AuthenticatedRequest = Request & {
  user?: UserPayload;
};

const sanitizeUser = (user: {
  id: string;
  email: string;
  role: string;
  createdAt: Date;
}) => ({
  id: user.id,
  email: user.email,
  role: user.role,
  createdAt: user.createdAt,
});

const createToken = (user: Pick<UserPayload, 'id' | 'email' | 'role'>) =>
  jwt.sign({ sub: user.id, email: user.email, role: user.role }, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
  });

const readMockProductDatabase = (): { products?: Array<Record<string, any>> } => {
  const candidatePaths = [
    path.resolve(__dirname, '../../src/mocks/db.json'),
    path.resolve(process.cwd(), 'src/mocks/db.json'),
    path.resolve(process.cwd(), '../src/mocks/db.json'),
  ];

  for (const candidatePath of candidatePaths) {
    try {
      if (fs.existsSync(candidatePath)) {
        const raw = fs.readFileSync(candidatePath, 'utf-8');
        return JSON.parse(raw) as { products?: Array<Record<string, any>> };
      }
    } catch (error) {
      console.warn('Unable to load mock product data:', error);
    }
  }

  return { products: [] };
};

const normalizeProductRecord = (product: Record<string, any>) => {
  const images = Array.isArray(product.images) && product.images.length > 0
    ? product.images
    : [product.thumbnailUrl].filter(Boolean);

  const basePrice = Number(product.price ?? product.basePrice ?? 0);
  const originalPrice = Number(product.originalPrice ?? basePrice ?? 0);
  const categoryName = product.category ?? product.categoryName ?? 'General';
  const brandName = product.brand ?? product.name?.split(' ')[0] ?? 'Brand';

  return {
    id: product.id,
    name: product.name,
    slug: product.slug ?? product.name?.toLowerCase().replace(/[^a-z0-9]+/g, '-') ?? product.id,
    brand: brandName,
    category: categoryName,
    price: basePrice,
    originalPrice,
    discountPercent: Number(product.discountPercent ?? (originalPrice > 0 ? Math.round(((originalPrice - basePrice) / originalPrice) * 100) : 0)),
    stock: Number(product.stock ?? 0),
    rating: Number(product.rating ?? 0),
    reviewCount: Number(product.reviewCount ?? 0),
    thumbnailUrl: product.thumbnailUrl ?? images[0],
    images,
    isFeatured: Boolean(product.isFeatured),
    specs: product.specs ?? {},
    recommendationBadge: product.recommendationBadge ?? null,
    createdAt: product.createdAt ?? new Date().toISOString(),
    description: product.description ?? '',
  };
};

const getProductData = async () => {
  try {
    const productsFromDb = await prisma.product.findMany({
      include: {
        category: true,
        reviews: true,
        listings: true,
      },
    });

    if (productsFromDb.length > 0) {
      return productsFromDb.map((product) => {
        const listingPrices = product.listings.map((listing) => listing.price);
        const averageRating = product.reviews.length > 0
          ? product.reviews.reduce((total, item) => total + item.rating, 0) / product.reviews.length
          : 0;
        const stockTotal = product.listings.reduce((total, listing) => total + listing.stock, 0);
        const price = listingPrices.length > 0 ? Math.min(...listingPrices) : Number(product.basePrice ?? 0);

        return {
          id: product.id,
          name: product.name,
          slug: product.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
          brand: product.name.split(' ')[0] ?? 'Brand',
          category: product.category?.name ?? 'General',
          price,
          originalPrice: price,
          discountPercent: 0,
          stock: stockTotal,
          rating: averageRating,
          reviewCount: product.reviews.length,
          thumbnailUrl: '',
          images: [],
          isFeatured: false,
          specs: (product.specs as Record<string, any>) ?? {},
          recommendationBadge: null,
          createdAt: new Date().toISOString(),
          description: product.description ?? '',
        };
      });
    }
  } catch (error) {
    console.warn('Prisma product query failed, falling back to mock product data:', error);
  }

  const mockData = readMockProductDatabase();
  return (mockData.products ?? []).map((product) => normalizeProductRecord(product));
};

const requireAuth = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) => {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';

  if (!token) {
    return res.status(401).json({ message: 'Authentication required' });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET) as { sub?: string };

    if (!payload.sub) {
      return res.status(401).json({ message: 'Invalid token payload' });
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
    });

    if (!user) {
      return res.status(401).json({ message: 'User not found' });
    }

    req.user = sanitizeUser(user);
    return next();
  } catch (error) {
    return res.status(401).json({ message: 'Invalid or expired token', details: error });
  }
};

app.use(cors());
app.use(express.json());

const swaggerDocument = YAML.load(path.join(__dirname, '../openapi.yaml'));
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

app.get('/health', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'ok', db: 'connected' });
  } catch (error) {
    res.status(500).json({ status: 'error', db: 'disconnected', details: error });
  }
});

app.post('/api/auth/register', async (req: Request, res: Response) => {
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  const role = typeof req.body?.role === 'string' ? req.body.role.trim().toLowerCase() : '';

  if (!email || !password || !role) {
    return res.status(400).json({ message: 'Email, password and role are required' });
  }

  if (!ALLOWED_ROLES.includes(role as (typeof ALLOWED_ROLES)[number])) {
    return res.status(400).json({ message: 'Role must be buyer or seller' });
  }

  if (password.length < 8) {
    return res.status(400).json({ message: 'Password must be at least 8 characters long' });
  }

  const existingUser = await prisma.user.findUnique({
    where: { email },
  });

  if (existingUser) {
    return res.status(409).json({ message: 'User already exists' });
  }

  try {
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        role,
      },
    });

    const token = createToken({
      id: user.id,
      email: user.email,
      role: user.role,
    });

    return res.status(201).json({
      token,
      user: sanitizeUser(user),
    });
  } catch (error) {
    return res.status(500).json({ message: 'Unable to create user', details: error });
  }
});

app.post('/api/auth/login', async (req: Request, res: Response) => {
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const password = typeof req.body?.password === 'string' ? req.body.password : '';

  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required' });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const isValidPassword = await bcrypt.compare(password, user.passwordHash);

    if (!isValidPassword) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const token = createToken({
      id: user.id,
      email: user.email,
      role: user.role,
    });

    return res.json({
      token,
      user: sanitizeUser(user),
    });
  } catch (error) {
    return res.status(500).json({ message: 'Unable to login', details: error });
  }
});

app.get('/api/auth/me', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ message: 'Authentication required' });
  }

  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
  });

  if (!user) {
    return res.status(404).json({ message: 'User not found' });
  }

  return res.json({ user: sanitizeUser(user) });
});

app.get('/api/products', async (req: Request, res: Response) => {
  try {
    const page = Number(req.query.page ?? 1);
    const limit = Number(req.query.limit ?? 12);
    const category = typeof req.query.category === 'string' ? req.query.category.trim() : '';
    const brand = typeof req.query.brand === 'string' ? req.query.brand.trim() : '';

    const products = await getProductData();
    const filteredProducts = products.filter((product) => {
      const matchesCategory = !category || product.category.toLowerCase() === category.toLowerCase();
      const matchesBrand = !brand || product.brand.toLowerCase() === brand.toLowerCase();
      return matchesCategory && matchesBrand;
    });

    const safePage = Number.isFinite(page) && page > 0 ? page : 1;
    const safeLimit = Number.isFinite(limit) && limit > 0 ? limit : 12;
    const startIndex = (safePage - 1) * safeLimit;
    const paginated = filteredProducts.slice(startIndex, startIndex + safeLimit);

    return res.json({
      success: true,
      data: paginated,
      pagination: {
        currentPage: safePage,
        totalPages: Math.max(1, Math.ceil(filteredProducts.length / safeLimit || 1)),
        totalItems: filteredProducts.length,
        limit: safeLimit,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Unable to fetch products', details: error });
  }
});

app.get('/api/products/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const products = await getProductData();
    const product = products.find((item) => item.id === id || item.slug === id);

    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    return res.json({ success: true, data: product });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Unable to fetch product detail', details: error });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Backend đang chạy tại http://localhost:${PORT}`);
  console.log(`📚 Swagger UI tại http://localhost:${PORT}/docs`);
});