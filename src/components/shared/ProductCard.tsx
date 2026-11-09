"use client";

import Link from "next/link";
import Image from "next/image";
import { Product } from "@/types";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ShoppingCart } from "lucide-react";
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
  const label = product.recommendationBadge?.label ?? explanation;

  return (
    <Card
      className={`group relative flex flex-col gap-0 overflow-hidden rounded-[2px] border border-border bg-card py-0 shadow-none ring-0 transition-colors duration-300 hover:border-foreground ${className}`}
    >
      {/* Image area: the device sits on the sheet, ruled off from its data */}
      <Link
        href={`/products/${product.id}`}
        onClick={() => logInteraction(product.id, "click")}
        className="relative block flex-shrink-0 border-b border-border focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
      >
        <div className="relative aspect-square overflow-hidden bg-background p-6">
          {imageUrl ? (
            <Image
              src={imageUrl}
              alt={product.name}
              fill
              sizes="(max-width: 768px) 50vw, 300px"
              className="object-contain p-1 transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:-translate-y-1 group-hover:scale-[1.04]"
              loading="lazy"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
              Chưa có ảnh
            </div>
          )}
        </div>

        {label && (
          <span
            className="absolute left-0 top-0 inline-flex max-w-[75%] items-center gap-1.5 border-b border-r border-border bg-card px-2.5 py-1.5 text-[11px] font-medium text-foreground"
            title={explanation}
          >
            <span className="h-1.5 w-1.5 shrink-0 bg-brand" aria-hidden="true" />
            <span className="truncate">
              {label.length > 26 ? `${label.slice(0, 26)}…` : label}
            </span>
          </span>
        )}

        {product.discountPercent > 0 && (
          <span className="absolute right-0 top-0 bg-brand px-2 py-1.5 text-[11px] font-bold text-[#111315]">
            -{product.discountPercent}%
          </span>
        )}
      </Link>

      <CardContent className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          <span className="truncate">{product.brand}</span>
          <span aria-hidden="true">/</span>
          <span className="truncate">{product.category}</span>
        </div>

        <Link
          href={`/products/${product.id}`}
          onClick={() => logInteraction(product.id, "click")}
          className="focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          <h3 className="line-clamp-2 min-h-[2.5em] font-heading text-base font-semibold leading-tight text-foreground">
            {product.name}
          </h3>
        </Link>

        <ProductRating rating={product.rating} reviewCount={product.reviewCount} />

        <div className="mt-auto pt-2 text-foreground">
          <ProductPrice price={product.price} originalPrice={product.originalPrice} />
        </div>

        <Button
          onClick={(e) => {
            e.preventDefault();
            addItem(product);
          }}
          variant="outline"
          className="mt-2 w-full gap-2 rounded-[2px] border-foreground bg-transparent text-foreground transition-colors duration-200 hover:bg-foreground hover:text-background"
          size="sm"
        >
          <ShoppingCart className="h-4 w-4" aria-hidden="true" />
          Thêm vào giỏ
        </Button>
      </CardContent>

      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 h-0.5 origin-left scale-x-0 bg-brand transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-x-100"
      />
    </Card>
  );
}
