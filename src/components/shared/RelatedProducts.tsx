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

interface RelatedResponse {
  success: boolean;
  data?: RelatedProduct[];
}

export default function RelatedProducts({ productId }: RelatedProductsProps) {
  const [products, setProducts] = useState<RelatedProduct[] | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const apiBaseUrl = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000").replace(/\/$/, "");

    fetch(`${apiBaseUrl}/api/products/${encodeURIComponent(productId)}/related`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        if (response.status === 404 || !response.ok) {
          setProducts([]);
          return;
        }
        const data = (await response.json()) as RelatedResponse;
        setProducts(Array.isArray(data?.data) ? data.data : []);
      })
      .catch(() => {
        // AI service chết hoặc lỗi mạng → trả về mảng rỗng, ẩn component
        setProducts([]);
      });

    return () => controller.abort();
  }, [productId]);

  // Lỗi hoặc rỗng → return null, không layout shift, không hiển thị giao diện lỗi
  if (!products || products.length === 0) {
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
