"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useCart } from "@/context/CartProvider";
import { formatPrice } from "@/lib/helpers";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CheckCircle2,
  CreditCard,
  Banknote,
  Wallet,
  ShoppingBag,
} from "lucide-react";

export default function CheckoutPage() {
  const { items, subtotal, shippingFee, totalAmount, clearCart } = useCart();
  const [submitted, setSubmitted] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("cod");

  if (submitted) {
    return (
      <div className="mx-auto max-w-lg px-4 py-20 text-center space-y-4">
        <div className="flex h-20 w-20 mx-auto items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
          <CheckCircle2 className="h-10 w-10 text-green-600 dark:text-green-400" />
        </div>
        <h2 className="text-2xl font-bold">Đặt hàng thành công!</h2>
        <p className="text-muted-foreground">
          Mã đơn hàng: <strong>ORD-20261020-01</strong>
        </p>
        <p className="text-sm text-muted-foreground">
          Cảm ơn bạn đã mua sắm tại TechAI Shop. Đơn hàng sẽ được xử lý trong
          24 giờ.
        </p>
        <Link href="/">
          <Button className="mt-4 bg-gradient-brand text-white hover:opacity-90">
            Về trang chủ
          </Button>
        </Link>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-20 text-center space-y-4">
        <ShoppingBag className="h-16 w-16 mx-auto text-muted-foreground/30" />
        <h2 className="text-2xl font-bold">Không có sản phẩm để thanh toán</h2>
        <Link href="/search">
          <Button className="mt-4 bg-gradient-brand text-white hover:opacity-90">
            Khám phá sản phẩm
          </Button>
        </Link>
      </div>
    );
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    clearCart();
    setSubmitted(true);
  };

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-2xl font-bold mb-6">Thanh toán</h1>

      <form onSubmit={handleSubmit}>
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Shipping + Payment */}
          <div className="lg:col-span-2 space-y-6">
            {/* Shipping info */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Thông tin giao hàng</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Họ và tên</label>
                    <Input
                      defaultValue="Nguyễn Văn A"
                      required
                      placeholder="Nhập họ tên"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Số điện thoại</label>
                    <Input
                      defaultValue="0901234567"
                      required
                      placeholder="Nhập số điện thoại"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Địa chỉ</label>
                  <Input
                    defaultValue="123 Đường Lý Thường Kiệt, Q.10"
                    required
                    placeholder="Nhập địa chỉ"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Thành phố</label>
                  <Select defaultValue="hcm">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="hcm">TP. Hồ Chí Minh</SelectItem>
                      <SelectItem value="hn">Hà Nội</SelectItem>
                      <SelectItem value="dn">Đà Nẵng</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* Payment method */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Phương thức thanh toán
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid sm:grid-cols-3 gap-3">
                  {[
                    {
                      id: "cod",
                      label: "Thanh toán khi nhận",
                      icon: Banknote,
                    },
                    { id: "vnpay", label: "VNPay", icon: Wallet },
                    {
                      id: "credit_card",
                      label: "Thẻ tín dụng",
                      icon: CreditCard,
                    },
                  ].map((method) => (
                    <button
                      key={method.id}
                      type="button"
                      onClick={() => setPaymentMethod(method.id)}
                      className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
                        paymentMethod === method.id
                          ? "border-primary bg-primary/5 shadow-sm"
                          : "border-border hover:border-muted-foreground/30"
                      }`}
                    >
                      <method.icon
                        className={`h-6 w-6 ${
                          paymentMethod === method.id
                            ? "text-primary"
                            : "text-muted-foreground"
                        }`}
                      />
                      <span className="text-xs font-medium">
                        {method.label}
                      </span>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Order summary */}
          <div>
            <Card className="sticky top-24">
              <CardHeader>
                <CardTitle className="text-base">Đơn hàng của bạn</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Items preview */}
                <div className="space-y-3">
                  {items.map((item) => (
                    <div key={item.id} className="flex items-center gap-3">
                      <div className="relative w-12 h-12 rounded-lg overflow-hidden bg-muted/50 shrink-0">
                        <Image
                          src={item.product.thumbnailUrl}
                          alt={item.product.name}
                          fill
                          className="object-cover"
                          unoptimized
                        />
                        <Badge className="absolute -top-1 -right-1 h-4 w-4 rounded-full p-0 flex items-center justify-center text-[8px]">
                          {item.quantity}
                        </Badge>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium line-clamp-1">
                          {item.product.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatPrice(item.selectedPrice)} × {item.quantity}
                        </p>
                      </div>
                      <p className="text-xs font-bold shrink-0">
                        {formatPrice(item.selectedPrice * item.quantity)}
                      </p>
                    </div>
                  ))}
                </div>

                <Separator />

                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Tạm tính</span>
                    <span>{formatPrice(subtotal)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Phí vận chuyển</span>
                    <span>{formatPrice(shippingFee)}</span>
                  </div>
                </div>

                <Separator />

                <div className="flex justify-between font-bold">
                  <span>Tổng cộng</span>
                  <span className="text-lg text-primary">
                    {formatPrice(totalAmount)}
                  </span>
                </div>

                <Button
                  type="submit"
                  className="w-full bg-gradient-brand text-white hover:opacity-90 h-12"
                  size="lg"
                >
                  Đặt hàng
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </form>
    </div>
  );
}
