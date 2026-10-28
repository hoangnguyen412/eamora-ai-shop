"use client";

import Image from "next/image";
import Link from "next/link";
import mockData from "@/mocks/db.json";
import { Product, PriceHistory } from "@/types";
import { useCart } from "@/context/CartProvider";
import PriceChart from "@/components/shared/PriceChart";
import ProductPrice from "@/components/shared/ProductPrice";
import ProductRating from "@/components/shared/ProductRating";
import InventoryStatus from "@/components/shared/InventoryStatus";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ShoppingCart, Truck, ShieldCheck, RotateCcw,
  ChevronLeft, Sparkles, BellRing,
} from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { useAuth } from "@/context/AuthProvider";

const products = mockData.products as unknown as Product[];

export default function ProductDetailClient({ id }: { id: string }) {
  const [product, setProduct] = useState<Product | null>(() => products.find((item) => item.id === id) ?? null);
  const [priceHistoryState, setPriceHistoryState] = useState<{
    productId: string;
    data?: PriceHistory;
    error?: string;
  } | null>(null);
  const { addItem } = useCart();
  const { token, user, isLoading: isAuthLoading } = useAuth();
  const [selectedImage, setSelectedImage] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [targetPrice, setTargetPrice] = useState(() => {
    const initialProduct = products.find((item) => item.id === id);
    return initialProduct ? String(initialProduct.price) : "";
  });
  const [watchMessage, setWatchMessage] = useState("");
  const [isSavingWatch, setIsSavingWatch] = useState(false);
  const apiBaseUrl = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000").replace(/\/$/, "");

  useEffect(() => {
    const controller = new AbortController();
    fetch(`${apiBaseUrl}/api/products/${encodeURIComponent(id)}`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) return;
        const result = await response.json() as { success?: boolean; data?: Product };
        if (result.success && result.data) {
          setProduct(result.data);
          setTargetPrice(String(result.data.price));
        }
      })
      .catch((error: unknown) => {
        if (error instanceof Error && error.name !== "AbortError") {
          console.error("Unable to load product details from API:", error);
        }
      });

    return () => controller.abort();
  }, [apiBaseUrl, id]);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`${apiBaseUrl}/api/products/${encodeURIComponent(id)}/price-history`, { signal: controller.signal })
      .then(async (response) => {
        const result = await response.json() as { success?: boolean; data?: PriceHistory; message?: string };
        if (!response.ok || !result.success || !result.data) {
          throw new Error(result.message || "Không thể tải lịch sử giá.");
        }
        setPriceHistoryState({ productId: id, data: result.data });
      })
      .catch((error: unknown) => {
        if (error instanceof Error && error.name !== "AbortError") {
          setPriceHistoryState({ productId: id, error: error.message });
        }
      });

    return () => controller.abort();
  }, [apiBaseUrl, id]);

  if (!product) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-20 text-center">
        <h2 className="text-2xl font-bold">Không tìm thấy sản phẩm</h2>
        <Link href="/"><Button className="mt-4">Về trang chủ</Button></Link>
      </div>
    );
  }

  const currentPriceHistory = priceHistoryState?.productId === id ? priceHistoryState : null;
  const specEntries = Object.entries(product.specs).filter(([, v]) => v !== undefined);

  const handleWatchSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setWatchMessage("");
    const parsedTargetPrice = Number(targetPrice);
    if (!Number.isFinite(parsedTargetPrice) || parsedTargetPrice <= 0) {
      setWatchMessage("Nhập giá mục tiêu lớn hơn 0.");
      return;
    }
    if (!token || user?.role !== "buyer") {
      setWatchMessage("Vui lòng đăng nhập bằng tài khoản buyer để theo dõi giá.");
      return;
    }

    setIsSavingWatch(true);
    try {
      const response = await fetch(`${apiBaseUrl}/api/agent/watch`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ product_id: product.id, target_price: parsedTargetPrice }),
      });
      const result = await response.json() as { success?: boolean; message?: string };
      if (!response.ok || !result.success) {
        throw new Error(result.message || "Không thể tạo theo dõi giá.");
      }

      setWatchMessage("Đã thêm sản phẩm vào danh sách theo dõi giá.");
    } catch (error) {
      setWatchMessage(error instanceof Error ? error.message : "Không thể tạo theo dõi giá.");
    } finally {
      setIsSavingWatch(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      {/* Breadcrumb */}
      <nav aria-label="Đường dẫn" className="flex items-center gap-2 overflow-hidden text-sm text-muted-foreground">
        <Link href="/" className="shrink-0 whitespace-nowrap transition-colors hover:text-primary">
          <ChevronLeft className="h-4 w-4 inline" /> Trang chủ
        </Link>
        <span className="shrink-0">/</span>
        <Link href={`/search?category=${product.category}`} className="shrink-0 whitespace-nowrap transition-colors hover:text-primary">
          {product.category}
        </Link>
        <span className="shrink-0">/</span>
        <span aria-current="page" className="max-w-[200px] truncate font-medium text-foreground">{product.name}</span>
      </nav>

      {/* Main */}
      <div className="grid gap-8 lg:grid-cols-2 lg:gap-10">
        {/* Images */}
        <div className="space-y-4">
          <div className="aspect-square overflow-hidden rounded-2xl border bg-muted/50">
            <Image src={product.images[selectedImage] || product.thumbnailUrl} alt={product.name} width={800} height={800} className="h-full w-full object-cover" loading="eager" unoptimized />
          </div>
          {product.images.length > 1 && (
            <div className="flex gap-3">
              {product.images.map((img, i) => (
                <button key={i} onClick={() => setSelectedImage(i)}
                  className={`w-20 h-20 rounded-lg overflow-hidden border-2 transition-all ${i === selectedImage ? "border-primary ring-2 ring-primary/20" : "border-transparent hover:border-muted-foreground/30"}`}>
                  <Image src={img} alt={`${product.name} ${i + 1}`} width={80} height={80} className="h-full w-full object-cover" unoptimized />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Info */}
        <div className="space-y-6">
          {product.recommendationBadge && (
            <Badge className="gap-1.5 bg-gradient-to-r from-violet-500 to-indigo-500 text-white border-0">
              <Sparkles className="h-3 w-3" /> {product.recommendationBadge.label}
            </Badge>
          )}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>{product.brand}</span><span>•</span><span>{product.category}</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{product.name}</h1>
          </div>
          <ProductRating rating={product.rating} reviewCount={product.reviewCount} size="detail" />
          <div className="space-y-2 rounded-xl border bg-card p-4 sm:p-5">
            <ProductPrice
              price={product.price}
              originalPrice={product.originalPrice}
              discountPercent={product.discountPercent}
              size="detail"
            />
            <InventoryStatus stock={product.stock} />
          </div>
          <Separator />
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <span className="text-sm font-medium">Số lượng:</span>
              <div className="flex items-center gap-2 border rounded-lg">
                <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => setQuantity(Math.max(1, quantity - 1))}>-</Button>
                <span className="w-10 text-center font-medium">{quantity}</span>
                <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => setQuantity(Math.min(product.stock, quantity + 1))}>+</Button>
              </div>
            </div>
            <div className="flex gap-3">
              <Button onClick={() => addItem(product, quantity)} className="flex-1 gap-2 bg-gradient-brand text-white hover:opacity-90 h-12" size="lg">
                <ShoppingCart className="h-5 w-5" /> Thêm vào giỏ hàng
              </Button>
              <Link href="/cart" className="flex-1">
                <Button onClick={() => addItem(product, quantity)} variant="outline" className="w-full h-12" size="lg">Mua ngay</Button>
              </Link>
            </div>
          </div>
          <Separator />
          <div className="grid grid-cols-3 gap-3">
            {[
              { icon: Truck, label: "Giao hàng miễn phí" },
              { icon: ShieldCheck, label: "Bảo hành chính hãng" },
              { icon: RotateCcw, label: "Đổi trả 30 ngày" },
            ].map((p) => (
              <div key={p.label} className="flex flex-col items-center gap-1.5 p-3 rounded-lg bg-muted/50 text-center">
                <p.icon className="h-5 w-5 text-primary" />
                <span className="text-xs font-medium">{p.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="specs" className="space-y-4">
        <TabsList>
          <TabsTrigger value="specs">Thông số kỹ thuật</TabsTrigger>
          <TabsTrigger value="price">Biến động giá (Price Agent)</TabsTrigger>
        </TabsList>
        <TabsContent value="specs">
          <Card>
            <CardContent className="p-6">
              <div className="grid sm:grid-cols-2 gap-3">
                {specEntries.map(([key, value]) => (
                  <div key={key} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                    <span className="text-sm font-medium capitalize w-24 shrink-0 text-muted-foreground">{key.toUpperCase()}</span>
                    <span className="text-sm font-medium">{String(value)}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="price">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">📈 Lịch sử giá — {product.name}</CardTitle>
            </CardHeader>
            <CardContent>
              {!currentPriceHistory ? (
                <p role="status" className="py-8 text-center text-sm text-muted-foreground">Đang tải lịch sử giá...</p>
              ) : currentPriceHistory.error ? (
                <p role="alert" className="py-8 text-center text-sm text-destructive">{currentPriceHistory.error}</p>
              ) : currentPriceHistory.data && currentPriceHistory.data.history.length > 0 ? (
                <PriceChart priceData={currentPriceHistory.data} />
              ) : (
                <p className="text-sm text-muted-foreground py-8 text-center">Chưa có mốc lịch sử giá nào được backend ghi nhận cho sản phẩm này.</p>
              )}
            </CardContent>
          </Card>
          <Card className="mt-4">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <BellRing className="h-4 w-4" />
                Theo dõi giá
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isAuthLoading ? (
                <p role="status" className="text-sm text-muted-foreground">Đang kiểm tra phiên đăng nhập...</p>
              ) : user?.role === "buyer" ? (
                <form onSubmit={handleWatchSubmit} className="flex flex-col gap-3 sm:flex-row sm:items-end">
                  <div className="flex-1 space-y-1.5">
                    <label htmlFor="target-price" className="text-sm font-medium">Thông báo khi giá chạm mức (VND)</label>
                    <Input
                      id="target-price"
                      type="number"
                      min="1"
                      step="1"
                      required
                      value={targetPrice}
                      onChange={(event) => setTargetPrice(event.target.value)}
                    />
                  </div>
                  <Button type="submit" disabled={isSavingWatch}>
                    {isSavingWatch ? "Đang lưu..." : "Theo dõi giá"}
                  </Button>
                </form>
              ) : (
                <p className="text-sm text-muted-foreground">
                  <Link href={`/login?next=${encodeURIComponent(`/products/${id}`)}`} className="text-primary underline">
                    Đăng nhập buyer
                  </Link>{" "}
                  để thêm sản phẩm vào danh sách theo dõi.
                </p>
              )}
              {watchMessage && <p role="status" className="mt-3 text-sm text-muted-foreground">{watchMessage}</p>}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
