"use client";

import Link from "next/link";
import Image from "next/image";
import { Product } from "@/types";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ShoppingCart, Sparkles } from "lucide-react";
import ProductPrice from "@/components/shared/ProductPrice";
import ProductRating from "@/components/shared/ProductRating";
import { useCart } from "@/context/CartProvider";
import { logInteraction } from "@/lib/logInteraction";

interface ProductCardProps {
  product: Product;
  className?: string;
  explanation?: string;
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
    <Card
      className={`group relative flex flex-col overflow-hidden rounded-xl border-gray-200 bg-white transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ${className}`}
    >
      {/* Real recommendation label — flat, one style only */}
      {product.recommendationBadge && (
        <div className="absolute left-3 top-3 z-10">
          <span className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-white/95 px-2.5 py-1 text-[11px] font-medium text-gray-700 shadow-sm">
            <Sparkles className="h-3 w-3 text-blue-600" aria-hidden="true" />
            {product.recommendationBadge.label}
          </span>
        </div>
      )}

      {/* AI explanation — subtle, not spammy */}
      {!product.recommendationBadge && explanation && (
        <div className="absolute left-3 top-3 z-10">
          <span
            className="inline-flex max-w-[calc(100%-1.5rem)] items-center gap-1 rounded-full border border-blue-100 bg-blue-50 px-2.5 py-1 text-[11px] font-medium text-blue-700"
            title={explanation}
          >
            <Sparkles className="h-3 w-3" aria-hidden="true" />
            <span className="truncate">
              {explanation.length > 26 ? `${explanation.slice(0, 26)}…` : explanation}
            </span>
          </span>
        </div>
      )}

      {/* Honest discount tag — flat pastel, never flashy red */}
      {product.discountPercent > 0 && (
        <div className="absolute right-3 top-3 z-10">
          <span className="inline-flex items-center rounded-full bg-gray-900 px-2.5 py-1 text-[11px] font-semibold text-white">
            -{product.discountPercent}%
          </span>
        </div>
      )}

      {/* Image Area */}
      <Link
        href={`/products/${product.id}`}
        onClick={() => logInteraction(product.id, "click")}
        className="flex-shrink-0 rounded-t-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
      >
        <div className="aspect-square overflow-hidden bg-gray-50 p-5 relative">
          {imageUrl ? (
            <Image
              src={imageUrl}
              alt={product.name}
              fill
              sizes="(max-width: 768px) 100vw, 200px"
              className="object-contain transition-transform duration-300 group-hover:scale-[1.03]"
              loading="lazy"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gray-100 text-xs text-gray-400">
              No Image
            </div>
          )}
        </div>
      </Link>

      <CardContent className="flex flex-1 flex-col gap-2 p-4">
        {/* Category & Brand */}
        <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-wide text-gray-400">
          <span className="truncate">{product.brand}</span>
          <span aria-hidden="true">·</span>
          <span className="truncate">{product.category}</span>
        </div>

        {/* Name */}
        <Link
          href={`/products/${product.id}`}
          onClick={() => logInteraction(product.id, "click")}
          className="rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
        >
          <h3 className="line-clamp-2 font-heading text-[15px] font-semibold leading-snug text-gray-900 transition-colors duration-200 hover:text-blue-600">
            {product.name}
          </h3>
        </Link>

        <ProductRating rating={product.rating} reviewCount={product.reviewCount} />

        {/* Price */}
        <div className="pt-1 text-gray-900">
          <ProductPrice price={product.price} originalPrice={product.originalPrice} />
        </div>

        {/* Static CTA — always visible */}
        <div className="mt-auto pt-3">
          <Button
            onClick={(e) => {
              e.preventDefault();
              addItem(product);
            }}
            className="w-full gap-2"
            size="sm"
          >
            <ShoppingCart className="h-4 w-4" aria-hidden="true" />
            Thêm vào giỏ
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
