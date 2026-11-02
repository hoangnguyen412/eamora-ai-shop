"use client";

import { useEffect, useState } from "react";
import ProductCard from "./ProductCard";

interface RelatedProduct {
  id: string;
  name: string;
  basePrice: number | null;
  imageUrl: string | null;
  images: string[] | null;
  brand: string | null;
  categoryId: string | null;
  categoryName: string | null;
  rating: number | null;
  reviewCount: number | null;
  originalPrice: number | null;
  discountPercent: number | null;
  stock: number | null;
}

interface RelatedProductsProps {
  productId: string;
}

export default function RelatedProducts({ productId }: RelatedProductsProps) {
  const [products, setProducts] = useState<RelatedProduct[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const aiBaseUrl = (process.env.NEXT_PUBLIC_AI_URL ?? "http://localhost:8000").replace(/\/$/, "");

    fetch(`${aiBaseUrl}/products/${encodeURIComponent(productId)}/related`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        if (response.status === 404) {
          setError("not-found");
          return;
        }
        if (!response.ok) {
          throw new Error(`Server returned status ${response.status}`);
        }
        const data = await response.json();
        setProducts(Array.isArray(data) ? data : []);
      })
      .catch((err: unknown) => {
        if (err instanceof Error && err.name !== "AbortError") {
          console.error("Related products fetch error:", err);
          setError(err.message);
        }
      });

    return () => controller.abort();
  }, [productId]);

  // Loading / error / empty → return null, không layout shift
  if (products === null || error === "not-found" || products.length === 0) {
    return null;
  }

  return (
    <section className="mt-12 border-t pt-8">
      <h2 className="text-xl font-bold mb-6">Sản phẩm tương tự</h2>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
        {products.map((p) => (
          <ProductCard
            key={p.id}
            product={{
              id: p.id,
              name: p.name,
              slug: p.id,
              brand: p.brand ?? "",
              category: p.categoryName ?? "",
              price: p.basePrice ?? 0,
              originalPrice: p.originalPrice ?? 0,
              discountPercent: p.discountPercent ?? 0,
              stock: p.stock ?? 0,
              rating: p.rating ?? 0,
              reviewCount: p.reviewCount ?? 0,
              images: p.images ?? [],
              thumbnailUrl: p.imageUrl ?? "",
              isFeatured: false,
              specs: {},
              createdAt: "",
            }}
          />
        ))}
      </div>
    </section>
  );
}
