"use client";

import Image from "next/image";
import Link from "next/link";
import { useCart } from "@/context/CartProvider";
import { formatPrice } from "@/lib/helpers";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Trash2, Plus, Minus, ShoppingBag, ArrowRight } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function CartPage() {
  const { items, updateQuantity, removeItem, selectListing, subtotal, shippingFee, totalAmount, itemCount } =
    useCart();
  const needsListing = items.some((item) => !item.listingId);
  const selectedSellerIds = new Set(items.map((item) => item.shopId).filter(Boolean));
  const mixedSellers = selectedSellerIds.size > 1;
  const exceedsStock = items.some((item) => item.quantity > (item.product.offers?.find((offer) => offer.listingId === item.listingId)?.stock ?? 0));
  const canCheckout = !needsListing && !mixedSellers && !exceedsStock;

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-20 text-center space-y-4">
        <ShoppingBag className="h-16 w-16 mx-auto text-muted-foreground/30" />
        <h2 className="text-2xl font-bold">Giỏ hàng trống</h2>
        <p className="text-muted-foreground">
          Hãy thêm sản phẩm vào giỏ hàng để tiến hành thanh toán
        </p>
        <Link href="/search">
          <Button className="mt-4 bg-gradient-brand text-white hover:opacity-90">
            Khám phá sản phẩm
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-2xl font-bold mb-6">
        Giỏ hàng <span className="text-muted-foreground font-normal text-lg">({itemCount} sản phẩm)</span>
      </h1>

      <div className="grid lg:grid-cols-3 gap-8">
        {/* Cart items */}
        <div className="lg:col-span-2 space-y-4">
          {items.map((item) => (
            <Card key={item.id} className="overflow-hidden">
              <CardContent className="p-4">
                <div className="flex gap-4">
                  {/* Image */}
                  <Link href={`/products/${item.productId}`} className="shrink-0">
                    <div className="w-24 h-24 rounded-lg overflow-hidden bg-muted/50">
                      <Image
                        src={item.product.thumbnailUrl}
                        alt={item.product.name}
                        width={96}
                        height={96}
                        className="h-full w-full object-cover"
                        unoptimized
                      />
                    </div>
                  </Link>

                  {/* Details */}
                  <div className="flex-1 min-w-0 space-y-2">
                    <Link
                      href={`/products/${item.productId}`}
                      className="text-sm font-semibold hover:text-primary transition-colors line-clamp-2"
                    >
                      {item.product.name}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      {item.product.brand} • {item.product.category}
                    </p>
                    <p className="text-base font-bold text-primary">
                      {formatPrice(item.selectedPrice)}
                    </p>
                    {item.product.offers && item.product.offers.length > 0 ? (
                      <div className="max-w-sm space-y-1">
                        <label htmlFor={`seller-${item.productId}`} className="text-xs font-medium">
                          Chọn nhà bán
                        </label>
                        <Select
                          value={item.listingId ?? null}
                          onValueChange={(listingId) => {
                            const offer = item.product.offers?.find((option) => option.listingId === listingId);
                            if (offer) selectListing(item.productId, offer);
                          }}
                        >
                          <SelectTrigger id={`seller-${item.productId}`} className="w-full">
                            <SelectValue placeholder="Chọn nhà bán và giá" />
                          </SelectTrigger>
                          <SelectContent>
                            {item.product.offers.map((offer) => (
                              <SelectItem key={offer.listingId} value={offer.listingId}>
                                {offer.shopName} · {formatPrice(offer.price)} · còn {offer.stock}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {item.listingId && item.quantity > (item.product.offers.find((offer) => offer.listingId === item.listingId)?.stock ?? 0) && (
                          <p className="text-xs text-destructive">Số lượng vượt quá tồn kho của nhà bán đã chọn.</p>
                        )}
                      </div>
                    ) : (
                      <p className="text-xs text-destructive">
                        Chưa có listing còn hàng từ API cho sản phẩm này.
                      </p>
                    )}
                  </div>

                  {/* Quantity + Remove */}
                  <div className="flex flex-col items-end justify-between">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={() => removeItem(item.productId)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>

                    <div className="flex items-center gap-1 border rounded-lg">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() =>
                          updateQuantity(item.productId, item.quantity - 1)
                        }
                      >
                        <Minus className="h-3 w-3" />
                      </Button>
                      <span className="w-8 text-center text-sm font-medium">
                        {item.quantity}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() =>
                          updateQuantity(item.productId, item.quantity + 1)
                        }
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>

                    <p className="text-sm font-bold">
                      {formatPrice(item.selectedPrice * item.quantity)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
          {needsListing && (
            <p role="alert" className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-sm text-amber-800 dark:text-amber-300">
              Chọn nhà bán cho từng sản phẩm trước khi thanh toán. Sản phẩm chưa có listing API thì chưa thể đặt hàng.
            </p>
          )}
          {mixedSellers && (
            <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
              Mỗi đơn hiện chỉ hỗ trợ sản phẩm từ một nhà bán. Hãy chọn cùng một nhà bán cho tất cả sản phẩm.
            </p>
          )}
        </div>

        {/* Order summary */}
        <div>
          <Card className="sticky top-24">
            <CardHeader>
              <CardTitle className="text-lg">Tổng đơn hàng</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Tạm tính</span>
                  <span className="font-medium">{formatPrice(subtotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Phí vận chuyển</span>
                  <span className="font-medium">{formatPrice(shippingFee)}</span>
                </div>
              </div>

              <Separator />

              <div className="flex justify-between items-baseline">
                <span className="font-semibold">Tổng cộng</span>
                <span className="text-xl font-bold text-primary">
                  {formatPrice(totalAmount)}
                </span>
              </div>

              {canCheckout ? (
                <Link href="/checkout" className="block">
                  <Button className="w-full gap-2 bg-gradient-brand text-white hover:opacity-90 h-12" size="lg">
                    Tiến hành thanh toán
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
              ) : (
                <Button className="w-full h-12" size="lg" disabled>
                  Chọn nhà bán để tiếp tục
                </Button>
              )}

              <Link href="/search" className="block">
                <Button variant="outline" className="w-full" size="sm">
                  Tiếp tục mua sắm
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
