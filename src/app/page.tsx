"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import ProductCard from "@/components/shared/ProductCard";
import { Button } from "@/components/ui/button";
import { Product } from "@/types";
import { Card } from "@/components/ui/card";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import {
  Sparkles,
  Smartphone,
  Laptop,
  ArrowRight,
  ShieldCheck,
  Truck,
  RotateCcw,
  Wrench,
} from "lucide-react";
import { useAuth } from "@/context/AuthProvider";
// Hero renders are bundled locally so the LCP image never waits on a third-party
// CDN (DNS + TLS + cold remote optimizer fetch). Static imports also give Next
// the intrinsic size and a blur placeholder at build time.
import heroLaptop from "@/assets/hero/laptop.webp";
import heroPhone from "@/assets/hero/phone.webp";
import heroWatch from "@/assets/hero/watch.webp";

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

const departments = [
  { icon: Smartphone, title: "Điện thoại", href: "/search?category=Smartphone" },
  { icon: Laptop, title: "Laptop", href: "/search?category=Laptop" },
];

const faqs = [
  {
    q: "Sản phẩm có phải hàng chính hãng không?",
    a: "Tất cả sản phẩm đều có nguồn gốc rõ ràng, đi kèm bảo hành chính hãng. Nếu phát hiện hàng giả, bạn được hoàn tiền 100%.",
  },
  {
    q: "Đổi trả trong bao lâu?",
    a: "Bạn có 7 ngày để đổi trả nếu sản phẩm lỗi kỹ thuật, không cần lý do. Sản phẩm cần còn đủ hộp và phụ kiện.",
  },
  {
    q: "Price Agent hoạt động thế nào?",
    a: "Price Agent theo dõi giá thực tế của sản phẩm bạn quan tâm và thông báo khi giá chạm ngưỡng mong muốn.",
  },
  {
    q: "Có hỗ trợ thu cũ đổi mới không?",
    a: "Có. Thiết bị cũ được định giá theo tình trạng thực tế và trừ trực tiếp vào đơn hàng mới.",
  },
];

function SkeletonCard() {
  return (
    <Card className="h-full overflow-hidden">
      <div className="aspect-square animate-pulse bg-gray-100" />
      <div className="space-y-2 p-4">
        <div className="h-3 w-3/4 animate-pulse rounded bg-gray-100" />
        <div className="h-3 w-1/2 animate-pulse rounded bg-gray-100" />
        <div className="mt-3 h-8 animate-pulse rounded-full bg-gray-100" />
      </div>
    </Card>
  );
}

