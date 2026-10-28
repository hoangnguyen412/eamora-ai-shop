"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import ProductCard from "@/components/shared/ProductCard";
import { Product } from "@/types";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { Suspense } from "react";

const API_BASE_URL = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000").replace(/\/$/, "");
const PAGE_SIZE = 12;

interface ProductSearchResponse {
  success: boolean;
  data: Product[];
  filterOptions: {
    categories: string[];
    brands: string[];
  };
  pagination: {
    currentPage: number;
    totalPages: number;
    totalItems: number;
    limit: number;
  };
  message?: string;
}

function SearchContent() {
  const searchParams = useSearchParams();
  const initialCategory = searchParams.get("category") || "";

  const [search, setSearch] = useState(searchParams.get("q") || "");
  const [selectedCategory, setSelectedCategory] = useState(initialCategory);
  const [selectedBrand, setSelectedBrand] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [brands, setBrands] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
      if (search.trim()) params.set("q", search.trim());
      if (selectedCategory) params.set("category", selectedCategory);
      if (selectedBrand) params.set("brand", selectedBrand);
      if (minPrice) params.set("minPrice", minPrice);
      if (maxPrice) params.set("maxPrice", maxPrice);

      setIsLoading(true);
      setError("");

      try {
        const response = await fetch(`${API_BASE_URL}/api/products?${params}`, {
          signal: controller.signal,
        });
        const result = await response.json() as ProductSearchResponse;
        if (!response.ok || !result.success) {
          throw new Error(result.message || "Không thể tải danh sách sản phẩm");
        }

        setProducts(result.data);
        setCategories(result.filterOptions.categories);
        setBrands(result.filterOptions.brands);
        setTotalPages(result.pagination.totalPages);
        setTotalItems(result.pagination.totalItems);
      } catch (fetchError) {
        if (fetchError instanceof Error && fetchError.name === "AbortError") return;
        setError(fetchError instanceof Error ? fetchError.message : "Không thể tải danh sách sản phẩm");
        setProducts([]);
        setTotalItems(0);
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    }, 250);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [search, selectedCategory, selectedBrand, minPrice, maxPrice, page]);

  const clearFilters = () => {
    setSearch("");
    setSelectedCategory("");
    setSelectedBrand("");
    setMinPrice("");
    setMaxPrice("");
    setPage(1);
  };

  const hasFilters = search || selectedCategory || selectedBrand || minPrice || maxPrice;

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
      {/* Search bar */}
      <div className="mb-8 space-y-4">
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Tìm sản phẩm theo tên, thương hiệu hoặc danh mục"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="pl-10 h-12 text-sm"
            />
            {search && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8"
                onClick={() => {
                  setSearch("");
                  setPage(1);
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
          <Button
            variant="outline"
            className="h-12 gap-2 lg:hidden"
            onClick={() => setShowFilters(!showFilters)}
          >
            <SlidersHorizontal className="h-4 w-4" />
            Bộ lọc
          </Button>
        </div>

        {search && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-primary/5 border border-primary/10">
            <Search className="h-4 w-4 text-primary" />
            <span className="text-sm text-muted-foreground">
              Đang tìm: &ldquo;<strong className="text-foreground">{search}</strong>&rdquo;
              — Tìm thấy <strong className="text-primary">{totalItems}</strong> sản phẩm phù hợp
            </span>
          </div>
        )}
      </div>

      <div className="flex gap-8">
        {/* Filters sidebar */}
        <aside className={`${showFilters ? "block" : "hidden"} lg:block w-full lg:w-64 shrink-0`}>
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Bộ lọc</CardTitle>
                {hasFilters && (
                  <Button variant="ghost" size="sm" onClick={clearFilters} className="text-xs h-7">
                    Xóa tất cả
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* Category */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Danh mục</label>
                <div className="flex flex-wrap gap-2">
                  {categories.map((cat) => (
                    <Badge
                      key={cat}
                      variant={selectedCategory === cat ? "default" : "outline"}
                      className="cursor-pointer hover:bg-primary/10 transition-colors"
                      onClick={() => {
                        setSelectedCategory(selectedCategory === cat ? "" : cat);
                        setPage(1);
                      }}
                    >
                      {cat}
                    </Badge>
                  ))}
                </div>
              </div>

              <Separator />

              {/* Brand */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Thương hiệu</label>
                <div className="flex flex-wrap gap-2">
                  {brands.map((brand) => (
                    <Badge
                      key={brand}
                      variant={selectedBrand === brand ? "default" : "outline"}
                      className="cursor-pointer hover:bg-primary/10 transition-colors"
                      onClick={() => {
                        setSelectedBrand(selectedBrand === brand ? "" : brand);
                        setPage(1);
                      }}
                    >
                      {brand}
                    </Badge>
                  ))}
                </div>
              </div>

              <Separator />

              {/* Price range */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Khoảng giá (VND)</label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    placeholder="Từ"
                    value={minPrice}
                    onChange={(e) => {
                      setMinPrice(e.target.value);
                      setPage(1);
                    }}
                    className="text-sm"
                  />
                  <span className="text-muted-foreground">—</span>
                  <Input
                    type="number"
                    placeholder="Đến"
                    value={maxPrice}
                    onChange={(e) => {
                      setMaxPrice(e.target.value);
                      setPage(1);
                    }}
                    className="text-sm"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </aside>

        {/* Results grid */}
        <div className="flex-1 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Hiển thị <strong>{totalItems}</strong> sản phẩm
            </p>
            {hasFilters && (
              <div className="flex flex-wrap gap-1.5">
                {selectedCategory && (
                  <Badge variant="secondary" className="gap-1 text-xs">
                    {selectedCategory}
                    <X className="h-3 w-3 cursor-pointer" onClick={() => {
                      setSelectedCategory("");
                      setPage(1);
                    }} />
                  </Badge>
                )}
                {selectedBrand && (
                  <Badge variant="secondary" className="gap-1 text-xs">
                    {selectedBrand}
                    <X className="h-3 w-3 cursor-pointer" onClick={() => {
                      setSelectedBrand("");
                      setPage(1);
                    }} />
                  </Badge>
                )}
              </div>
            )}
          </div>

          {error ? (
            <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
              {error}
            </div>
          ) : isLoading ? (
            <p role="status" className="py-12 text-center text-sm text-muted-foreground">Đang tải sản phẩm...</p>
          ) : products.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {products.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          ) : (
            <div className="text-center py-20 space-y-3">
              <Search className="h-12 w-12 mx-auto text-muted-foreground/30" />
              <p className="text-lg font-medium">Không tìm thấy sản phẩm</p>
              <p className="text-sm text-muted-foreground">
                Hãy thử tìm kiếm với từ khóa khác hoặc điều chỉnh bộ lọc
              </p>
              <Button variant="outline" onClick={clearFilters}>
                Xóa bộ lọc
              </Button>
            </div>
          )}

          {!error && totalItems > 0 && (
            <div className="flex items-center justify-center gap-4 pt-4">
              <Button
                variant="outline"
                disabled={page <= 1 || isLoading}
                onClick={() => setPage((currentPage) => currentPage - 1)}
              >
                Trang trước
              </Button>
              <span className="text-sm text-muted-foreground">Trang {page} / {totalPages}</span>
              <Button
                variant="outline"
                disabled={page >= totalPages || isLoading}
                onClick={() => setPage((currentPage) => currentPage + 1)}
              >
                Trang sau
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense>
      <SearchContent />
    </Suspense>
  );
}
