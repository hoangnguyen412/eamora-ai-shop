"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import ProductCard from "@/components/shared/ProductCard";
import { Button } from "@/components/ui/button";
import { Product } from "@/types";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Sparkles, TrendingUp, Zap, ShieldCheck } from "lucide-react";
import { useAuth } from "@/context/AuthProvider";
import HeroBanner from "@/components/layout/HeroBanner";
import FeatureBadges from "@/components/layout/FeatureBadges";

const API_BASE_URL = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000").replace(/\/$/, "");

// Shape của payload trả về từ GET /api/recommendations (data[].products)
interface RecommendationItem {
  id: string;
  name: string;
  basePrice: number | null;
  imageUrl: string | null;
  brand: string | null;
  categoryName: string | null;
  rating: number | null;
  reviewCount: number | null;
  originalPrice: number | null;
  discountPercent: number | null;
  stock: number | null;
  explanation: string;
  score: number | null;
}

function toProduct(rec: RecommendationItem): Product {
  const price = rec.basePrice ?? 0;
  const imageUrl = rec.imageUrl ?? "";
  return {
    id: rec.id,
    name: rec.name,
    slug: rec.name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
    brand: rec.brand ?? "Brand",
    category: rec.categoryName ?? "General",
    price,
    originalPrice: rec.originalPrice ?? price,
    discountPercent: rec.discountPercent ?? 0,
    stock: rec.stock ?? 0,
    rating: rec.rating ?? 0,
    reviewCount: rec.reviewCount ?? 0,
    images: imageUrl ? [imageUrl] : [],
    thumbnailUrl: imageUrl,
    isFeatured: false,
    specs: {},
    recommendationBadge: undefined,
    explanation: rec.explanation,
    createdAt: new Date().toISOString(),
  };
}

async function fetchJson(path: string, init?: RequestInit): Promise<unknown> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(`${API_BASE_URL}${path}`, { ...init, signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  } finally {
    clearTimeout(timeout);
  }
}

function SkeletonCard() {
  return (
    <Card className="h-full overflow-hidden">
      <div className="aspect-square bg-zinc-200 animate-pulse" />
      <div className="p-4 space-y-2">
        <div className="h-4 bg-zinc-200 animate-pulse rounded w-3/4" />
        <div className="h-4 bg-zinc-200 animate-pulse rounded w-1/2" />
        <div className="h-8 bg-zinc-200 animate-pulse rounded mt-auto" />
      </div>
    </Card>
  );
}

