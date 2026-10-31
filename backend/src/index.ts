import express, { type NextFunction, type Request, type Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { rateLimit } from 'express-rate-limit';
import helmet from 'helmet';
import bcrypt from 'bcryptjs';
import jwt, { type SignOptions } from 'jsonwebtoken';
import { Prisma, PrismaClient } from '@prisma/client';
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

const NODE_ENV = process.env.NODE_ENV ?? 'development';
const PORT = process.env.PORT || 4000;
const JWT_SECRET = process.env.JWT_SECRET ?? 'dev-secret-change-me';
const JWT_EXPIRES_IN = (process.env.JWT_EXPIRES_IN || '7d') as SignOptions['expiresIn'];
const CORS_ORIGINS = (process.env.CORS_ORIGINS ?? '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
const TRUST_PROXY_HOPS = Number(process.env.TRUST_PROXY_HOPS ?? 0);
const API_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const AUTO_BUY_WORKER_ENABLED = process.env.AUTO_BUY_WORKER_ENABLED === 'true';
const AUTO_BUY_WORKER_INTERVAL_MS = Number(process.env.AUTO_BUY_WORKER_INTERVAL_MS ?? 10000);
const AUTO_BUY_WORKER_BATCH_SIZE = Number(process.env.AUTO_BUY_WORKER_BATCH_SIZE ?? 10);
const ALLOWED_ROLES = ['buyer', 'seller'] as const;
type Role = (typeof ALLOWED_ROLES)[number];

if (!Number.isInteger(AUTO_BUY_WORKER_INTERVAL_MS) || AUTO_BUY_WORKER_INTERVAL_MS < 1000) {
  throw new Error('AUTO_BUY_WORKER_INTERVAL_MS must be an integer of at least 1000');
}
if (!Number.isInteger(AUTO_BUY_WORKER_BATCH_SIZE) || AUTO_BUY_WORKER_BATCH_SIZE < 1 || AUTO_BUY_WORKER_BATCH_SIZE > 100) {
  throw new Error('AUTO_BUY_WORKER_BATCH_SIZE must be an integer from 1 to 100');
}
if (NODE_ENV === 'production' && (!process.env.JWT_SECRET || Buffer.byteLength(JWT_SECRET, 'utf8') < 32)) {
  throw new Error('JWT_SECRET must be explicitly configured with at least 32 bytes in production');
}
if (!Number.isInteger(TRUST_PROXY_HOPS) || TRUST_PROXY_HOPS < 0) {
  throw new Error('TRUST_PROXY_HOPS must be a non-negative integer');
}

for (const origin of CORS_ORIGINS) {
  let parsedOrigin: URL;
  try {
    parsedOrigin = new URL(origin);
  } catch {
    throw new Error(`Invalid origin in CORS_ORIGINS: ${origin}`);
  }
  if (!['http:', 'https:'].includes(parsedOrigin.protocol) || parsedOrigin.origin !== origin) {
    throw new Error(`CORS_ORIGINS entries must be exact http(s) origins: ${origin}`);
  }
}

type UserPayload = {
  id: string;
  email: string;
  role: string;
  createdAt: Date;
};

type AuthenticatedRequest = Request & {
  user?: UserPayload;
};

class OrderRequestError extends Error {
  constructor(public statusCode: number, message: string) {
    super(message);
  }
}

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

const apiRateLimiter = rateLimit({
  windowMs: API_RATE_LIMIT_WINDOW_MS,
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests. Try again later.' },
});
const authRateLimiter = rateLimit({
  windowMs: API_RATE_LIMIT_WINDOW_MS,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many authentication attempts. Try again later.' },
});

const isValidEmail = (email: string) =>
  email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

const parseIntegerQuery = (
  value: unknown,
  fallback: number,
  minimum: number,
  maximum: number,
): number | null => {
  if (value === undefined) {
    return fallback;
  }
  if (typeof value !== 'string' || !/^\d+$/.test(value)) {
    return null;
  }
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= minimum && parsed <= maximum ? parsed : null;
};

const sendServerError = (
  res: Response,
  message: string,
  error: unknown,
  responseBody: Record<string, unknown> = { success: false, message },
) => {
  console.error(message, error);
  return res.status(500).json(responseBody);
};

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

type NaturalLanguageSearchFilters = {
  keyword: string;
  categoryId: 'cat-laptop' | 'cat-phone' | null;
  minPrice: number | null;
  maxPrice: number | null;
};

const PRICE_UNIT_MULTIPLIER = 1_000_000;

const NATURAL_LANGUAGE_NOISE_PATTERNS: RegExp[] = [
  /giá\s*rẻ/g,
  /giá\s*tốt/g,
  /giá\s*phải\s*chăng/g,
  /rẻ\s*nhất/g,
  /sản\s*phẩm/g,
  /tìm\s*kiếm/g,
  /\btìm\b/g,
  /\bmua\b/g,
  /\bcần\b/g,
  /tư\s*vấn/g,
  /\bcho\s*(?:mình|tôi|em)\b/g,
  /\bshop\b/g,
];

/**
 * Bóc tách truy vấn tìm kiếm ngôn ngữ tự nhiên, ví dụ: "laptop dưới 20 triệu giá rẻ".
 * Trả về: categoryId, minPrice, maxPrice và từ khoá còn lại sau khi đã loại bỏ các cụm điều kiện.
 */
const parseNaturalLanguageSearch = (rawSearch: string): NaturalLanguageSearchFilters => {
  let remaining = ` ${rawSearch.toLocaleLowerCase()} `;
  let categoryId: NaturalLanguageSearchFilters['categoryId'] = null;
  let minPrice: number | null = null;
  let maxPrice: number | null = null;

  const toVnd = (value: string): number => Math.round(Number(value.replace(',', '.')) * PRICE_UNIT_MULTIPLIER);

  // "dưới 20 triệu" (hoặc 20tr / 20 củ) -> maxPrice
  const maxMatch = remaining.match(/dưới\s*(\d+(?:[.,]\d+)?)\s*(?:triệu|tr|củ)/);
  if (maxMatch) {
    const amount = toVnd(maxMatch[1]);
    if (Number.isFinite(amount) && amount > 0) {
      maxPrice = amount;
    }
    remaining = remaining.replace(maxMatch[0], ' ');
  }

  // "trên 10 triệu" (hoặc 10tr / 10 củ) -> minPrice
  const minMatch = remaining.match(/trên\s*(\d+(?:[.,]\d+)?)\s*(?:triệu|tr|củ)/);
  if (minMatch) {
    const amount = toVnd(minMatch[1]);
    if (Number.isFinite(amount) && amount > 0) {
      minPrice = amount;
    }
    remaining = remaining.replace(minMatch[0], ' ');
  }

  // Ngân sách ước lượng: "khoảng 20 triệu", "laptop 1,5 triệu" -> maxPrice
  if (minPrice === null && maxPrice === null) {
    const approxMatch = remaining.match(/(\d+(?:[.,]\d+)?)\s*(?:triệu|tr|củ)/);
    if (approxMatch) {
      const amount = toVnd(approxMatch[1]);
      if (Number.isFinite(amount) && amount > 0) {
        maxPrice = amount;
      }
      remaining = remaining.replace(approxMatch[0], ' ');
    }
  }

  // Danh mục: id thật trong DB là "cat-laptop" / "cat-phone" (xem prisma/schema.prisma + seed).
  if (/\blaptops?\b/.test(remaining)) {
    categoryId = 'cat-laptop';
    remaining = remaining.replace(/\blaptops?\b/g, ' ');
  } else if (/điện\s*thoại|dien\s*thoai|smartphone|mobile|cell\s*phone/.test(remaining)) {
    categoryId = 'cat-phone';
    remaining = remaining.replace(/điện\s*thoại|dien\s*thoai|smartphone|mobile|cell\s*phone/g, ' ');
  }

  // Loại bỏ từ nhiễu ("giá rẻ", "tìm", "mua", ...) để lấy từ khoá sản phẩm thật sự.
  for (const pattern of NATURAL_LANGUAGE_NOISE_PATTERNS) {
    remaining = remaining.replace(pattern, ' ');
  }

  const keyword = remaining
    .replace(/[.,!?;:()"']+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return { keyword, categoryId, minPrice, maxPrice };
};

const getProductData = async (
  where?: Prisma.ProductWhereInput,
  skip = 0,
  take = 100,
) => {
  try {
    const productsFromDb = await prisma.product.findMany({
      where,
      skip,
      take,
      select: {
        id: true,
        name: true,
        description: true,
        specs: true,
        basePrice: true,
        imageUrl: true,
        brand: true,
        category: { select: { name: true } },
        reviews: { select: { rating: true } },
        listings: {
          select: {
            id: true,
            shopId: true,
            price: true,
            stock: true,
            shop: { select: { name: true } },
          },
        },
      },
    });

    if (productsFromDb.length > 0) {
      return productsFromDb.map((product) => {
        const listingPrices = product.listings.map((listing) => listing.price);
        const offers = product.listings
          .filter((listing) => listing.stock > 0)
          .map((listing) => ({
            listingId: listing.id,
            shopId: listing.shopId,
            shopName: listing.shop.name,
            price: listing.price,
            stock: listing.stock,
          }))
          .sort((left, right) => left.price - right.price);
        const averageRating = product.reviews.length > 0
          ? product.reviews.reduce((total, item) => total + item.rating, 0) / product.reviews.length
          : 0;
        const stockTotal = product.listings.reduce((total, listing) => total + listing.stock, 0);
        const price = offers[0]?.price ?? (listingPrices.length > 0 ? Math.min(...listingPrices) : Number(product.basePrice ?? 0));
        const imgUrl = product.imageUrl ?? '';

        return {
          id: product.id,
          name: product.name,
          slug: product.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
          brand: product.brand ?? product.name.split(' ')[0] ?? 'Brand',
          category: product.category?.name ?? 'General',
          price,
          originalPrice: price,
          discountPercent: 0,
          stock: stockTotal,
          rating: averageRating,
          reviewCount: product.reviews.length,
          thumbnailUrl: imgUrl,
          images: imgUrl ? [imgUrl] : [],
          isFeatured: false,
          specs: (product.specs as Record<string, any>) ?? {},
          recommendationBadge: null,
          createdAt: new Date().toISOString(),
          description: product.description ?? '',
          offers,
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

  let payload: jwt.JwtPayload;
  try {
    const verifiedPayload = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });
    if (typeof verifiedPayload === 'string') {
      return res.status(401).json({ message: 'Invalid token payload' });
    }
    payload = verifiedPayload;
  } catch {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }

  if (typeof payload.sub !== 'string' || !payload.sub) {
    return res.status(401).json({ message: 'Invalid token payload' });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
    });
    if (!user) {
      return res.status(401).json({ message: 'User not found' });
    }

    req.user = sanitizeUser(user);
    return next();
  } catch (error) {
    console.error('JWT authentication database lookup failed:', error);
    return res.status(503).json({ message: 'Authentication service temporarily unavailable' });
  }
};

const optionalAuth = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  if (!req.headers.authorization) {
    return next();
  }
  return requireAuth(req, res, next);
};

const requireRole = (allowedRoles: Role[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    if (!allowedRoles.includes(req.user.role as Role)) {
      return res.status(403).json({ message: `Access denied. Required role: ${allowedRoles.join(' or ')}` });
    }

    return next();
  };
};

app.set('trust proxy', TRUST_PROXY_HOPS);
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || (NODE_ENV !== 'production' && CORS_ORIGINS.length === 0)) {
      return callback(null, true);
    }
    return callback(null, CORS_ORIGINS.includes(origin));
  },
}));
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      baseUri: ["'self'"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'", 'https:', 'data:'],
      formAction: ["'self'"],
      frameAncestors: ["'self'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      objectSrc: ["'none'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
    },
  },
}));
app.use('/api', apiRateLimiter);
app.use(express.json({ limit: '100kb' }));

