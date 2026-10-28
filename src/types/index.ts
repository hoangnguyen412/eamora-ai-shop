// ==========================================
// E-Commerce AI - TypeScript Type Definitions
// ==========================================

// ---------- User ----------
export interface User {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string;
  role: 'buyer' | 'seller' | 'admin';
  createdAt: string;
}

// ---------- Product ----------
export interface ProductSpecs {
  cpu?: string;
  ram?: string;
  storage?: string;
  display?: string;
  gpu?: string;
  battery?: string;
  weight?: string;
  os?: string;
  [key: string]: string | undefined;
}

export interface RecommendationBadge {
  type: 'frequently_viewed' | 'similar_user' | 'price_drop' | 'ai_pick';
  label: string;
}

export interface Product {
  id: string;
  name: string;
  slug: string;
  brand: string;
  category: string;
  price: number;
  originalPrice: number;
  discountPercent: number;
  stock: number;
  rating: number;
  reviewCount: number;
  images: string[];
  thumbnailUrl: string;
  isFeatured: boolean;
  specs: ProductSpecs;
  recommendationBadge?: RecommendationBadge;
  createdAt: string;
  offers?: ProductOffer[];
}

export interface ProductOffer {
  listingId: string;
  shopId: string;
  shopName: string;
  price: number;
  stock: number;
}

// ---------- Cart ----------
export interface CartItem {
  id: string;
  productId: string;
  product: Product;
  quantity: number;
  selectedPrice: number;
  listingId?: string;
  shopId?: string;
  shopName?: string;
}

export interface Cart {
  id: string;
  userId: string;
  items: CartItem[];
  subtotal: number;
  shippingFee: number;
  totalAmount: number;
}

// ---------- Order ----------
export interface ShippingAddress {
  fullName: string;
  phone: string;
  address: string;
  city: string;
}

export interface OrderItem {
  productId: string;
  productName: string;
  productImage: string;
  price: number;
  quantity: number;
}

export interface Order {
  id: string;
  userId: string;
  items: OrderItem[];
  totalAmount: number;
  status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  paymentMethod: 'cod' | 'vnpay' | 'credit_card';
  shippingAddress: ShippingAddress;
  createdAt: string;
}

// ---------- AI Search ----------
export interface ParsedConstraints {
  brand?: string;
  maxPrice?: number;
  minPrice?: number;
  minRam?: string;
  useCase?: string;
  category?: string;
}

export interface SearchResult {
  id: string;
  name: string;
  price: number;
  rating: number;
  thumbnailUrl: string;
  similarityScore: number;
  matchReason: string;
}

export interface AISearchResponse {
  success: boolean;
  parsedConstraints: ParsedConstraints;
  results: SearchResult[];
}

// ---------- AI Recommendation ----------
export interface Recommendation {
  id: string;
  name: string;
  price: number;
  thumbnailUrl: string;
  recommendationBadge: RecommendationBadge;
}

// ---------- AI Chat ----------
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  citedProducts?: CitedProduct[];
  groundednessScore?: number;
  timestamp: string;
}

export interface CitedProduct {
  id: string;
  name: string;
  price: number;
  thumbnailUrl: string;
}

// ---------- Price Agent ----------
export interface PriceHistoryPoint {
  date: string;
  price: number;
}

export interface PriceHistory {
  productId: string;
  currentPrice: number;
  lowestPrice: number;
  highestPrice: number;
  priceTrend: 'up' | 'down' | 'stable';
  history: PriceHistoryPoint[];
}

// ---------- Pagination ----------
export interface Pagination {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  limit: number;
}

// ---------- API Response ----------
export interface ApiResponse<T> {
  success: boolean;
  data: T;
  pagination?: Pagination;
}
