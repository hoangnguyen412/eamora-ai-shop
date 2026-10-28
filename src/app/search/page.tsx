"use client";

import { useState, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import ProductCard from "@/components/shared/ProductCard";
import mockData from "@/mocks/db.json";
import { Product } from "@/types";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Search, SlidersHorizontal, X, Sparkles } from "lucide-react";
import { formatPrice, filterProducts } from "@/lib/helpers";
import { Suspense } from "react";

const products = mockData.products as unknown as Product[];
const brands = Array.from(new Set(products.map((p) => p.brand)));
const categories = Array.from(new Set(products.map((p) => p.category)));

function SearchContent() {
  const searchParams = useSearchParams();
  const initialCategory = searchParams.get("category") || "";

  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState(initialCategory);
  const [selectedBrand, setSelectedBrand] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  const filtered = useMemo(() => {
    return filterProducts(products, {
      search,
      category: selectedCategory,
      brand: selectedBrand,
      minPrice: minPrice ? parseInt(minPrice) : undefined,
      maxPrice: maxPrice ? parseInt(maxPrice) : undefined,
    });
  }, [search, selectedCategory, selectedBrand, minPrice, maxPrice]);

  const clearFilters = () => {
    setSearch("");
    setSelectedCategory("");
    setSelectedBrand("");
    setMinPrice("");
    setMaxPrice("");
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
              placeholder="Tìm kiếm sản phẩm bằng AI... (VD: laptop dưới 25 triệu cho lập trình)"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 h-12 text-sm"
            />
            {search && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8"
                onClick={() => setSearch("")}
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
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="text-sm text-muted-foreground">
              AI đang phân tích: &ldquo;<strong className="text-foreground">{search}</strong>&rdquo;
              — Tìm thấy <strong className="text-primary">{filtered.length}</strong> kết quả phù hợp
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
                      onClick={() =>
                        setSelectedCategory(selectedCategory === cat ? "" : cat)
                      }
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
                      onClick={() =>
                        setSelectedBrand(selectedBrand === brand ? "" : brand)
                      }
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
                    onChange={(e) => setMinPrice(e.target.value)}
                    className="text-sm"
                  />
                  <span className="text-muted-foreground">—</span>
                  <Input
                    type="number"
                    placeholder="Đến"
                    value={maxPrice}
                    onChange={(e) => setMaxPrice(e.target.value)}
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
              Hiển thị <strong>{filtered.length}</strong> sản phẩm
            </p>
            {hasFilters && (
              <div className="flex flex-wrap gap-1.5">
                {selectedCategory && (
                  <Badge variant="secondary" className="gap-1 text-xs">
                    {selectedCategory}
                    <X className="h-3 w-3 cursor-pointer" onClick={() => setSelectedCategory("")} />
                  </Badge>
                )}
                {selectedBrand && (
                  <Badge variant="secondary" className="gap-1 text-xs">
                    {selectedBrand}
                    <X className="h-3 w-3 cursor-pointer" onClick={() => setSelectedBrand("")} />
                  </Badge>
                )}
              </div>
            )}
          </div>

          {filtered.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {filtered.map((product) => (
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