app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`[${req.method}] ${req.originalUrl} - ${duration}ms`);
  });
  next();
});

const swaggerDocument = YAML.load(path.join(__dirname, '../openapi.yaml'));
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

app.get('/health', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'ok', db: 'connected' });
  } catch (error) {
    sendServerError(res, 'Health check database query failed', error, { status: 'error', db: 'disconnected' });
  }
});

app.post('/api/auth/register', authRateLimiter, async (req: Request, res: Response) => {
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  const role = typeof req.body?.role === 'string' ? req.body.role.trim().toLowerCase() : '';

  if (!email || !password || !role) {
    return res.status(400).json({ message: 'Email, password and role are required' });
  }
  if (!isValidEmail(email)) {
    return res.status(400).json({ message: 'Email must be a valid address of at most 254 characters' });
  }

  if (!ALLOWED_ROLES.includes(role as (typeof ALLOWED_ROLES)[number])) {
    return res.status(400).json({ message: 'Role must be buyer or seller' });
  }

  if (password.length < 8 || Buffer.byteLength(password, 'utf8') > 72) {
    return res.status(400).json({ message: 'Password must be at least 8 characters and no more than 72 bytes' });
  }

  try {
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });
    if (existingUser) {
      return res.status(409).json({ message: 'User already exists' });
    }

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
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return res.status(409).json({ message: 'User already exists' });
    }
    return sendServerError(res, 'Unable to create user', error, { message: 'Unable to create user' });
  }
});

