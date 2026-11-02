"use client";

import Link from "next/link";
import { Product } from "@/types";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ShoppingCart, TrendingDown, Sparkles, Eye, Users } from "lucide-react";
import ProductPrice from "@/components/shared/ProductPrice";
import ProductRating from "@/components/shared/ProductRating";
import { useCart } from "@/context/CartProvider";
import { logInteraction } from "@/lib/logInteraction";

interface ProductCardProps {
  product: Product;
  className?: string;
  explanation?: string;
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

export default function ProductCard({ product, className = "", explanation }: ProductCardProps) {
  const { addItem } = useCart();
  const imageUrl = getValidImageUrl(product);

  return (
    <Card className={`group relative flex flex-col overflow-hidden border border-zinc-200 rounded-2xl bg-white transition-all duration-300 hover:shadow-lg hover:-translate-y-1 ${className}`}>
      {/* Recommendation Badge (Clean Pill) */}
      {product.recommendationBadge && (
        <div className="absolute top-4 left-4 z-10">
          <span className="flex items-center gap-1.5 bg-zinc-900 text-white text-xs font-medium px-2.5 py-1 rounded-full shadow-sm">
            <BadgeIcon type={product.recommendationBadge.type} />
            {product.recommendationBadge.label}
          </span>
        </div>
      )}

      {/* Recommendation explanation badge (top-left pill) */}
      {explanation && (
        <div className="absolute top-4 left-4 z-10">
          <span
            className="flex items-center gap-1.5 bg-zinc-100 text-zinc-900 text-xs font-medium px-2.5 py-1 rounded-full shadow-sm border border-zinc-200"
            title={explanation}
          >
            <Sparkles className="h-3 w-3" />
            {explanation.length > 30 ? `${explanation.slice(0, 30)}…` : explanation}
          </span>
        </div>
      )}

      {/* Discount badge (Elegant Ribbon) */}
      {product.discountPercent > 0 && (
        <div className="absolute top-4 right-4 z-10">
          <span className="flex items-center justify-center bg-red-500 text-white text-xs font-bold px-2.5 py-1 rounded-full shadow-sm">
            -{product.discountPercent}%
          </span>
        </div>
      )}

      {/* Image Area */}
      <Link
        href={`/products/${product.id}`}
        onClick={() => logInteraction(product.id, "click")}
        className="flex-shrink-0"
      >
        <div className="aspect-square overflow-hidden bg-zinc-100">
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
            <div className="flex h-full w-full items-center justify-center bg-zinc-100 text-xs text-zinc-400">
              No Image
            </div>
          )}
        </div>
      </Link>

      <CardContent className="flex flex-1 flex-col gap-2 p-5 relative">
        {/* Category & Brand */}
        <div className="flex items-center gap-2 text-xs text-zinc-500 font-medium tracking-wide uppercase">
          <span className="truncate">{product.brand}</span>
          <span aria-hidden="true">·</span>
          <span className="truncate">{product.category}</span>
        </div>

        {/* Name */}
        <Link
          href={`/products/${product.id}`}
          onClick={() => logInteraction(product.id, "click")}
        >
          <h3 className="line-clamp-2 text-base font-bold leading-tight transition-colors hover:text-primary">
            {product.name}
          </h3>
        </Link>

        <ProductRating rating={product.rating} reviewCount={product.reviewCount} />

        {/* Price (Extra padding bottom to avoid overlap with hover button) */}
        <div className="mt-auto pt-2 pb-9 text-primary">
          <ProductPrice price={product.price} originalPrice={product.originalPrice} />
        </div>

        {/* Add to cart - Hidden by default, slides up on hover */}
        <div className="absolute bottom-5 left-5 right-5 translate-y-4 opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100 z-20">
          <Button
            onClick={(e) => {
              e.preventDefault();
              addItem(product);
            }}
            className="w-full gap-2 bg-zinc-900 text-white hover:bg-zinc-800 rounded-xl shadow-md transition-colors"
            size="sm"
          >
            <ShoppingCart className="h-4 w-4" />
            Thêm vào giỏ
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
