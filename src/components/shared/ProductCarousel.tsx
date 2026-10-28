"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { Product } from "@/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, Sparkles } from "lucide-react";
import { formatPrice } from "@/lib/helpers";

interface ProductCarouselProps {
  products: Product[];
}

export default function ProductCarousel({ products }: ProductCarouselProps) {
  const [current, setCurrent] = useState(0);

  const next = useCallback(() => {
    setCurrent((prev) => (prev + 1) % products.length);
  }, [products.length]);

  const prev = useCallback(() => {
    setCurrent((prev) => (prev - 1 + products.length) % products.length);
  }, [products.length]);

  useEffect(() => {
    const timer = setInterval(next, 5000);
    return () => clearInterval(timer);
  }, [next]);

  if (products.length === 0) return null;
  const product = products[current];

  return (
    <div className="relative rounded-2xl overflow-hidden bg-gradient-to-br from-primary/10 via-background to-primary/5 border">
      <div className="grid items-center gap-5 p-5 sm:p-8 md:min-h-[400px] md:grid-cols-2 md:gap-8 md:p-10">
        {/* Text side */}
        <div className="order-1 space-y-4 md:order-1">
          <Badge className="gap-1.5 bg-gradient-brand text-white border-0 shadow-lg">
            <Sparkles className="h-3 w-3" />
            Sản phẩm nổi bật
          </Badge>
          <h2 className="text-2xl font-bold leading-tight sm:text-3xl lg:text-4xl">
            {product.name}
          </h2>
          <p className="text-muted-foreground text-sm md:text-base leading-relaxed">
            {product.specs.cpu && `${product.specs.cpu} • `}
            {product.specs.ram && `${product.specs.ram} • `}
            {product.specs.display && product.specs.display}
          </p>
          <div className="flex items-baseline gap-3">
            <span className="text-3xl font-bold text-primary">
              {formatPrice(product.price)}
            </span>
            {product.originalPrice > product.price && (
              <span className="text-lg text-muted-foreground line-through">
                {formatPrice(product.originalPrice)}
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-3 pt-2">
            <Link href={`/products/${product.id}`}>
              <Button className="bg-gradient-brand text-white hover:opacity-90">
                Xem chi tiết
              </Button>
            </Link>
            <Link href="/search">
              <Button variant="outline">Tìm sản phẩm</Button>
            </Link>
          </div>
        </div>

        {/* Image side */}
        <div className="order-2 flex justify-center md:order-2">
          <div className="relative aspect-[16/10] w-full max-w-sm overflow-hidden rounded-xl bg-muted/50 shadow-xl md:aspect-square">
            <Image
              src={product.thumbnailUrl}
              alt={product.name}
              fill
              className="rounded-xl object-cover"
              loading="eager"
              unoptimized
            />
          </div>
        </div>
      </div>

      {/* Navigation arrows */}
      <Button
        variant="ghost"
        size="icon"
        className="absolute left-auto right-14 top-5 rounded-full bg-background/90 shadow-md backdrop-blur-sm hover:bg-background md:left-2 md:right-auto md:top-1/2 md:-translate-y-1/2"
        onClick={prev}
        aria-label="Sản phẩm nổi bật trước"
      >
        <ChevronLeft className="h-5 w-5" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="absolute right-2 top-5 rounded-full bg-background/90 shadow-md backdrop-blur-sm hover:bg-background md:top-1/2 md:-translate-y-1/2"
        onClick={next}
        aria-label="Sản phẩm nổi bật tiếp theo"
      >
        <ChevronRight className="h-5 w-5" />
      </Button>

      {/* Dots */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
        {products.map((_, i) => (
          <button
            key={i}
            onClick={() => setCurrent(i)}
            aria-label={`Hiển thị sản phẩm nổi bật ${i + 1}`}
            aria-pressed={i === current}
            className={`h-2 rounded-full transition-all duration-300 ${
              i === current
                ? "w-6 bg-primary"
                : "w-2 bg-muted-foreground/30 hover:bg-muted-foreground/50"
            }`}
          />
        ))}
      </div>
    </div>
  );
}