app.post('/api/auth/login', authRateLimiter, async (req: Request, res: Response) => {
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const password = typeof req.body?.password === 'string' ? req.body.password : '';

  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required' });
  }
  if (!isValidEmail(email) || Buffer.byteLength(password, 'utf8') > 72) {
    return res.status(400).json({ message: 'Invalid email or password length' });
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
    return sendServerError(res, 'Unable to login', error, { message: 'Unable to login' });
  }
});

app.get('/api/auth/me', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ message: 'Authentication required' });
  }

  return res.json({
    user: {
      id: req.user.id,
      email: req.user.email,
      role: req.user.role,
      createdAt: req.user.createdAt,
    },
  });
});

app.get('/api/orders/me', requireAuth, requireRole(['buyer']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const orderHistory = await prisma.order.findMany({
      where: { buyerId: req.user?.id ?? '' },
      include: {
        items: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return res.json({ success: true, data: orderHistory });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes('ECONNREFUSED') || message.includes('connect') || message.includes('database')) {
      return res.json({ success: true, data: [] });
    }
    return sendServerError(res, 'Unable to fetch order history', error);
  }
});

app.post('/api/orders', requireAuth, requireRole(['buyer']), async (req: AuthenticatedRequest, res: Response) => {
  const rawItems = req.body?.items;
  const shippingInfo = req.body?.shipping_info ?? req.body?.shippingInfo;
  const rawPaymentMethod = req.body?.payment_method ?? req.body?.paymentMethod;
  const paymentMethod = rawPaymentMethod === undefined
    ? 'cod'
    : typeof rawPaymentMethod === 'string'
      ? rawPaymentMethod
      : '';

  if (!Array.isArray(rawItems) || rawItems.length === 0 || rawItems.length > 50) {
    return res.status(400).json({ success: false, message: 'Items must contain between 1 and 50 entries' });
  }

  const itemQuantities = new Map<string, number>();
  for (const item of rawItems) {
    const listingId = item && typeof item === 'object' && typeof item.listingId === 'string'
      ? item.listingId.trim()
      : '';
    const quantity = item && typeof item === 'object' ? item.quantity : undefined;
    if (!listingId || listingId.length > 200 || typeof quantity !== 'number' || !Number.isSafeInteger(quantity) || quantity < 1) {
      return res.status(400).json({ success: false, message: 'Each item requires a listingId and positive integer quantity' });
    }
    const combinedQuantity = (itemQuantities.get(listingId) ?? 0) + quantity;
    if (!Number.isSafeInteger(combinedQuantity)) {
      return res.status(400).json({ success: false, message: 'Combined listing quantity is too large' });
    }
    itemQuantities.set(listingId, combinedQuantity);
  }

  const addressFields = ['fullName', 'phone', 'address', 'city'] as const;
  const maxAddressLengths = { fullName: 120, phone: 32, address: 500, city: 120 };
  if (!shippingInfo || typeof shippingInfo !== 'object' || Array.isArray(shippingInfo)
    || addressFields.some((field) => typeof shippingInfo[field] !== 'string'
      || !shippingInfo[field].trim()
      || shippingInfo[field].trim().length > maxAddressLengths[field])) {
    return res.status(400).json({ success: false, message: 'Shipping info requires valid fullName, phone, address and city fields within their length limits' });
  }
  const validatedShippingInfo = {
    fullName: shippingInfo.fullName.trim(),
    phone: shippingInfo.phone.trim(),
    address: shippingInfo.address.trim(),
    city: shippingInfo.city.trim(),
  };

  if (!['cod', 'vnpay', 'credit_card'].includes(paymentMethod)) {
    return res.status(400).json({ success: false, message: 'Unsupported payment method' });
  }

  try {
    const order = await prisma.$transaction(async (transaction) => {
      const listingIds = [...itemQuantities.keys()];
      const listings = await transaction.listing.findMany({
        where: { id: { in: listingIds } },
        include: { shop: true },
      });

      if (listings.length !== listingIds.length) {
        throw new OrderRequestError(404, 'One or more listings were not found');
      }

      if (new Set(listings.map((listing) => listing.shopId)).size !== 1) {
        throw new OrderRequestError(400, 'An order can contain listings from only one seller');
      }

      const orderItems = listings.map((listing) => ({
        listingId: listing.id,
        quantity: itemQuantities.get(listing.id) as number,
        price: listing.price,
      }));

      for (const item of orderItems) {
        const stockUpdate = await transaction.listing.updateMany({
          where: { id: item.listingId, stock: { gte: item.quantity } },
          data: { stock: { decrement: item.quantity } },
        });
        if (stockUpdate.count !== 1) {
          throw new OrderRequestError(409, 'One or more listings have insufficient stock');
        }
      }

      const totalAmount = orderItems.reduce((sum, item) => sum + item.price * item.quantity, 0) + 30000;
      return transaction.order.create({
        data: {
          buyerId: req.user!.id,
          totalAmount,
          status: 'pending',
          shippingInfo: validatedShippingInfo,
          paymentMethod,
          items: { create: orderItems },
        },
        include: { items: true },
      });
    });

    return res.status(201).json({ success: true, data: order });
  } catch (error) {
    if (error instanceof OrderRequestError) {
      return res.status(error.statusCode).json({ success: false, message: error.message });
    }
    return sendServerError(res, 'Unable to create order', error);
  }
});

app.get('/api/orders/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const orderId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    if (req.user?.role === 'buyer' && order.buyerId === req.user.id) {
      return res.json({ success: true, data: order });
    }

    if (req.user?.role === 'seller') {
      const listingIds = order.items.map((item) => item.listingId);
      const ownedListings = await prisma.listing.findMany({
        where: { id: { in: listingIds }, shop: { sellerId: req.user.id } },
        select: { id: true },
      });
      if (ownedListings.length === listingIds.length) {
        return res.json({ success: true, data: order });
      }
    }

    return res.status(403).json({ success: false, message: 'You do not have access to this order' });
  } catch (error) {
    return sendServerError(res, 'Unable to fetch order', error);
  }
});

