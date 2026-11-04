"use client";

import Image from "next/image";
import Link from "next/link";
import { Product, PriceHistory } from "@/types";
import { useCart } from "@/context/CartProvider";
import PriceChart from "@/components/shared/PriceChart";
import ProductPrice from "@/components/shared/ProductPrice";
import ProductRating from "@/components/shared/ProductRating";
import InventoryStatus from "@/components/shared/InventoryStatus";
import RelatedProducts from "@/components/shared/RelatedProducts";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ShoppingCart, Truck, ShieldCheck, RotateCcw,
  ChevronLeft, Sparkles, BellRing,
} from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useAuth } from "@/context/AuthProvider";
import { logInteraction } from "@/lib/logInteraction";

export default function ProductDetailClient({ id }: { id: string }) {
  const [product, setProduct] = useState<Product | null>(null);
  const [productLoading, setProductLoading] = useState(true);
  const [productError, setProductError] = useState("");
  const [retryKey, setRetryKey] = useState(0);
  const [priceHistoryState, setPriceHistoryState] = useState<{
    productId: string;
    data?: PriceHistory;
    error?: string;
  } | null>(null);
  const { addItem } = useCart();
  const { token, user, isLoading: isAuthLoading } = useAuth();
  const [selectedImage, setSelectedImage] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [targetPrice, setTargetPrice] = useState("");
  const [watchMessage, setWatchMessage] = useState("");
  const [isSavingWatch, setIsSavingWatch] = useState(false);
  const [cartToast, setCartToast] = useState<{ open: boolean; message: string }>({
    open: false,
    message: "",
  });
  const apiBaseUrl = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000").replace(/\/$/, "");

  useEffect(() => {
    const controller = new AbortController();
    setProductLoading(true);
    setProductError("");
    fetch(`${apiBaseUrl}/api/products/${encodeURIComponent(id)}`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) {
          if (response.status === 404) {
            setProduct(null);
            setProductError("Sản phẩm không tồn tại.");
          } else {
            throw new Error(`HTTP ${response.status}`);
          }
          return;
        }
        const result = await response.json() as { success?: boolean; data?: Product };
        if (result.success && result.data) {
          setProduct(result.data);
          setTargetPrice(String(result.data.price));
        } else {
          setProduct(null);
          setProductError("Sản phẩm không tồn tại.");
        }
      })
      .catch((error: unknown) => {
        if (error instanceof Error && error.name !== "AbortError") {
          console.error("Unable to load product details from API:", error);
          setProductError("Không thể tải chi tiết sản phẩm. Vui lòng thử lại.");
        }
      })
      .finally(() => {
        setProductLoading(false);
      });

    return () => controller.abort();
  }, [apiBaseUrl, id, retryKey]);

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

  const lastViewRef = useRef<string | null>(null);
  const loadedProductId = product?.id;
  useEffect(() => {
    if (!loadedProductId) return;
    // Guard against React StrictMode double-invocation and re-renders.
    if (lastViewRef.current === loadedProductId) return;
    lastViewRef.current = loadedProductId;
    logInteraction(loadedProductId, "view");
  }, [loadedProductId]);

  if (productLoading) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-20">
        <div className="flex flex-col gap-6 max-w-2xl">
          <Skeleton className="h-48 w-full rounded-2xl" />
          <div className="space-y-3">
            <Skeleton className="h-6 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-8 w-1/3 mt-auto" />
          </div>
        </div>
      </div>
    );
  }
  if (!product) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-20">
        <div className="flex flex-col items-center justify-center gap-3 text-center">
          <Alert variant="destructive" className="max-w-md w-full">
            <AlertTitle>{productError || "Không tìm thấy sản phẩm"}</AlertTitle>
            <AlertDescription>Vui lòng kiểm tra lại mã sản phẩm hoặc quay sau.</AlertDescription>
          </Alert>
          <div className="flex items-center justify-center gap-2">
            <Button variant="outline" onClick={() => setRetryKey((k) => k + 1)}>
              Thử lại
            </Button>
            <Link href="/" className={buttonVariants({ className: "mt-4" })}>Về trang chủ</Link>
          </div>
        </div>
      </div>
    );
  }

  {cartToast.open && (
    <div className="fixed bottom-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-xl bg-green-900 text-white shadow-lg animate-in fade-in slide-in-from-right-2 duration-300">
      <ShoppingCart className="h-5 w-5" />
      <span className="text-sm font-medium">{cartToast.message}</span>
    </div>
  )}

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
          <div className="flex aspect-square max-h-[500px] w-full items-center justify-center rounded-xl border border-gray-200 bg-gray-50 p-6">
            <Image src={product.images[selectedImage] || product.thumbnailUrl} alt={product.name} width={800} height={800} className="device-shadow h-full w-full object-contain" loading="eager" unoptimized />
          </div>
          {product.images.length > 1 && (
            <div className="flex flex-wrap gap-3">
              {product.images.map((img, i) => (
                <button
                  key={i}
                  type="button"
                  aria-label={`Hiển thị hình ảnh ${i + 1} của ${product.name}`}
                  aria-pressed={i === selectedImage}
                  onClick={() => setSelectedImage(i)}
                  className={`h-20 w-20 overflow-hidden rounded-lg border-2 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${i === selectedImage ? "border-primary ring-2 ring-primary/20" : "border-transparent hover:border-muted-foreground/30"}`}
                >
                  <Image src={img} alt={`${product.name} ${i + 1}`} width={80} height={80} className="h-full w-full object-cover" unoptimized />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Info */}
        <div className="space-y-6">
          {product.recommendationBadge && (
            <Badge className="gap-1.5 border border-blue-100 bg-blue-50 text-blue-700">
              <Sparkles className="h-3 w-3" aria-hidden="true" /> {product.recommendationBadge.label}
            </Badge>
          )}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>{product.brand}</span><span>•</span><span>{product.category}</span>
            </div>
            <h1 className="font-heading text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">{product.name}</h1>
          </div>
          <ProductRating rating={product.rating} reviewCount={product.reviewCount} size="detail" />
          <div className="space-y-2 rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5">
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
              <span id="quantity-label" className="text-sm font-medium">Số lượng:</span>
              <div role="group" aria-labelledby="quantity-label" className="flex items-center gap-2 border rounded-lg">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9"
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  aria-label={`Giảm số lượng ${product.name}`}
                  disabled={quantity <= 1}
                >
                  -
                </Button>
                <output aria-label={`Số lượng ${product.name}`} className="w-10 text-center font-medium">
                  {quantity}
                </output>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9"
                  onClick={() => setQuantity(Math.min(product.stock, quantity + 1))}
                  aria-label={`Tăng số lượng ${product.name}`}
                  disabled={quantity >= product.stock}
                >
                  +
                </Button>
              </div>
            </div>
            <div className="flex gap-3">
              <Button onClick={() => {
                addItem(product, quantity);
                setCartToast({ open: true, message: `Đã thêm ${quantity} × ${product.name} vào giỏ hàng.` });
                setTimeout(() => setCartToast({ open: false, message: "" }), 3000);
              }} className="h-12 flex-1 gap-2" size="lg">
                <ShoppingCart className="h-5 w-5" aria-hidden="true" /> Thêm vào giỏ hàng
              </Button>
              <Link
                href="/cart"
                onClick={() => addItem(product, quantity)}
                className={buttonVariants({ variant: "outline", size: "lg", className: "h-12 flex-1" })}
              >
                Mua ngay
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
              <CardTitle className="flex items-center gap-2 text-base">Lịch sử giá — {product.name}</CardTitle>
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

      <RelatedProducts productId={product.id} />
    </div>
  );
}
