"use client";

import Image from "next/image";
import Link from "next/link";
import mockData from "@/mocks/db.json";
import { Product, PriceHistory } from "@/types";
import { useCart } from "@/context/CartProvider";
import PriceChart from "@/components/shared/PriceChart";
import { formatPrice } from "@/lib/helpers";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ShoppingCart, Star, Truck, ShieldCheck, RotateCcw,
  ChevronLeft, Sparkles, Package,
} from "lucide-react";
import { useState } from "react";

const products = mockData.products as unknown as Product[];
const priceHistoryMap = mockData.priceHistory as Record<string, PriceHistory>;

export default function ProductDetailClient({ id }: { id: string }) {
  const product = products.find((p) => p.id === id);
  const { addItem } = useCart();
  const [selectedImage, setSelectedImage] = useState(0);
  const [quantity, setQuantity] = useState(1);

  if (!product) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-20 text-center">
        <h2 className="text-2xl font-bold">Không tìm thấy sản phẩm</h2>
        <Link href="/"><Button className="mt-4">Về trang chủ</Button></Link>
      </div>
    );
  }

  const priceData = priceHistoryMap[product.id];
  const specEntries = Object.entries(product.specs).filter(([, v]) => v !== undefined);

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/" className="hover:text-primary transition-colors">
          <ChevronLeft className="h-4 w-4 inline" /> Trang chủ
        </Link>
        <span>/</span>
        <Link href={`/search?category=${product.category}`} className="hover:text-primary transition-colors">
          {product.category}
        </Link>
        <span>/</span>
        <span className="text-foreground font-medium truncate max-w-[200px]">{product.name}</span>
      </div>

      {/* Main */}
      <div className="grid lg:grid-cols-2 gap-10">
        {/* Images */}
        <div className="space-y-4">
          <div className="aspect-square overflow-hidden rounded-2xl bg-muted/50 border">
            <Image src={product.images[selectedImage] || product.thumbnailUrl} alt={product.name} width={800} height={800} className="h-full w-full object-cover" unoptimized />
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
            <h1 className="text-2xl md:text-3xl font-bold">{product.name}</h1>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className={`h-4 w-4 ${i < Math.floor(product.rating) ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"}`} />
              ))}
            </div>
            <span className="text-sm font-medium">{product.rating}</span>
            <span className="text-sm text-muted-foreground">({product.reviewCount} đánh giá)</span>
          </div>
          <div className="space-y-1">
            <div className="flex items-baseline gap-3">
              <span className="text-3xl font-bold text-primary">{formatPrice(product.price)}</span>
              {product.originalPrice > product.price && (
                <>
                  <span className="text-lg text-muted-foreground line-through">{formatPrice(product.originalPrice)}</span>
                  <Badge variant="destructive" className="text-xs">-{product.discountPercent}%</Badge>
                </>
              )}
            </div>
            <p className="text-sm text-muted-foreground flex items-center gap-1.5">
              <Package className="h-3.5 w-3.5" /> Còn {product.stock} sản phẩm trong kho
            </p>
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
              {priceData ? (
                <PriceChart priceData={priceData} />
              ) : (
                <p className="text-sm text-muted-foreground py-8 text-center">Chưa có dữ liệu biến động giá cho sản phẩm này</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
