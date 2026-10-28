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
import { Search, SlidersHorizontal, X, Sparkles } from "lucide-react";
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
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <header className="mb-6 space-y-1">
        <p className="text-sm font-medium text-primary">Khám phá Eamora</p>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Tìm sản phẩm</h1>
        <p className="text-sm text-muted-foreground">Lọc theo danh mục, thương hiệu hoặc khoảng giá.</p>
      </header>
      
      {/* Search bar */}
      <div className="mb-8 space-y-4">
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Tìm sản phẩm theo tên, thương hiệu hoặc danh mục"
              aria-label="Tìm sản phẩm"
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
                aria-label="Xóa nội dung tìm kiếm"
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
            aria-expanded={showFilters}
            aria-controls="search-filters"
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

      <div className="flex flex-col gap-8 lg:flex-row">
        {/* Filters sidebar */}
        <aside
          id="search-filters"
          className={`${showFilters ? "block" : "hidden"} w-full shrink-0 lg:block lg:w-64`}
        >
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
              <fieldset className="space-y-2">
                <legend className="text-sm font-medium">Danh mục</legend>
                <div className="flex flex-wrap gap-2">
                  {categories.map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      aria-pressed={selectedCategory === cat}
                      className={`rounded-full border px-3 py-1 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                        selectedCategory === cat
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-background text-foreground hover:border-primary/40 hover:bg-primary/5"
                      }`}
                      onClick={() => {
                        setSelectedCategory(selectedCategory === cat ? "" : cat);
                        setPage(1);
                      }}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </fieldset>

              <Separator />

              {/* Brand */}
              <fieldset className="space-y-2">
                <legend className="text-sm font-medium">Thương hiệu</legend>
                <div className="flex flex-wrap gap-2">
                  {brands.map((brand) => (
                    <button
                      key={brand}
                      type="button"
                      aria-pressed={selectedBrand === brand}
                      className={`rounded-full border px-3 py-1 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                        selectedBrand === brand
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-background text-foreground hover:border-primary/40 hover:bg-primary/5"
                      }`}
                      onClick={() => {
                        setSelectedBrand(selectedBrand === brand ? "" : brand);
                        setPage(1);
                      }}
                    >
                      {brand}
                    </button>
                  ))}
                </div>
              </fieldset>

              <Separator />

              {/* Price range */}
              <fieldset className="space-y-2">
                <legend className="text-sm font-medium">Khoảng giá (VND)</legend>
                <div className="flex items-center gap-2">
                  <Input
                    id="min-price"
                    type="number"
                    min="0"
                    placeholder="Từ"
                    aria-label="Giá thấp nhất"
                    value={minPrice}
                    onChange={(e) => {
                      setMinPrice(e.target.value);
                      setPage(1);
                    }}
                    className="text-sm"
                  />
                  <span className="text-muted-foreground">—</span>
                  <Input
                    id="max-price"
                    type="number"
                    min="0"
                    placeholder="Đến"
                    aria-label="Giá cao nhất"
                    value={maxPrice}
                    onChange={(e) => {
                      setMaxPrice(e.target.value);
                      setPage(1);
                    }}
                    className="text-sm"
                  />
                </div>
              </fieldset>
            </CardContent>
          </Card>
        </aside>

        {/* Results grid */}
        <div className="flex-1 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-muted-foreground" aria-live="polite" aria-atomic="true">
              {isLoading ? "Đang cập nhật kết quả..." : <>Tìm thấy <strong>{totalItems}</strong> sản phẩm</>}
            </p>
            {hasFilters && (
              <div className="flex flex-wrap gap-1.5">
                {selectedCategory && (
                  <span className="inline-flex items-center gap-1">
                    <Badge variant="secondary" className="text-xs">{selectedCategory}</Badge>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-xs"
                      aria-label={`Xóa bộ lọc danh mục ${selectedCategory}`}
                      onClick={() => {
                        setSelectedCategory("");
                        setPage(1);
                      }}
                    >
                      <X aria-hidden="true" className="h-3 w-3" />
                    </Button>
                  </span>
                )}
                {selectedBrand && (
                  <span className="inline-flex items-center gap-1">
                    <Badge variant="secondary" className="text-xs">{selectedBrand}</Badge>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-xs"
                      aria-label={`Xóa bộ lọc thương hiệu ${selectedBrand}`}
                      onClick={() => {
                        setSelectedBrand("");
                        setPage(1);
                      }}
                    >
                      <X aria-hidden="true" className="h-3 w-3" />
                    </Button>
                  </span>
                )}
              </div>
            )}
          </div>

          {error ? (
            <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
              {error}
            </div>
          ) : isLoading ? (
            <div role="status" aria-label="Đang tải sản phẩm" className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }, (_, index) => (
                <div key={index} className="overflow-hidden rounded-xl border bg-card">
                  <div className="aspect-square animate-pulse bg-muted" />
                  <div className="space-y-3 p-4">
                    <div className="h-3 w-2/5 animate-pulse rounded bg-muted" />
                    <div className="h-4 w-4/5 animate-pulse rounded bg-muted" />
                    <div className="h-5 w-1/2 animate-pulse rounded bg-muted" />
                    <div className="h-9 animate-pulse rounded bg-muted" />
                  </div>
                </div>
              ))}
            </div>
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
              <span className="text-sm text-muted-foreground" aria-live="polite">Trang {page} / {totalPages}</span>
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
    <Suspense fallback={<div role="status" className="mx-auto max-w-7xl px-4 py-16 text-center text-sm text-muted-foreground">Đang mở tìm kiếm...</div>}>
      <SearchContent />
    </Suspense>
  );
}