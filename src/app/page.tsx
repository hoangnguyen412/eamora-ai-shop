"use client";

import ProductCard from "@/components/shared/ProductCard";
import mockData from "@/mocks/db.json";
import { Product, Recommendation } from "@/types";
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
    <div className="mx-auto max-w-7xl space-y-16 px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
      <h1 className="sr-only">Cửa hàng Eamora — khám phá sản phẩm công nghệ</h1>

      {/* Featured Products - Uniform 4-Column Grid */}
      <section>
        <div className="mb-6">
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Sản phẩm nổi bật</h2>
          <p className="text-sm text-muted-foreground mt-1">Các thiết bị công nghệ hàng đầu được chọn lọc</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8">
          {featuredProducts.slice(0, 4).map((product) => (
            <ProductCard key={product.id} product={product} className="h-full" />
          ))}
        </div>
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

      {/* AI Recommendations */}
      <section className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-900">
            <Sparkles className="h-5 w-5 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Gợi ý cá nhân hóa</h2>
            <p className="text-sm text-muted-foreground mt-1">Dành riêng cho phong cách của bạn</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 md:grid-cols-4 sm:gap-6">
          {recommendations.slice(0, 4).map((rec) => (
            <Link key={rec.id} href={`/products/${rec.id}`} className="rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 block h-full">
              <Card className="group h-full overflow-hidden border border-zinc-200 rounded-2xl transition-all hover:-translate-y-1 hover:shadow-lg bg-white">
                <div className="aspect-square overflow-hidden bg-zinc-100 relative">
                  <span className="absolute top-3 left-3 z-10 flex items-center gap-1 bg-white/90 backdrop-blur-sm text-zinc-900 text-[10px] font-bold px-2 py-1 rounded-full shadow-sm">
                    <Sparkles className="h-3 w-3" />
                    {rec.recommendationBadge.label}
                  </span>
                  <Image
                    src={rec.thumbnailUrl}
                    alt={rec.name}
                    width={300}
                    height={300}
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    unoptimized
                  />
                </div>
                <CardContent className="space-y-1.5 p-4">
                  <h3 className="text-sm font-bold line-clamp-2 leading-tight">{rec.name}</h3>
                  <p className="text-sm font-bold text-primary sm:text-base">{formatPrice(rec.price)}</p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </section>

      {/* All Products */}
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} className="h-full" />
          ))}
        </div>
      </section>
    </div>
  );
}