app.patch('/api/orders/:id/status', requireAuth, requireRole(['seller']), async (req: AuthenticatedRequest, res: Response) => {
  const nextStatus = typeof req.body?.status === 'string' ? req.body.status : '';
  const allowedTransitions: Record<string, string[]> = {
    pending: ['processing', 'cancelled'],
    processing: ['shipped', 'cancelled'],
    shipped: ['delivered'],
    delivered: [],
    cancelled: [],
  };

  if (!Object.prototype.hasOwnProperty.call(allowedTransitions, nextStatus)) {
    return res.status(400).json({ success: false, message: 'Unsupported order status' });
  }

  try {
    const updatedOrder = await prisma.$transaction(async (transaction) => {
      const orderId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const order = await transaction.order.findUnique({
        where: { id: orderId },
      });
      if (!order) {
        throw new OrderRequestError(404, 'Order not found');
      }
      const orderItems = await transaction.orderItem.findMany({ where: { orderId: order.id } });
      if (!allowedTransitions[order.status]?.includes(nextStatus)) {
        throw new OrderRequestError(409, `Cannot change order status from ${order.status} to ${nextStatus}`);
      }

      const listingIds = orderItems.map((item) => item.listingId);
      const ownedListings = await transaction.listing.findMany({
        where: { id: { in: listingIds }, shop: { sellerId: req.user!.id } },
        select: { id: true },
      });
      if (ownedListings.length !== listingIds.length) {
        throw new OrderRequestError(403, 'You do not have access to update this order');
      }

      const statusUpdate = await transaction.order.updateMany({
        where: { id: order.id, status: order.status },
        data: { status: nextStatus },
      });
      if (statusUpdate.count !== 1) {
        throw new OrderRequestError(409, 'Order status changed; reload and try again');
      }

      if (nextStatus === 'cancelled') {
        for (const item of orderItems) {
          await transaction.listing.update({
            where: { id: item.listingId },
            data: { stock: { increment: item.quantity } },
          });
        }
      }

      const updated = await transaction.order.findUnique({
        where: { id: order.id },
      });
      return updated ? { ...updated, items: orderItems } : null;
    });

    return res.json({ success: true, data: updatedOrder });
  } catch (error) {
    if (error instanceof OrderRequestError) {
      return res.status(error.statusCode).json({ success: false, message: error.message });
    }
    return sendServerError(res, 'Unable to update order status', error);
  }
});

app.get('/api/seller/listings', requireAuth, requireRole(['seller']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const listings = await prisma.listing.findMany({
      where: { shop: { sellerId: req.user!.id } },
      include: { product: true },
      orderBy: { createdAt: 'desc' },
    });
    const listingIds = listings.map((listing) => listing.id);
    const orderItems = listingIds.length > 0
      ? await prisma.orderItem.findMany({ where: { listingId: { in: listingIds } } })
      : [];
    const orderIds = [...new Set(orderItems.map((item) => item.orderId))];
    const orders = orderIds.length > 0
      ? await prisma.order.findMany({
        where: { id: { in: orderIds }, status: { not: 'cancelled' } },
        select: { id: true },
      })
      : [];
    const activeOrderIds = new Set(orders.map((order) => order.id));
    const soldByListing = new Map<string, number>();

    for (const item of orderItems) {
      if (activeOrderIds.has(item.orderId)) {
        soldByListing.set(item.listingId, (soldByListing.get(item.listingId) ?? 0) + item.quantity);
      }
    }

    return res.json({
      success: true,
      data: listings.map((listing) => ({
        ...listing,
        totalSold: soldByListing.get(listing.id) ?? 0,
        status: listing.stock > 0 ? 'active' : 'out_of_stock',
      })),
    });
  } catch (error) {
    return sendServerError(res, 'Unable to fetch seller listings', error);
  }
});

app.get('/api/seller/orders', requireAuth, requireRole(['seller']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const listings = await prisma.listing.findMany({
      where: { shop: { sellerId: req.user!.id } },
      include: { product: { select: { id: true, name: true } } },
    });
    const listingsById = new Map(listings.map((listing) => [listing.id, listing]));
    const listingIds = [...listingsById.keys()];
    const orderItems = listingIds.length > 0
      ? await prisma.orderItem.findMany({ where: { listingId: { in: listingIds } } })
      : [];
    const orderIds = [...new Set(orderItems.map((item) => item.orderId))];
    const orders = orderIds.length > 0
      ? await prisma.order.findMany({
        where: { id: { in: orderIds } },
        orderBy: { createdAt: 'desc' },
      })
      : [];
    const itemsByOrder = new Map<string, typeof orderItems>();

    for (const item of orderItems) {
      const items = itemsByOrder.get(item.orderId) ?? [];
      items.push(item);
      itemsByOrder.set(item.orderId, items);
    }

    return res.json({
      success: true,
      data: orders.map((order) => {
        const items = (itemsByOrder.get(order.id) ?? []).flatMap((item) => {
          const listing = listingsById.get(item.listingId);
          return listing
            ? [{
              ...item,
              productId: listing.product.id,
              productName: listing.product.name,
              lineTotal: item.price * item.quantity,
            }]
            : [];
        });

        return {
          ...order,
          items,
          sellerAmount: items.reduce((total, item) => total + item.lineTotal, 0),
        };
      }),
    });
  } catch (error) {
    return sendServerError(res, 'Unable to fetch seller orders', error);
  }
});

app.get('/api/seller/stats', requireAuth, requireRole(['seller']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const listings = await prisma.listing.findMany({
      where: { shop: { sellerId: req.user!.id } },
      select: { id: true, stock: true },
    });
    const listingIds = listings.map((listing) => listing.id);
    const orderItems = listingIds.length > 0
      ? await prisma.orderItem.findMany({ where: { listingId: { in: listingIds } } })
      : [];
    const orderIds = [...new Set(orderItems.map((item) => item.orderId))];
    const orders = orderIds.length > 0
      ? await prisma.order.findMany({
        where: { id: { in: orderIds } },
        select: { id: true, status: true },
      })
      : [];
    const ordersById = new Map(orders.map((order) => [order.id, order]));
    const ordersByStatus = {
      pending: 0,
      processing: 0,
      shipped: 0,
      delivered: 0,
      cancelled: 0,
    };

    for (const order of orders) {
      if (Object.prototype.hasOwnProperty.call(ordersByStatus, order.status)) {
        ordersByStatus[order.status as keyof typeof ordersByStatus] += 1;
      }
    }

    const soldItems = orderItems.filter((item) => ordersById.get(item.orderId)?.status !== 'cancelled');

    return res.json({
      success: true,
      data: {
        listingCount: listings.length,
        activeListingCount: listings.filter((listing) => listing.stock > 0).length,
        orderCount: orders.length,
        totalRevenue: soldItems.reduce((total, item) => total + item.price * item.quantity, 0),
        unitsSold: soldItems.reduce((total, item) => total + item.quantity, 0),
        ordersByStatus,
      },
    });
  } catch (error) {
    return sendServerError(res, 'Unable to fetch seller stats', error);
  }
});

