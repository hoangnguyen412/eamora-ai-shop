"use client";

import Link from "next/link";
import { Product } from "@/types";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ShoppingCart, TrendingDown, Sparkles, Eye, Users } from "lucide-react";
import ProductPrice from "@/components/shared/ProductPrice";
import ProductRating from "@/components/shared/ProductRating";
import { useCart } from "@/context/CartProvider";

interface ProductCardProps {
  product: Product;
}

function BadgeIcon({ type }: { type: string }) {
  switch (type) {
    case "ai_pick":
      return <Sparkles className="h-3 w-3" />;
    case "price_drop":
      return <TrendingDown className="h-3 w-3" />;
    case "frequently_viewed":
      return <Eye className="h-3 w-3" />;
    case "similar_user":
      return <Users className="h-3 w-3" />;
    default:
      return null;
  }
}

function getBadgeStyle(type: string): string {
  switch (type) {
    case "ai_pick":
      return "bg-gradient-to-r from-violet-500 to-indigo-500 text-white border-0 shadow-md";
    case "price_drop":
      return "bg-gradient-to-r from-rose-500 to-orange-500 text-white border-0 shadow-md";
    case "frequently_viewed":
      return "bg-gradient-to-r from-amber-500 to-yellow-500 text-white border-0 shadow-md";
    case "similar_user":
      return "bg-gradient-to-r from-emerald-500 to-teal-500 text-white border-0 shadow-md";
    default:
      return "";
  }
}

function getValidImageUrl(product: Product): string | null {
  const productRecord = product as unknown as Record<string, unknown>;
  const raw =
    product.thumbnailUrl ||
    (typeof productRecord.imageUrl === "string" ? productRecord.imageUrl : undefined) ||
    (typeof productRecord.image === "string" ? productRecord.image : undefined) ||
    product.images?.[0];

  if (!raw || typeof raw !== "string" || raw.trim() === "") {
    return null;
  }

  const trimmed = raw.trim();
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  }
  if (trimmed.startsWith("//")) {
    return `https:${trimmed}`;
  }
  return `https://${trimmed}`;
}

export default function ProductCard({ product }: ProductCardProps) {
  const { addItem } = useCart();
  const imageUrl = getValidImageUrl(product);

  return (
    <Card className="group relative overflow-hidden border-border/70 transition-all duration-300 hover:-translate-y-1 hover:border-primary/20 hover:shadow-xl hover:shadow-primary/5">
      {/* Recommendation Badge */}
      {product.recommendationBadge && (
        <div className="absolute top-3 left-3 z-10">
          <Badge className={`gap-1 text-[10px] font-medium px-2 py-0.5 ${getBadgeStyle(product.recommendationBadge.type)}`}>
            <BadgeIcon type={product.recommendationBadge.type} />
            {product.recommendationBadge.label}
          </Badge>
        </div>
      )}

      {/* Discount badge */}
      {product.discountPercent > 0 && (
        <div className="absolute top-3 right-3 z-10">
          <Badge variant="destructive" className="text-[10px] font-bold px-1.5 py-0.5">
            -{product.discountPercent}%
          </Badge>
        </div>
      )}

      {/* Image */}
      <Link href={`/products/${product.id}`}>
        <div className="aspect-square overflow-hidden bg-muted/50">
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={product.name}
              loading="lazy"
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
              onError={(e) => {
                (e.target as HTMLImageElement).src =
                  "https://placehold.co/400x400?text=No+Image";
              }}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-muted text-xs text-muted-foreground">
              No Image
            </div>
          )}
        </div>
      </Link>

      <CardContent className="flex h-[210px] flex-col gap-2 p-4">
        {/* Category & Brand */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="truncate">{product.brand}</span>
          <span aria-hidden="true">·</span>
          <span className="truncate">{product.category}</span>
        </div>

        {/* Name */}
        <Link href={`/products/${product.id}`}>
          <h3 className="line-clamp-2 text-sm font-semibold leading-snug transition-colors hover:text-primary">
            {product.name}
          </h3>
        </Link>

        <ProductRating rating={product.rating} reviewCount={product.reviewCount} />

        <div className="mt-auto">
          <ProductPrice price={product.price} originalPrice={product.originalPrice} />
        </div>

        {/* Add to cart */}
        <Button
          onClick={() => addItem(product)}
          className="w-full gap-2 bg-gradient-brand text-white transition-opacity hover:opacity-90"
          size="sm"
        >
          <ShoppingCart className="h-4 w-4" />
          Thêm vào giỏ
        </Button>
      </CardContent>
    </Card>
  );
}
