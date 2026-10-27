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
      <div className="grid md:grid-cols-2 gap-6 p-6 md:p-10 items-center min-h-[400px]">
        {/* Text side */}
        <div className="space-y-4 order-2 md:order-1">
          <Badge className="gap-1.5 bg-gradient-brand text-white border-0 shadow-lg">
            <Sparkles className="h-3 w-3" />
            Sản phẩm nổi bật
          </Badge>
          <h2 className="text-2xl md:text-3xl lg:text-4xl font-bold leading-tight">
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
          <div className="flex gap-3 pt-2">
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
        <div className="order-1 md:order-2 flex justify-center">
          <div className="relative w-full max-w-sm aspect-square">
            <Image
              src={product.thumbnailUrl}
              alt={product.name}
              fill
              className="object-cover rounded-xl shadow-2xl"
              unoptimized
            />
          </div>
        </div>
      </div>

      {/* Navigation arrows */}
      <Button
        variant="ghost"
        size="icon"
        className="absolute left-2 top-1/2 -translate-y-1/2 bg-background/80 backdrop-blur-sm rounded-full shadow-md hover:bg-background"
        onClick={prev}
      >
        <ChevronLeft className="h-5 w-5" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="absolute right-2 top-1/2 -translate-y-1/2 bg-background/80 backdrop-blur-sm rounded-full shadow-md hover:bg-background"
        onClick={next}
      >
        <ChevronRight className="h-5 w-5" />
      </Button>

      {/* Dots */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
        {products.map((_, i) => (
          <button
            key={i}
            onClick={() => setCurrent(i)}
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