app.get('/api/products', async (req: Request, res: Response) => {
  try {
    const page = parseIntegerQuery(req.query.page, 1, 1, 1_000_000);
    const limit = parseIntegerQuery(req.query.limit, 12, 1, 100);
    const rawQuery = req.query.q;
    const rawSearch = req.query.search;
    const rawCategory = req.query.category;
    const rawBrand = req.query.brand;
    if ((rawQuery !== undefined && (typeof rawQuery !== 'string' || rawQuery.length > 200))
      || (rawSearch !== undefined && (typeof rawSearch !== 'string' || rawSearch.length > 200))
      || (rawCategory !== undefined && (typeof rawCategory !== 'string' || rawCategory.length > 120))
      || (rawBrand !== undefined && (typeof rawBrand !== 'string' || rawBrand.length > 120))) {
      return res.status(400).json({ success: false, message: 'Search filters must be single strings within their length limits' });
    }

    const query = typeof rawQuery === 'string' ? rawQuery.trim().toLocaleLowerCase() : '';
    const search = typeof rawSearch === 'string' ? rawSearch.trim() : '';
    const category = typeof rawCategory === 'string' ? rawCategory.trim() : '';
    const brand = typeof rawBrand === 'string' ? rawBrand.trim() : '';
    const explicitMinPrice = req.query.minPrice === undefined
      ? undefined
      : typeof req.query.minPrice === 'string' && req.query.minPrice.trim()
        ? Number(req.query.minPrice)
        : Number.NaN;
    const explicitMaxPrice = req.query.maxPrice === undefined
      ? undefined
      : typeof req.query.maxPrice === 'string' && req.query.maxPrice.trim()
        ? Number(req.query.maxPrice)
        : Number.NaN;

    if (page === null || limit === null) {
      return res.status(400).json({ success: false, message: 'page must be 1–1000000 and limit must be 1–100' });
    }
    if ((explicitMinPrice !== undefined && (!Number.isFinite(explicitMinPrice) || explicitMinPrice < 0))
      || (explicitMaxPrice !== undefined && (!Number.isFinite(explicitMaxPrice) || explicitMaxPrice < 0))) {
      return res.status(400).json({ success: false, message: 'Invalid price range' });
    }

    // Nhận diện tìm kiếm ngôn ngữ tự nhiên: ưu tiên tham số "search",
    // đồng thời hỗ trợ cả "q" khi người dùng gõ "dưới/trên ... triệu" vào ô tìm kiếm.
    const naturalLanguageInput = search
      || (/(?:dưới|trên)\s*\d+(?:[.,]\d+)?\s*(?:triệu|tr|củ)/.test(query) ? query : '');
    const naturalLanguageFilters = naturalLanguageInput
      ? parseNaturalLanguageSearch(naturalLanguageInput)
      : null;

    const minPrice = explicitMinPrice ?? naturalLanguageFilters?.minPrice ?? undefined;
    const maxPrice = explicitMaxPrice ?? naturalLanguageFilters?.maxPrice ?? undefined;

    if (minPrice !== undefined && maxPrice !== undefined && minPrice > maxPrice) {
      return res.status(400).json({ success: false, message: 'Invalid price range' });
    }

    // Khi đã bóc tách NL, dùng đúng từ khoá còn lại (có thể rỗng) thay vì chuỗi gốc.
    const effectiveQuery = naturalLanguageFilters ? naturalLanguageFilters.keyword : query;
    const naturalLanguageCategoryName = naturalLanguageFilters?.categoryId === 'cat-laptop'
      ? 'Laptop'
      : naturalLanguageFilters?.categoryId === 'cat-phone'
        ? 'Điện thoại'
        : '';
    const effectiveCategory = category || naturalLanguageCategoryName;

    // Map điều kiện đã bóc tách vào Prisma query object.
    // Lưu ý: model Product dùng cột "name" (không có cột "title" trong schema).
    // Tất cả điều kiện lọc được đẩy xuống DB để tận dụng index (B-tree, GIN, HNSW).
    const prismaWhere: Prisma.ProductWhereInput = {};
    if (naturalLanguageFilters?.categoryId) {
      prismaWhere.categoryId = naturalLanguageFilters.categoryId;
    }
    if (effectiveQuery) {
      prismaWhere.OR = [
        { name: { contains: effectiveQuery, mode: 'insensitive' } },
        { brand: { contains: effectiveQuery, mode: 'insensitive' } },
        { category: { name: { contains: effectiveQuery, mode: 'insensitive' } } },
      ];
    }
    if (brand) {
      prismaWhere.brand = { equals: brand, mode: 'insensitive' };
    }
    if (effectiveCategory) {
      prismaWhere.category = { name: { equals: effectiveCategory, mode: 'insensitive' } };
    }
    if (minPrice !== undefined || maxPrice !== undefined) {
      prismaWhere.basePrice = {
        ...(minPrice !== undefined ? { gte: minPrice } : {}),
        ...(maxPrice !== undefined ? { lte: maxPrice } : {}),
      };
    }

    const whereClause = Object.keys(prismaWhere).length > 0 ? prismaWhere : undefined;
    const skip = (page - 1) * limit;

    // Chạy song song truy vấn dữ liệu và truy vấn đếm tổng số để tối ưu hiệu năng.
    const [products, totalItems] = await prisma.$transaction(async (tx) => {
      const [productsResult, countResult] = await Promise.all([
        getProductData(whereClause, skip, limit),
        tx.product.count({ where: whereClause }),
      ]);
      return [productsResult, countResult] as const;
    });

    // Lấy TẤT CẢ danh mục (không phụ thuộc vào trang sản phẩm hiện tại).
    const allCategories = await prisma.category.findMany({
      select: { name: true },
      orderBy: { name: 'asc' },
    });
    const categories = allCategories.map((c) => c.name).filter(Boolean);

    // Lấy TẤT CẢ thương hiệu (không phụ thuộc vào trang sản phẩm hiện tại).
    // Nếu người dùng đã chọn một danh mục, chỉ liệt kê thương hiệu trong danh mục đó.
    const brandWhere: Prisma.ProductWhereInput = {};
    if (effectiveCategory) {
      brandWhere.category = { name: { equals: effectiveCategory, mode: 'insensitive' } };
    }
    brandWhere.brand = { not: null };
    const brandRows = await prisma.product.findMany({
      select: { brand: true },
      distinct: ['brand'],
      orderBy: { brand: 'asc' },
      where: brandWhere,
    });
    const brands = brandRows
      .map((r) => r.brand)
      .filter((b): b is string => Boolean(b))
      .sort();

    return res.json({
      success: true,
      data: products,
      filterOptions: {
        categories,
        brands,
      },
      pagination: {
        currentPage: page,
        totalPages: Math.max(1, Math.ceil(totalItems / limit || 1)),
        totalItems,
        limit,
      },
    });
  } catch (error) {
    return sendServerError(res, 'Unable to fetch products', error);
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
    return sendServerError(res, 'Unable to fetch product detail', error);
  }
});

