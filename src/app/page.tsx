"use client";

import ProductCard from "@/components/shared/ProductCard";
import ProductCarousel from "@/components/shared/ProductCarousel";
import mockData from "@/mocks/db.json";
import { Product, Recommendation } from "@/types";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Sparkles, TrendingUp, Zap, ShieldCheck } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { formatPrice } from "@/lib/helpers";

const products = mockData.products as unknown as Product[];
const recommendations = mockData.recommendations as unknown as Recommendation[];
const featuredProducts = products.filter((p) => p.isFeatured);

export default function HomePage() {
  return (
    <div className="mx-auto max-w-7xl space-y-12 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <h1 className="sr-only">Cửa hàng Eamora — khám phá sản phẩm công nghệ</h1>

      {/* Hero Carousel */}
      <section>
        <ProductCarousel products={featuredProducts} />
      </section>

      {/* Feature highlights */}
      <section className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
        {[
          { icon: Sparkles, title: "AI Tư Vấn", desc: "Tìm hiểu cùng trợ lý", color: "from-violet-500 to-indigo-500" },
          { icon: TrendingUp, title: "Price Agent", desc: "Theo dõi giá sản phẩm", color: "from-emerald-500 to-teal-500" },
          { icon: Zap, title: "Tìm Kiếm", desc: "Lọc theo nhu cầu", color: "from-amber-500 to-orange-500" },
          { icon: ShieldCheck, title: "Mua sắm dễ dàng", desc: "So sánh nhiều lựa chọn", color: "from-blue-500 to-cyan-500" },
        ].map((f) => (
          <Card key={f.title} className="border-border/70 shadow-sm transition-shadow hover:shadow-md">
            <CardContent className="flex items-center gap-3 p-3 sm:p-4">
              <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${f.color}`}>
                <f.icon className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="text-xs font-semibold sm:text-sm">{f.title}</p>
                <p className="text-[11px] text-muted-foreground sm:text-xs">{f.desc}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </section>

      {/* AI Recommendations */}
      <section className="space-y-5">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-indigo-500">
            <Sparkles className="h-5 w-5 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold sm:text-2xl">Gợi ý nổi bật</h2>
            <p className="text-sm text-muted-foreground">Một vài lựa chọn công nghệ đáng chú ý</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
          {recommendations.map((rec) => (
            <Link key={rec.id} href={`/products/${rec.id}`} className="rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <Card className="group h-full overflow-hidden transition-all hover:-translate-y-1 hover:shadow-lg">
                <div className="aspect-square overflow-hidden bg-muted/50">
                  <Image
                    src={rec.thumbnailUrl}
                    alt={rec.name}
                    width={300}
                    height={300}
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    unoptimized
                  />
                </div>
                <CardContent className="space-y-1.5 p-3 sm:p-4">
                  <Badge variant="secondary" className="text-[10px] gap-1">
                    <Sparkles className="h-2.5 w-2.5" />
                    {rec.recommendationBadge.label}
                  </Badge>
                  <h3 className="text-sm font-semibold line-clamp-2">{rec.name}</h3>
                  <p className="text-sm font-bold text-primary sm:text-base">{formatPrice(rec.price)}</p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </section>

      {/* All Products */}
      <section className="space-y-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold sm:text-2xl">Khám phá sản phẩm</h2>
            <p className="text-sm text-muted-foreground">Tìm thiết bị phù hợp với nhu cầu của bạn</p>
          </div>
          <Link href="/search" className="text-sm font-medium text-primary hover:underline">
            Xem tất cả
          </Link>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </section>
    </div>
  );
}
