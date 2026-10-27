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
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 space-y-12">
      {/* Hero Carousel */}
      <section>
        <ProductCarousel products={featuredProducts} />
      </section>

      {/* Feature highlights */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { icon: Sparkles, title: "AI Tư Vấn", desc: "Chatbot thông minh", color: "from-violet-500 to-indigo-500" },
          { icon: TrendingUp, title: "Price Agent", desc: "Theo dõi biến động giá", color: "from-emerald-500 to-teal-500" },
          { icon: Zap, title: "Tìm Kiếm AI", desc: "Hiểu ngôn ngữ tự nhiên", color: "from-amber-500 to-orange-500" },
          { icon: ShieldCheck, title: "Uy Tín", desc: "Bảo hành chính hãng", color: "from-blue-500 to-cyan-500" },
        ].map((f) => (
          <Card key={f.title} className="border-0 shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="flex items-center gap-3 p-4">
              <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${f.color}`}>
                <f.icon className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="text-sm font-semibold">{f.title}</p>
                <p className="text-xs text-muted-foreground">{f.desc}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </section>

      {/* AI Recommendations */}
      <section className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-indigo-500">
            <Sparkles className="h-5 w-5 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold">AI Gợi Ý Cho Bạn</h2>
            <p className="text-sm text-muted-foreground">Được cá nhân hóa bởi AI dựa trên lịch sử tìm kiếm</p>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {recommendations.map((rec) => (
            <Link key={rec.id} href={`/products/${rec.id}`}>
              <Card className="group overflow-hidden hover:shadow-lg transition-all hover:-translate-y-1">
                <div className="aspect-square overflow-hidden bg-muted/50">
                  <Image
                    src={rec.thumbnailUrl}
                    alt={rec.name}
                    width={300}
                    height={300}
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                    unoptimized
                  />
                </div>
                <CardContent className="p-3 space-y-1.5">
                  <Badge variant="secondary" className="text-[10px] gap-1">
                    <Sparkles className="h-2.5 w-2.5" />
                    {rec.recommendationBadge.label}
                  </Badge>
                  <h3 className="text-sm font-semibold line-clamp-2">{rec.name}</h3>
                  <p className="text-sm font-bold text-primary">{formatPrice(rec.price)}</p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </section>

      {/* All Products */}
      <section className="space-y-6">
        <div>
          <h2 className="text-xl font-bold">Tất Cả Sản Phẩm</h2>
          <p className="text-sm text-muted-foreground">Khám phá bộ sưu tập công nghệ mới nhất</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </section>
    </div>
  );
}