app.get('/api/products/:id/price-history', async (req: Request, res: Response) => {
  const productId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const requestedLimit = parseIntegerQuery(req.query.limit, 100, 1, 100);
  if (requestedLimit === null) {
    return res.status(400).json({ success: false, message: 'limit must be an integer from 1 to 100' });
  }

  try {
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: {
        id: true,
        basePrice: true,
        listings: {
          select: {
            id: true,
            price: true,
            stock: true,
            shop: { select: { name: true } },
            priceHistory: {
              orderBy: [{ recordedAt: 'desc' }, { id: 'desc' }],
              take: requestedLimit,
              select: { id: true, price: true, recordedAt: true },
            },
          },
        },
      },
    });

    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    const history = product.listings
      .flatMap((listing) => listing.priceHistory.map((point) => ({
        id: point.id,
        listingId: listing.id,
        shopName: listing.shop.name,
        price: point.price,
        date: point.recordedAt,
      })))
      .sort((left, right) => left.date.getTime() - right.date.getTime() || left.id.localeCompare(right.id));
    const recordedPrices = history.map((point) => point.price);
    const currentPrice = product.listings
      .filter((listing) => listing.stock > 0)
      .reduce<number | null>((lowest, listing) => lowest === null ? listing.price : Math.min(lowest, listing.price), null)
      ?? product.listings.reduce<number | null>(
        (lowest, listing) => lowest === null ? listing.price : Math.min(lowest, listing.price),
        null,
      )
      ?? product.basePrice;
    const firstPrice = recordedPrices[0];
    const lastPrice = recordedPrices[recordedPrices.length - 1];
    const priceTrend = firstPrice === undefined || lastPrice === undefined || firstPrice === lastPrice
      ? 'stable'
      : lastPrice < firstPrice ? 'down' : 'up';

    return res.json({
      success: true,
      data: {
        productId: product.id,
        currentPrice,
        lowestPrice: recordedPrices.length
          ? recordedPrices.reduce((lowest, price) => Math.min(lowest, price), Number.POSITIVE_INFINITY)
          : currentPrice,
        highestPrice: recordedPrices.length
          ? recordedPrices.reduce((highest, price) => Math.max(highest, price), Number.NEGATIVE_INFINITY)
          : currentPrice,
        priceTrend,
        history: history.map(({ date, price }) => ({ date, price })),
        recordedPoints: history,
      },
    });
  } catch (error) {
    return sendServerError(res, 'Unable to fetch product price history', error);
  }
});

app.get('/api/products/:id/reviews', async (req: Request, res: Response) => {
  const productId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

  try {
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: {
        reviews: {
          select: {
            id: true,
            productId: true,
            rating: true,
            comment: true,
            user: { select: { id: true } },
          },
        },
      },
    });
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    return res.json({ success: true, data: product.reviews });
  } catch (error) {
    return sendServerError(res, 'Unable to fetch product reviews', error);
  }
});

app.post('/api/products/:id/reviews', requireAuth, requireRole(['buyer']), async (req: AuthenticatedRequest, res: Response) => {
  const productId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const rating = req.body?.rating;
  const rawComment = req.body?.comment;

  if (typeof rating !== 'number' || !Number.isInteger(rating) || rating < 1 || rating > 5) {
    return res.status(400).json({ success: false, message: 'Rating must be an integer from 1 to 5' });
  }
  if (rawComment !== undefined && rawComment !== null && typeof rawComment !== 'string') {
    return res.status(400).json({ success: false, message: 'Comment must be a string' });
  }
  if (typeof rawComment === 'string' && rawComment.length > 2000) {
    return res.status(400).json({ success: false, message: 'Comment must be 2000 characters or fewer' });
  }

  const comment = typeof rawComment === 'string' ? rawComment.trim() : null;

  try {
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { id: true },
    });
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    const review = await prisma.review.create({
      data: {
        productId,
        userId: req.user!.id,
        rating,
        comment: comment || null,
        isFake: false,
      },
      select: {
        id: true,
        productId: true,
        userId: true,
        rating: true,
        comment: true,
        isFake: true,
      },
    });

    return res.status(201).json({ success: true, data: review });
  } catch (error) {
    return sendServerError(res, 'Unable to create product review', error);
  }
});

app.post('/api/agent/watch', requireAuth, requireRole(['buyer']), async (req: AuthenticatedRequest, res: Response) => {
  const productId = typeof req.body?.product_id === 'string' ? req.body.product_id.trim() : '';
  const targetPrice = req.body?.target_price;

  if (!productId || typeof targetPrice !== 'number' || !Number.isFinite(targetPrice) || targetPrice <= 0) {
    return res.status(400).json({ success: false, message: 'product_id and a positive target_price are required' });
  }

  try {
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { id: true },
    });
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    const watch = await prisma.watchlist.create({
      data: {
        userId: req.user!.id,
        productId: product.id,
        targetPrice,
      },
      include: {
        product: { select: { id: true, name: true, basePrice: true } },
      },
    });

    return res.status(201).json({ success: true, data: watch });
  } catch (error) {
    return sendServerError(res, 'Unable to add price watch', error);
  }
});

app.get('/api/agent/rules', requireAuth, requireRole(['buyer']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { autoBuyEnabled: true },
    });
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    return res.json({ success: true, data: { auto_buy: user.autoBuyEnabled } });
  } catch (error) {
    return sendServerError(res, 'Unable to fetch price agent rules', error);
  }
});

app.put('/api/agent/rules', requireAuth, requireRole(['buyer']), async (req: AuthenticatedRequest, res: Response) => {
  const autoBuy = req.body?.auto_buy;
  if (typeof autoBuy !== 'boolean') {
    return res.status(400).json({ success: false, message: 'auto_buy must be a boolean' });
  }

  try {
    const user = await prisma.user.update({
      where: { id: req.user!.id },
      data: { autoBuyEnabled: autoBuy },
      select: { autoBuyEnabled: true },
    });

    return res.json({ success: true, data: { auto_buy: user.autoBuyEnabled } });
  } catch (error) {
    return sendServerError(res, 'Unable to update price agent rules', error);
  }
});