export default function HomePage() {
  const { token, isLoading: authLoading } = useAuth();

  const [products, setProducts] = useState<Product[]>([]);
  const [recommendations, setRecommendations] = useState<Product[]>([]);
  const [loading, setLoading] = useState({ products: true, recommendations: true });
  const [errorProducts, setErrorProducts] = useState(false);
  const [errorRecommendations, setErrorRecommendations] = useState(false);
  const [recSource, setRecSource] = useState<'ai' | 'popular' | null>(null);

  const loadProducts = useCallback(async () => {
    setLoading((prev) => ({ ...prev, products: true }));
    setErrorProducts(false);
    try {
      const result = (await fetchJson("/api/products?limit=20")) as {
        success?: boolean;
        data?: Product[];
      };
      setProducts(result.success && result.data ? result.data : []);
    } catch {
      setProducts([]);
      setErrorProducts(true);
    } finally {
      setLoading((prev) => ({ ...prev, products: false }));
    }
  }, []);

  const loadRecommendations = useCallback(async () => {
    setLoading((prev) => ({ ...prev, recommendations: true }));
    setErrorRecommendations(false);
    try {
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;
      // Có token → personalized từ AI service; chưa login → popular products công khai.
      const path = token ? "/api/recommendations?limit=12" : "/api/products?limit=12";
      const result = (await fetchJson(path, { headers })) as {
        success?: boolean;
        data?: unknown[];
        source?: string;
      };
      const items = result.success && result.data ? result.data : [];
      if (token) {
        // Có token → personalized từ AI service (source = "ai") hoặc popular fallback (source = "popular").
        setRecSource((result.source === 'popular' ? 'popular' : 'ai') as 'ai' | 'popular');
        setRecommendations((items as RecommendationItem[]).map(toProduct));
      } else {
        // Chưa login → popular products công khai. Gán explanation để badge hiển thị.
        setRecSource('popular');
        setRecommendations((items as Product[]).map((p) => ({ ...p, explanation: 'Sản phẩm phổ biến' })));
      }
    } catch {
      setRecommendations([]);
      setErrorRecommendations(true);
    } finally {
      setLoading((prev) => ({ ...prev, recommendations: false }));
    }
  }, [token]);

  useEffect(() => {
    loadProducts();
    // Chờ auth restore xong (token đã có giá trị) mới gọi recommendations,
    // tránh gọi sai endpoint popular rồi mới gọi personalized.
    if (!authLoading) {
      loadRecommendations();
    }
  }, [loadProducts, loadRecommendations, authLoading]);

  const featuredProducts = [...products]
    .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))
    .slice(0, 4);

  return (
    <div className="mx-auto max-w-7xl space-y-16 px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
      <h1 className="sr-only">Cửa hàng Eamora — khám phá sản phẩm công nghệ</h1>

      <HeroBanner />
      <FeatureBadges />

      {/* Sản phẩm nổi bật */}
      <section id="products" aria-labelledby="products-heading">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div>
            <h2 id="products-heading" className="text-2xl font-bold tracking-tight sm:text-3xl">Sản phẩm nổi bật</h2>
            <p className="text-sm text-muted-foreground mt-1">Các thiết bị công nghệ hàng đầu được chọn lọc</p>
          </div>
          <Link href="/search?sort=featured" className="text-sm font-medium text-primary hover:underline underline-offset-4">
            Xem tất cả ›
          </Link>
        </div>
        {loading.products ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8">
            {[1, 2, 3, 4].map((i) => <SkeletonCard key={i} />)}
          </div>
        ) : errorProducts ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <Alert variant="destructive" className="max-w-md w-full">
              <AlertTitle>Không tải được sản phẩm</AlertTitle>
              <AlertDescription>Không thể kết nối đến máy chủ. Vui lòng thử lại.</AlertDescription>
            </Alert>
            <Button variant="outline" onClick={loadProducts}>Thử lại</Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8">
            {featuredProducts.map((product) => (
              <ProductCard key={product.id} product={product} className="h-full" />
            ))}
          </div>
        )}
      </section>

      {/* Feature highlights */}
      <section className="grid grid-cols-2 gap-4 md:grid-cols-4 md:gap-6">
        {[
          { icon: Sparkles, title: "AI Tư Vấn", desc: "Tìm hiểu cùng trợ lý", color: "from-zinc-700 to-zinc-900" },
          { icon: TrendingUp, title: "Price Agent", desc: "Theo dõi giá sản phẩm", color: "from-zinc-700 to-zinc-900" },
          { icon: Zap, title: "Tìm Kiếm", desc: "Lọc theo nhu cầu", color: "from-zinc-700 to-zinc-900" },
          { icon: ShieldCheck, title: "Mua sắm dễ dàng", desc: "So sánh nhiều lựa chọn", color: "from-zinc-700 to-zinc-900" },
        ].map((f) => (
          <Card key={f.title} className="border border-zinc-200 rounded-2xl shadow-sm transition-shadow hover:shadow-md">
            <CardContent className="flex flex-col sm:flex-row items-start sm:items-center gap-4 p-4 sm:p-5">
              <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${f.color}`}>
                <f.icon className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="text-sm font-bold">{f.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{f.desc}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </section>

      {/* Gợi ý cá nhân hóa / Sản phẩm phổ biến */}
      <section className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-900">
            <Sparkles className="h-5 w-5 text-white" />
          </div>
          <div>
            {recSource === 'ai' ? (
              <>
                <h2 className="text-2xl font-bold tracking-tight">Gợi ý cá nhân hóa</h2>
                <p className="text-sm text-muted-foreground mt-1">Dành riêng cho phong cách của bạn</p>
              </>
            ) : (
              <>
                <h2 className="text-2xl font-bold tracking-tight">Sản phẩm phổ biến</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Hiện khi dịch vụ gợi ý AI chưa sẵn sàng hoặc bạn chưa đăng nhập
                </p>
              </>
            )}
          </div>
        </div>

        {loading.recommendations ? (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4 sm:gap-6">
            {[1, 2, 3, 4].map((i) => <SkeletonCard key={i} />)}
          </div>
        ) : errorRecommendations ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <Alert variant="destructive" className="max-w-md w-full">
              <AlertTitle>Không tải được gợi ý</AlertTitle>
              <AlertDescription>Không thể kết nối đến máy chủ. Vui lòng thử lại.</AlertDescription>
            </Alert>
            <Button variant="outline" onClick={loadRecommendations}>Thử lại</Button>
          </div>
        ) : recommendations.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">Không có gợi ý phù hợp</div>
        ) : (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4 sm:gap-6">
            {recommendations.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                explanation={product.explanation}
                className="h-full"
              />
            ))}
          </div>
        )}
      </section>

      {/* Khám phá sản phẩm (All Products) */}
      <section className="space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Khám phá sản phẩm</h2>
            <p className="text-sm text-muted-foreground mt-1">Tìm thiết bị phù hợp với nhu cầu của bạn</p>
          </div>
          <Link href="/search" className="text-sm font-medium text-primary hover:underline underline-offset-4">
            Xem tất cả
          </Link>
        </div>
        {loading.products ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8">
            {[1, 2, 3, 4].map((i) => <SkeletonCard key={i} />)}
          </div>
        ) : errorProducts ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <Alert variant="destructive" className="max-w-md w-full">
              <AlertTitle>Không tải được sản phẩm</AlertTitle>
              <AlertDescription>Không thể kết nối đến máy chủ. Vui lòng thử lại.</AlertDescription>
            </Alert>
            <Button variant="outline" onClick={loadProducts}>Thử lại</Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} className="h-full" />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