function SectionHeading({
  id,
  title,
  desc,
  href,
  hrefLabel = "Xem tất cả",
}: {
  id?: string;
  title: string;
  desc?: string;
  href?: string;
  hrefLabel?: string;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h2 id={id} className="font-heading text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">
          {title}
        </h2>
        {desc && <p className="mt-1.5 text-sm text-gray-500">{desc}</p>}
      </div>
      {href && (
        <Link
          href={href}
          className="inline-flex items-center gap-1 rounded-full text-sm font-semibold text-blue-600 transition-colors duration-200 hover:text-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
        >
          {hrefLabel}
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      )}
    </div>
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
      // 12 là đủ cho lưới trang chủ; giảm số DOM node + ảnh phải xử lý lúc tải.
      const result = (await fetchJson("/api/products?limit=12")) as {
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
      const path = token ? "/api/recommendations?limit=8" : "/api/products?limit=8";
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
    <div className="bg-white">
      {/* Preload LCP image ngay từ <head> — không chờ parser tới <body>. */}
      <link
        rel="preload"
        as="image"
        href={heroLaptop.src}
        type="image/webp"
        fetchPriority="high"
      />
      <div className="mx-auto max-w-7xl space-y-16 px-4 py-8 sm:px-6 sm:py-10 lg:space-y-20 lg:px-8">
        <h1 className="sr-only">Amora — cửa hàng công nghệ chính hãng</h1>

        {/* ============ HERO ============ */}
        <section aria-labelledby="hero-heading" className="relative">
          <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-12">
            <div className="max-w-xl">
              <h1
                id="hero-heading"
                className="mt-5 font-heading text-4xl font-bold leading-[1.08] tracking-tight text-gray-900 sm:text-5xl lg:text-6xl"
              >
                Công nghệ phù hợp.
                <br />
                <span className="text-blue-600">Giá thật.</span> Không thổi phồng.
              </h1>

              <p className="mt-5 max-w-md text-base leading-relaxed text-gray-600">
                Điện thoại và laptop — được chọn theo nhu cầu thực tế, tư vấn minh
                bạch và bảo hành rõ ràng.
              </p>

              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Link
                  href="/search"
                  className="inline-flex h-12 items-center gap-2 rounded-full bg-blue-600 px-7 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:scale-[1.02] hover:bg-blue-700 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                >
                  Khám phá cửa hàng
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
                <Link
                  href="/watchlist"
                  className="inline-flex h-12 items-center rounded-full border border-gray-300 bg-white px-6 text-sm font-semibold text-gray-800 transition-all duration-200 hover:scale-[1.02] hover:border-blue-600 hover:text-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                >
                  Theo dõi giá
                </Link>
              </div>

              <dl className="mt-10 grid max-w-md grid-cols-3 gap-4 border-t border-gray-100 pt-6">
                <div>
                  <dt className="text-xs text-gray-500">Bảo hành</dt>
                  <dd className="font-heading text-lg font-bold text-gray-900">24 tháng</dd>
                </div>
                <div>
                  <dt className="text-xs text-gray-500">Đổi trả</dt>
                  <dd className="font-heading text-lg font-bold text-gray-900">7 ngày</dd>
                </div>
                <div>
                  <dt className="text-xs text-gray-500">Hỗ trợ</dt>
                  <dd className="font-heading text-lg font-bold text-gray-900">24/7</dd>
                </div>
              </dl>
            </div>

            {/* Illustration composition — 3D product renders with drop shadow */}
            <div className="relative">
              <div className="relative mx-auto aspect-[4/3] w-full max-w-lg rounded-2xl bg-gray-50 bg-grid-soft">
                {/* Laptop — LCP image: bundled WebP, preloaded, ảnh tĩnh thuần <img> */}
                <img
                  src={heroLaptop.src}
                  alt="Laptop được chọn lọc tại Amora"
                  width={heroLaptop.width}
                  height={heroLaptop.height}
                  fetchPriority="high"
                  loading="eager"
                  decoding="sync"
                  className="device-shadow absolute left-1/2 top-1/2 z-10 w-[68%] -translate-x-1/2 -translate-y-[58%] rounded-xl object-cover"
                />
                {/* Phone */}
                <img
                  src={heroPhone.src}
                  alt="Điện thoại thông minh"
                  width={heroPhone.width}
                  height={heroPhone.height}
                  decoding="async"
                  className="device-shadow-sm absolute -bottom-2 right-4 z-20 w-[26%] rotate-3 rounded-xl object-cover"
                />
                {/* Watch */}
                <img
                  src={heroWatch.src}
                  alt="Đồng hồ thông minh"
                  width={heroWatch.width}
                  height={heroWatch.height}
                  decoding="async"
                  className="device-shadow-sm absolute -left-2 bottom-4 z-20 w-[24%] -rotate-6 rounded-xl object-cover"
                />
              </div>
            </div>
          </div>
        </section>

        {/* ============ DEPARTMENTS ============ */}
        <section aria-labelledby="departments-heading">
          <SectionHeading
            id="departments-heading"
            title="Mua theo danh mục"
          />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {departments.map((dept) => (
              <Link
                key={dept.title}
                href={dept.href}
                className="group flex flex-col items-start gap-3 rounded-xl border border-gray-200 bg-white p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-gray-100 text-gray-700 transition-colors duration-200 group-hover:bg-blue-50 group-hover:text-blue-600">
                  <dept.icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <span className="font-heading text-sm font-semibold text-gray-900">
                  {dept.title}
                </span>
              </Link>
            ))}
          </div>
        </section>

        {/* ============ STAFF PICKS / FEATURED ============ */}
        <section id="products" aria-labelledby="products-heading">
          <SectionHeading
            id="products-heading"
            title="Sản phẩm nổi bật"
            desc="Thiết bị được chọn lọc — giá và tình trạng tồn kho hiển thị thật."
            href="/search?sort=featured"
            hrefLabel="Xem tất cả"
          />
          {loading.products ? (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {[1, 2, 3, 4].map((i) => <SkeletonCard key={i} />)}
            </div>
          ) : errorProducts ? (
            <div className="flex flex-col items-center justify-center gap-3 py-12">
              <Alert variant="destructive" className="w-full max-w-md rounded-xl">
                <AlertTitle>Không tải được sản phẩm</AlertTitle>
                <AlertDescription>Không thể kết nối đến máy chủ. Vui lòng thử lại.</AlertDescription>
              </Alert>
              <Button variant="outline" onClick={loadProducts}>Thử lại</Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {featuredProducts.map((product) => (
                <ProductCard key={product.id} product={product} className="h-full" />
              ))}
            </div>
          )}
        </section>

        {/* ============ SERVICE PROMISES ============ */}
        <section aria-label="Cam kết mua sắm" className="grid grid-cols-2 gap-3 rounded-xl border border-gray-200 bg-gray-50 p-4 sm:p-5 md:grid-cols-4">
          {[
            { icon: Truck, title: "Miễn phí vận chuyển", desc: "Đơn từ 500.000đ" },
            { icon: ShieldCheck, title: "Hàng chính hãng", desc: "Bảo hành 24 tháng" },
            { icon: RotateCcw, title: "Đổi trả 7 ngày", desc: "Không cần lý do" },
            { icon: Wrench, title: "Hỗ trợ kỹ thuật", desc: "Tư vấn 24/7" },
          ].map((f) => (
            <div key={f.title} className="flex items-center gap-3 rounded-lg bg-white p-3 transition-shadow duration-200 hover:shadow-sm">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                <f.icon className="h-4 w-4" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-gray-900">{f.title}</p>
                <p className="truncate text-xs text-gray-500">{f.desc}</p>
              </div>
            </div>
          ))}
        </section>

        {/* ============ RECOMMENDATIONS ============ */}
        <section className="space-y-6">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-600 text-white">
              <Sparkles className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              {recSource === 'ai' ? (
                <>
                  <h2 className="font-heading text-2xl font-bold tracking-tight text-gray-900">Gợi ý cá nhân hóa</h2>
                  <p className="mt-1 text-sm text-gray-500">Dành riêng cho phong cách của bạn</p>
                </>
              ) : (
                <>
                  <h2 className="font-heading text-2xl font-bold tracking-tight text-gray-900">Sản phẩm phổ biến</h2>
                  <p className="mt-1 text-sm text-gray-500">
                    Hiện khi dịch vụ gợi ý AI chưa sẵn sàng hoặc bạn chưa đăng nhập
                  </p>
                </>
              )}
            </div>
          </div>

          {loading.recommendations ? (
            <div className="grid grid-cols-2 gap-4 sm:gap-6 md:grid-cols-4">
              {[1, 2, 3, 4].map((i) => <SkeletonCard key={i} />)}
            </div>
          ) : errorRecommendations ? (
            <div className="flex flex-col items-center justify-center gap-3 py-12">
              <Alert variant="destructive" className="w-full max-w-md rounded-xl">
                <AlertTitle>Không tải được gợi ý</AlertTitle>
                <AlertDescription>Không thể kết nối đến máy chủ. Vui lòng thử lại.</AlertDescription>
              </Alert>
              <Button variant="outline" onClick={loadRecommendations}>Thử lại</Button>
            </div>
          ) : recommendations.length === 0 ? (
            <div className="py-12 text-center text-gray-500">Không có gợi ý phù hợp</div>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:gap-6 md:grid-cols-4">
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

        {/* ============ ALL PRODUCTS ============ */}
        <section className="space-y-6">
          <SectionHeading
            title="Khám phá sản phẩm"
            desc="Tìm thiết bị phù hợp với nhu cầu của bạn."
            href="/search"
            hrefLabel="Xem tất cả"
          />
          {loading.products ? (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {[1, 2, 3, 4].map((i) => <SkeletonCard key={i} />)}
            </div>
          ) : errorProducts ? (
            <div className="flex flex-col items-center justify-center gap-3 py-12">
              <Alert variant="destructive" className="w-full max-w-md rounded-xl">
                <AlertTitle>Không tải được sản phẩm</AlertTitle>
                <AlertDescription>Không thể kết nối đến máy chủ. Vui lòng thử lại.</AlertDescription>
              </Alert>
              <Button variant="outline" onClick={loadProducts}>Thử lại</Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {products.map((product) => (
                <ProductCard key={product.id} product={product} className="h-full" />
              ))}
            </div>
          )}
        </section>

        {/* ============ CTA BAND ============ */}
        <section className="overflow-hidden rounded-xl bg-blue-600 px-6 py-12 text-center sm:px-10 lg:py-14">
          <h2 className="font-heading text-2xl font-bold tracking-tight text-white sm:text-3xl">
            Sẵn sàng chọn thiết bị tiếp theo?
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-blue-100 sm:text-base">
            Xem toàn bộ sản phẩm, so sánh giá thật và chọn thiết bị đúng nhu cầu.
          </p>
          <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/search"
              className="inline-flex h-12 items-center gap-2 rounded-full bg-white px-7 text-sm font-semibold text-blue-700 shadow-sm transition-all duration-200 hover:scale-[1.02] hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              Khám phá cửa hàng
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
            <Link
              href="/watchlist"
              className="inline-flex h-12 items-center rounded-full border border-white/40 px-6 text-sm font-semibold text-white transition-all duration-200 hover:scale-[1.02] hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              Bật Price Agent
            </Link>
          </div>
        </section>

        {/* ============ FAQ ============ */}
        <section aria-labelledby="faq-heading" className="mx-auto max-w-3xl">
          <div className="mb-6 text-center">
            <h2 id="faq-heading" className="font-heading text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">
              Câu hỏi thường gặp
            </h2>
            <p className="mt-2 text-sm text-gray-500">
              Những điều khách hàng hay hỏi trước khi mua.
            </p>
          </div>
          <div className="divide-y divide-gray-200 rounded-xl border border-gray-200">
            {faqs.map((faq) => (
              <details key={faq.q} className="group px-5 py-4">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded text-sm font-semibold text-gray-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 [&::-webkit-details-marker]:hidden">
                  {faq.q}
                  <span className="text-xl leading-none text-gray-400 transition-transform duration-200 group-open:rotate-45" aria-hidden="true">
                    +
                  </span>
                </summary>
                <p className="mt-3 text-sm leading-relaxed text-gray-600">{faq.a}</p>
              </details>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