app.post('/api/agent/queue', requireAuth, requireRole(['buyer']), async (req: AuthenticatedRequest, res: Response) => {
  const watchId = typeof req.body?.watch_id === 'string' ? req.body.watch_id.trim() : '';
  if (!watchId) {
    return res.status(400).json({ success: false, message: 'watch_id is required' });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { autoBuyEnabled: true },
    });
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    if (!user.autoBuyEnabled) {
      return res.status(409).json({ success: false, message: 'Auto-buy must be enabled before queuing a watch' });
    }

    const watch = await prisma.watchlist.findFirst({
      where: { id: watchId, userId: req.user!.id, status: 'active' },
      select: { id: true },
    });
    if (!watch) {
      return res.status(404).json({ success: false, message: 'Active price watch not found' });
    }

    const includeQueueWatch = {
      watchlist: {
        select: {
          id: true,
          targetPrice: true,
          product: { select: { id: true, name: true } },
        },
      },
    } satisfies Prisma.AutoBuyQueueItemInclude;
    const existingItem = await prisma.autoBuyQueueItem.findFirst({
      where: { watchlistId: watch.id, status: 'pending' },
      include: includeQueueWatch,
    });
    if (existingItem) {
      return res.status(200).json({ success: true, data: existingItem, deduplicated: true });
    }

    try {
      const queueItem = await prisma.autoBuyQueueItem.create({
        data: { watchlistId: watch.id },
        include: includeQueueWatch,
      });
      return res.status(201).json({ success: true, data: queueItem });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const pendingItem = await prisma.autoBuyQueueItem.findFirst({
          where: { watchlistId: watch.id, status: 'pending' },
          include: includeQueueWatch,
        });
        if (pendingItem) {
          return res.status(200).json({ success: true, data: pendingItem, deduplicated: true });
        }
      }
      throw error;
    }
  } catch (error) {
    return sendServerError(res, 'Unable to queue auto-buy watch', error);
  }
});

app.get('/api/agent/queue', requireAuth, requireRole(['buyer']), async (req: AuthenticatedRequest, res: Response) => {
  const requestedLimit = parseIntegerQuery(req.query.limit, 50, 1, 100);
  if (requestedLimit === null) {
    return res.status(400).json({ success: false, message: 'limit must be an integer from 1 to 100' });
  }

  try {
    const queueItems = await prisma.autoBuyQueueItem.findMany({
      where: { watchlist: { is: { userId: req.user!.id } } },
      orderBy: { createdAt: 'asc' },
      take: requestedLimit,
      include: {
        watchlist: {
          select: {
            id: true,
            targetPrice: true,
            product: { select: { id: true, name: true } },
          },
        },
      },
    });

    return res.json({ success: true, data: queueItems });
  } catch (error) {
    return sendServerError(res, 'Unable to fetch auto-buy queue', error);
  }
});

const executeAutoBuySandboxJob = async (userId: string, queueItemId: string) => {
  return prisma.$transaction(async (transaction) => {
    const includeExecutionDetails = {
      watchlist: {
        select: {
          id: true,
          status: true,
          targetPrice: true,
          product: {
            select: {
              id: true,
              listings: {
                where: { stock: { gt: 0 } },
                orderBy: { price: 'asc' },
                take: 1,
                select: { id: true, price: true },
              },
            },
          },
        },
      },
    } satisfies Prisma.AutoBuyQueueItemInclude;

    const queueItem = await transaction.autoBuyQueueItem.findFirst({
      where: {
        id: queueItemId,
        watchlist: { is: { userId } },
      },
      include: includeExecutionDetails,
    });
    if (!queueItem) {
      return { statusCode: 404, body: { success: false, message: 'Queue item not found' } };
    }
    if (queueItem.status === 'completed') {
      return { statusCode: 200, body: { success: true, data: queueItem, already_executed: true } };
    }
    if (queueItem.status !== 'pending') {
      return { statusCode: 409, body: { success: false, message: 'Queue item is not pending' } };
    }

    const user = await transaction.user.findUnique({
      where: { id: userId },
      select: { autoBuyEnabled: true },
    });
    if (!user || !user.autoBuyEnabled) {
      return { statusCode: 409, body: { success: false, message: 'Auto-buy must remain enabled to execute this sandbox job' } };
    }
    if (queueItem.watchlist.status !== 'active') {
      return { statusCode: 409, body: { success: false, message: 'Price watch is no longer active' } };
    }

    const claimed = await transaction.autoBuyQueueItem.updateMany({
      where: { id: queueItem.id, status: 'pending' },
      data: { status: 'processing' },
    });
    if (claimed.count === 0) {
      const latestItem = await transaction.autoBuyQueueItem.findUnique({
        where: { id: queueItem.id },
        include: includeExecutionDetails,
      });
      if (latestItem?.status === 'completed') {
        return { statusCode: 200, body: { success: true, data: latestItem, already_executed: true } };
      }
      return { statusCode: 409, body: { success: false, message: 'Queue item is no longer pending' } };
    }

    const listing = queueItem.watchlist.product.listings[0];
    const targetPrice = queueItem.watchlist.targetPrice;
    const result = {
      sandbox: true,
      would_buy: Boolean(listing && listing.price <= targetPrice),
      reason: !listing
        ? 'no_available_listing'
        : listing.price <= targetPrice
          ? 'target_price_met'
          : 'price_above_target',
      evaluated_price: listing?.price ?? null,
      listing_id: listing?.id ?? null,
      target_price: targetPrice,
    };
    const completedItem = await transaction.autoBuyQueueItem.update({
      where: { id: queueItem.id },
      data: { status: 'completed', result },
      include: includeExecutionDetails,
    });

    return { statusCode: 200, body: { success: true, data: completedItem } };
  });
};

app.post('/api/agent/queue/:id/execute', requireAuth, requireRole(['buyer']), async (req: AuthenticatedRequest, res: Response) => {
  const queueItemId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

  try {
    const execution = await executeAutoBuySandboxJob(req.user!.id, queueItemId);
    return res.status(execution.statusCode).json(execution.body);
  } catch (error) {
    return sendServerError(res, 'Unable to execute auto-buy sandbox job', error);
  }
});

