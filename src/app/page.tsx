"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import ProductCard from "@/components/shared/ProductCard";
import { Button } from "@/components/ui/button";
import { Product } from "@/types";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import {
  ArrowRight,
  ArrowUpRight,
  ShieldCheck,
  Truck,
  RotateCcw,
  Wrench,
} from "lucide-react";
import { useAuth } from "@/context/AuthProvider";
// Ảnh hero gói sẵn trong repo để LCP không phụ thuộc CDN ngoài.
import heroLaptop from "@/assets/hero/panel-laptop.jpg";
import heroPhone from "@/assets/hero/panel-phone.jpg";

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

const panels = [
  { title: "Laptop", cta: "Xem tất cả laptop", href: "/search?category=Laptop", img: heroLaptop, alt: "Laptop mở nắp, màn hình sáng rực trong phòng tối", delay: "0ms", imgClass: "group-hover:scale-[1.06]" },
  { title: "Điện thoại", cta: "Xem tất cả điện thoại", href: "/search?category=Smartphone", img: heroPhone, alt: "Điện thoại Samsung đặt trên hộp máy", delay: "150ms", imgClass: "origin-top-left scale-[1.4] group-hover:scale-[1.46]" },
] as const;

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
    <div className="h-full overflow-hidden border border-border bg-card">
      <div className="aspect-square animate-pulse bg-muted" />
      <div className="space-y-2 p-4">
        <div className="h-3 w-3/4 animate-pulse bg-muted" />
        <div className="h-3 w-1/2 animate-pulse bg-muted" />
        <div className="mt-3 h-8 animate-pulse bg-muted" />
      </div>
    </div>
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
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4 border-b border-border pb-5">
      <div>
        <h2 id={id} className="figure text-4xl leading-none sm:text-5xl">
          {title}
        </h2>
        {desc && <p className="mt-3 max-w-xl text-sm text-muted-foreground">{desc}</p>}
      </div>
      {href && (
        <Link
          href={href}
          className="group inline-flex items-center gap-1.5 text-sm font-semibold underline decoration-border underline-offset-[6px] transition-colors duration-200 hover:decoration-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          {hrefLabel}
          <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" aria-hidden="true" />
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


  const errorBlock = (title: string, onRetry: () => void) => (
    <div className="flex flex-col items-center justify-center gap-3 py-12">
      <Alert variant="destructive" className="w-full max-w-md rounded-[2px]">
        <AlertTitle>{title}</AlertTitle>
        <AlertDescription>Không thể kết nối đến máy chủ. Vui lòng thử lại.</AlertDescription>
      </Alert>
      <Button variant="outline" onClick={onRetry} className="rounded-[2px]">Thử lại</Button>
    </div>
  );

  const skeletons = (
    <div className="grid grid-cols-2 gap-3 sm:gap-6 lg:grid-cols-4">
      {[1, 2, 3, 4].map((i) => <SkeletonCard key={i} />)}
    </div>
  );

  return (
    <div className="bg-background">
      {/* ============ HERO: laptop & điện thoại ============ */}
      <section aria-labelledby="hero-heading" className="border-b border-border">
        <div className="mx-auto max-w-7xl px-4 pb-8 pt-8 sm:px-6 lg:px-8 lg:pb-12 lg:pt-12">
          <div className="grid items-end gap-6 lg:grid-cols-12 lg:gap-10">
            <h1
              id="hero-heading"
              className="figure text-[clamp(2.5rem,6.6vw,5.5rem)] font-bold leading-[1.05] [text-wrap:balance] lg:col-span-8"
            >
              Laptop và điện thoại chính hãng, <span className="text-brand">giá thật.</span>
            </h1>
            <div className="lg:col-span-4 lg:pb-2">
              <p className="max-w-sm text-base leading-relaxed text-muted-foreground">
                Chọn theo nhu cầu thực tế, tư vấn minh bạch, bảo hành 24 tháng và đổi trả trong 7 ngày.
              </p>
              <div className="mt-5 flex flex-wrap gap-3">
                <Link
                  href="/search"
                  className="group inline-flex h-11 items-center gap-2 bg-foreground px-6 text-sm font-semibold text-background transition-colors duration-200 hover:bg-brand hover:text-[#111315] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                >
                  Khám phá cửa hàng
                  <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" aria-hidden="true" />
                </Link>
                <Link
                  href="/watchlist"
                  className="inline-flex h-11 items-center border border-foreground px-5 text-sm font-semibold transition-colors duration-200 hover:bg-foreground hover:text-background focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                >
                  Theo dõi giá
                </Link>
              </div>
            </div>
          </div>

          <div className="mt-8 grid gap-3 md:grid-cols-2 lg:mt-10 lg:gap-4">
            {panels.map((panel) => (
              <Link
                key={panel.title}
                href={panel.href}
                style={{ animationDelay: panel.delay }}
                className="panel-enter group relative block aspect-[4/3] overflow-hidden bg-[#0e0f11] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring md:aspect-[5/4] lg:aspect-[16/11]"
              >
                <Image
                  src={panel.img}
                  alt={panel.alt}
                  fill
                  priority
                  placeholder="blur"
                  sizes="(min-width: 1280px) 600px, (min-width: 768px) 50vw, 100vw"
                  className={`object-cover transition-transform duration-[1400ms] ease-[cubic-bezier(0.16,1,0.3,1)] ${panel.imgClass}`}
                />
                {/* scrim: giữ chữ trắng đọc được trên mọi vùng ảnh */}
                <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-b from-black/55 via-transparent to-black/60" />
                <div className="label-enter absolute inset-0 flex flex-col justify-between p-5 text-white sm:p-8" style={{ animationDelay: `${500 + parseInt(panel.delay)}ms` }}>
                  <p className="figure text-5xl leading-none sm:text-7xl">{panel.title}</p>
                  <div className="flex items-end justify-between gap-4">
                    <p className="text-sm font-medium text-white/90 sm:text-base">{panel.cta}</p>
                    <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-brand text-[#111315] transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:-translate-y-1 group-hover:translate-x-1 sm:h-16 sm:w-16">
                      <ArrowUpRight className="h-6 w-6 sm:h-7 sm:w-7" aria-hidden="true" />
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl space-y-24 px-4 py-16 sm:px-6 lg:space-y-32 lg:px-8 lg:py-24">
        {/* ============ FEATURED ============ */}
        <section id="products" aria-labelledby="products-heading">
          <SectionHeading
            id="products-heading"
            title="Sản phẩm nổi bật"
            desc="Thiết bị được chọn lọc — giá và tình trạng tồn kho hiển thị thật."
            href="/search?sort=featured"
          />
          {loading.products ? skeletons : errorProducts ? errorBlock("Không tải được sản phẩm", loadProducts) : (
            <div className="grid grid-cols-2 gap-3 sm:gap-6 lg:grid-cols-4">
              {featuredProducts.map((product) => (
                <ProductCard key={product.id} product={product} className="h-full" />
              ))}
            </div>
          )}
        </section>

        {/* ============ SERVICE PROMISES ============ */}
        <section aria-label="Cam kết mua sắm">
          <ul className="grid grid-cols-2 border-y border-border md:grid-cols-4">
            {[
              { icon: Truck, title: "Miễn phí vận chuyển", desc: "Đơn từ 500.000đ" },
              { icon: ShieldCheck, title: "Hàng chính hãng", desc: "Bảo hành 24 tháng" },
              { icon: RotateCcw, title: "Đổi trả 7 ngày", desc: "Không cần lý do" },
              { icon: Wrench, title: "Hỗ trợ kỹ thuật", desc: "Tư vấn 24/7" },
            ].map((f, i) => (
              <li key={f.title} className={`flex flex-col gap-3 p-5 sm:p-6 ${i > 0 ? "md:border-l md:border-border" : ""} ${i % 2 === 1 ? "border-l border-border md:border-l" : ""} ${i > 1 ? "border-t border-border md:border-t-0" : ""}`}>
                <f.icon className="h-6 w-6" strokeWidth={1.5} aria-hidden="true" />
                <div>
                  <p className="text-base font-semibold">{f.title}</p>
                  <p className="text-sm text-muted-foreground">{f.desc}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>

        {/* ============ RECOMMENDATIONS ============ */}
        <section aria-labelledby="rec-heading">
          <SectionHeading
            id="rec-heading"
            title={recSource === "ai" ? "Gợi ý cá nhân hóa" : "Sản phẩm phổ biến"}
            desc={
              recSource === "ai"
                ? "Dành riêng cho phong cách của bạn"
                : "Hiện khi dịch vụ gợi ý AI chưa sẵn sàng hoặc bạn chưa đăng nhập"
            }
            href="/search"
          />
          {loading.recommendations ? skeletons : errorRecommendations ? errorBlock("Không tải được gợi ý", loadRecommendations) : recommendations.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">Không có gợi ý phù hợp</div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:gap-6 lg:grid-cols-4">
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

        {/* ============ CTA ============ */}
        <section className="bg-foreground px-6 py-16 text-background sm:px-12 lg:py-24">
          <h2 className="figure max-w-3xl text-[clamp(2.25rem,6vw,4.5rem)] font-extrabold leading-[0.96] [text-wrap:balance]">
            Sẵn sàng chọn thiết bị tiếp theo?
          </h2>
          <p className="mt-5 max-w-xl text-base leading-relaxed opacity-75">
            Xem toàn bộ sản phẩm, so sánh giá thật và chọn thiết bị đúng nhu cầu.
          </p>
          <div className="mt-9 flex flex-wrap items-center gap-3">
            <Link
              href="/search"
              className="group inline-flex h-12 items-center gap-2 bg-brand px-7 text-sm font-semibold text-[#111315] transition-colors duration-200 hover:bg-background focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            >
              Khám phá cửa hàng
              <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" aria-hidden="true" />
            </Link>
            <Link
              href="/watchlist"
              className="inline-flex h-12 items-center border border-background/50 px-6 text-sm font-semibold transition-colors duration-200 hover:border-background hover:bg-background hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            >
              Bật Price Agent
            </Link>
          </div>
        </section>

        {/* ============ FAQ ============ */}
        <section aria-labelledby="faq-heading" className="mx-auto max-w-3xl">
          <SectionHeading id="faq-heading" title="Câu hỏi thường gặp" desc="Những điều khách hàng hay hỏi trước khi mua." />
          <div className="border-t border-border">
            {faqs.map((faq) => (
              <details key={faq.q} className="group border-b border-border py-5">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-base font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring [&::-webkit-details-marker]:hidden">
                  {faq.q}
                  <span className="text-2xl leading-none text-muted-foreground transition-transform duration-300 group-open:rotate-45 group-open:text-brand" aria-hidden="true">
                    +
                  </span>
                </summary>
                <p className="mt-3 max-w-prose text-sm leading-relaxed text-muted-foreground">{faq.a}</p>
              </details>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
