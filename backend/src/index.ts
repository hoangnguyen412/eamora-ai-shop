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
type Role = (typeof ALLOWED_ROLES)[number];

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
    const payload = jwt.verify(token, JWT_SECRET) as {
      sub?: string;
      email?: string;
      role?: string;
    };

    if (!payload.sub) {
      return res.status(401).json({ message: 'Invalid token payload' });
    }

    try {
      const user = await prisma.user.findUnique({
        where: { id: payload.sub },
      });

      if (user) {
        req.user = sanitizeUser(user);
        return next();
      }
    } catch (dbError) {
      console.warn('JWT auth database lookup failed, using token payload fallback:', dbError);
    }

    if (payload.email && payload.role) {
      req.user = {
        id: payload.sub,
        email: payload.email,
        role: payload.role,
        createdAt: new Date(),
      };
      return next();
    }

    return res.status(401).json({ message: 'User not found' });
  } catch (error) {
    return res.status(401).json({ message: 'Invalid or expired token', details: error });
  }
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
    return res.status(500).json({ success: false, message: 'Unable to fetch order history', details: error });
  }
});

app.post('/api/orders', requireAuth, requireRole(['buyer']), async (req: AuthenticatedRequest, res: Response) => {
  const rawItems = req.body?.items;
  const shippingInfo = req.body?.shipping_info ?? req.body?.shippingInfo;
  const paymentMethod = typeof req.body?.payment_method === 'string'
    ? req.body.payment_method
    : typeof req.body?.paymentMethod === 'string'
      ? req.body.paymentMethod
      : 'cod';

  if (!Array.isArray(rawItems) || rawItems.length === 0 || rawItems.length > 50) {
    return res.status(400).json({ success: false, message: 'Items must contain between 1 and 50 entries' });
  }

  const itemQuantities = new Map<string, number>();
  for (const item of rawItems) {
    const listingId = typeof item?.listingId === 'string' ? item.listingId.trim() : '';
    const quantity = Number(item?.quantity);
    if (!listingId || !Number.isInteger(quantity) || quantity < 1) {
      return res.status(400).json({ success: false, message: 'Each item requires a listingId and positive integer quantity' });
    }
    itemQuantities.set(listingId, (itemQuantities.get(listingId) ?? 0) + quantity);
  }

  const addressFields = ['fullName', 'phone', 'address', 'city'] as const;
  if (!shippingInfo || addressFields.some((field) => typeof shippingInfo[field] !== 'string' || !shippingInfo[field].trim())) {
    return res.status(400).json({ success: false, message: 'Shipping info requires fullName, phone, address and city' });
  }

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
          shippingInfo,
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
    return res.status(500).json({ success: false, message: 'Unable to create order', details: error });
  }
});

app.get('/api/orders/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const orderId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const order = await prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    const orderItems = await prisma.orderItem.findMany({ where: { orderId: order.id } });

    if (req.user?.role === 'buyer' && order.buyerId === req.user.id) {
      return res.json({ success: true, data: { ...order, items: orderItems } });
    }

    if (req.user?.role === 'seller') {
      const listingIds = orderItems.map((item) => item.listingId);
      const ownedListings = await prisma.listing.findMany({
        where: { id: { in: listingIds }, shop: { sellerId: req.user.id } },
        select: { id: true },
      });
      if (ownedListings.length === listingIds.length) {
        return res.json({ success: true, data: { ...order, items: orderItems } });
      }
    }

    return res.status(403).json({ success: false, message: 'You do not have access to this order' });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Unable to fetch order', details: error });
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
    return res.status(500).json({ success: false, message: 'Unable to update order status', details: error });
  }
});

app.get('/api/seller/listings', requireAuth, requireRole(['seller']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const shop = await prisma.shop.findFirst({
      where: { sellerId: req.user?.id ?? '' },
      include: {
        listings: {
          include: {
            product: true,
          },
        },
      },
    });

    return res.json({ success: true, data: shop?.listings ?? [] });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes('ECONNREFUSED') || message.includes('connect') || message.includes('database')) {
      return res.json({ success: true, data: [] });
    }
    return res.status(500).json({ success: false, message: 'Unable to fetch seller listings', details: error });
  }
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
    return res.status(500).json({ success: false, message: 'Unable to log interaction', details: error });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Backend đang chạy tại http://localhost:${PORT}`);
  console.log(`📚 Swagger UI tại http://localhost:${PORT}/docs`);
});