let isAutoBuyWorkerRunning = false;
const runAutoBuyWorker = async () => {
  if (isAutoBuyWorkerRunning) return;
  isAutoBuyWorkerRunning = true;

  try {
    const pendingItems = await prisma.autoBuyQueueItem.findMany({
      where: {
        status: 'pending',
        watchlist: {
          is: {
            status: 'active',
            user: { is: { autoBuyEnabled: true } },
          },
        },
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      take: AUTO_BUY_WORKER_BATCH_SIZE,
      select: {
        id: true,
        watchlist: { select: { userId: true } },
      },
    });

    let completedCount = 0;
    for (const item of pendingItems) {
      try {
        const execution = await executeAutoBuySandboxJob(item.watchlist.userId, item.id);
        if (execution.statusCode === 200 && !('already_executed' in execution.body)) {
          completedCount += 1;
        } else if (execution.statusCode !== 200 && execution.statusCode !== 409) {
          console.error('Auto-buy sandbox worker could not process queue item:', {
            queueItemId: item.id,
            statusCode: execution.statusCode,
            message: execution.body.message,
          });
        }
      } catch (error) {
        console.error('Auto-buy sandbox worker failed to process queue item:', { queueItemId: item.id, error });
      }
    }

    if (completedCount > 0) {
      console.info(`Auto-buy sandbox worker completed ${completedCount} queue item(s).`);
    }
  } catch (error) {
    console.error('Auto-buy sandbox worker poll failed:', error);
  } finally {
    isAutoBuyWorkerRunning = false;
  }
};

const startAutoBuyWorker = () => {
  if (!AUTO_BUY_WORKER_ENABLED) {
    console.info('Auto-buy sandbox worker is disabled; set AUTO_BUY_WORKER_ENABLED=true to enable it.');
    return;
  }

  console.info(
    `Auto-buy sandbox worker enabled (interval=${AUTO_BUY_WORKER_INTERVAL_MS}ms, batch=${AUTO_BUY_WORKER_BATCH_SIZE}).`,
  );
  void runAutoBuyWorker();
  setInterval(() => void runAutoBuyWorker(), AUTO_BUY_WORKER_INTERVAL_MS);
};

app.get('/api/agent/history', requireAuth, requireRole(['buyer']), async (req: AuthenticatedRequest, res: Response) => {
  const limit = parseIntegerQuery(req.query.limit, 50, 1, 100);
  if (limit === null) {
    return res.status(400).json({ success: false, message: 'limit must be an integer from 1 to 100' });
  }

  try {
    const [watchlist, orders] = await Promise.all([
      prisma.watchlist.findMany({
        where: { userId: req.user!.id },
        orderBy: { createdAt: 'desc' },
        take: limit,
        include: {
          product: {
            select: {
              id: true,
              name: true,
              listings: {
                select: {
                  id: true,
                  price: true,
                  stock: true,
                  shop: { select: { name: true } },
                  priceHistory: {
                    orderBy: { recordedAt: 'desc' },
                    take: limit,
                    select: { id: true, price: true, recordedAt: true },
                  },
                },
              },
            },
          },
        },
      }),
      prisma.order.findMany({
        where: { buyerId: req.user!.id },
        orderBy: { createdAt: 'desc' },
        take: limit,
        select: {
          id: true,
          totalAmount: true,
          status: true,
          paymentMethod: true,
          createdAt: true,
          items: {
            select: { listingId: true, quantity: true, price: true },
          },
        },
      }),
    ]);

    return res.json({ success: true, data: { watchlist, orders } });
  } catch (error) {
    return sendServerError(res, 'Unable to fetch price agent history', error);
  }
});

app.post('/api/interactions', requireAuth, requireRole(['buyer']), async (req: AuthenticatedRequest, res: Response) => {
  const productId = typeof req.body?.productId === 'string' ? req.body.productId.trim() : '';
  const action = typeof req.body?.action === 'string' ? req.body.action : '';
  const allowedActions = ['view', 'click', 'cart', 'buy'];

  if (!productId || !allowedActions.includes(action)) {
    return res.status(400).json({
      success: false,
      message: 'productId and an action of view, click, cart or buy are required',
    });
  }

  try {
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { id: true },
    });

    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    const interaction = await prisma.interaction.create({
      data: {
        userId: req.user!.id,
        productId: product.id,
        action,
      },
    });

    return res.status(201).json({ success: true, data: interaction });
  } catch (error) {
    return sendServerError(res, 'Unable to log interaction', error);
  }
});

app.post('/api/search/sessions', optionalAuth, async (req: AuthenticatedRequest, res: Response) => {
  const queryText = typeof req.body?.queryText === 'string' ? req.body.queryText.trim() : '';
  const filters = req.body?.filters;

  if (!queryText || queryText.length > 500) {
    return res.status(400).json({ success: false, message: 'queryText is required and must be 500 characters or fewer' });
  }
  if (filters !== undefined && (filters === null || typeof filters !== 'object' || Array.isArray(filters))) {
    return res.status(400).json({ success: false, message: 'filters must be a JSON object' });
  }

  try {
    const session = await prisma.searchSession.create({
      data: {
        queryText,
        userId: req.user?.id,
        ...(filters !== undefined ? { filters } : {}),
      },
    });
    return res.status(201).json({ success: true, data: session });
  } catch (error) {
    return sendServerError(res, 'Unable to create search session', error);
  }
});

app.post('/api/search/sessions/:id/clicks', optionalAuth, async (req: AuthenticatedRequest, res: Response) => {
  const sessionId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const productId = typeof req.body?.productId === 'string' ? req.body.productId.trim() : '';

  if (!productId) {
    return res.status(400).json({ success: false, message: 'productId is required' });
  }

  try {
    const session = await prisma.searchSession.findUnique({ where: { id: sessionId } });
    if (!session) {
      return res.status(404).json({ success: false, message: 'Search session not found' });
    }
    if (session.userId && session.userId !== req.user?.id) {
      return res.status(403).json({ success: false, message: 'You do not have access to this search session' });
    }

    const products = await getProductData();
    if (!products.some((product) => product.id === productId)) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    const click = await prisma.searchClick.create({
      data: { sessionId: session.id, productId },
    });
    return res.status(201).json({ success: true, data: click });
  } catch (error) {
    return sendServerError(res, 'Unable to log search click', error);
  }
});

app.use((error: unknown, _req: Request, res: Response, next: NextFunction) => {
  if (res.headersSent) {
    return next(error);
  }

  if (error && typeof error === 'object' && 'type' in error) {
    const bodyParserError = error as { type?: string };
    if (bodyParserError.type === 'entity.too.large') {
      return res.status(413).json({ success: false, message: 'Request body exceeds the 100 KB limit' });
    }
    if (bodyParserError.type === 'entity.parse.failed') {
      return res.status(400).json({ success: false, message: 'Malformed JSON request body' });
    }
  }

  return sendServerError(res, 'Unhandled request error', error);
});

app.listen(PORT, () => {
  console.log(`🚀 Backend đang chạy tại http://localhost:${PORT}`);
  console.log(`📚 Swagger UI tại http://localhost:${PORT}/docs`);
  startAutoBuyWorker();
});