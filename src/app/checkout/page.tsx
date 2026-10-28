"use client";

import { useState, type FormEvent } from "react";
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
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [token, setToken] = useState("");
  const [orderId, setOrderId] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const apiBaseUrl = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000").replace(/\/$/, "");

  if (submitted) {
    return (
      <div className="mx-auto max-w-lg px-4 py-20 text-center space-y-4">
        <div className="flex h-20 w-20 mx-auto items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
          <CheckCircle2 className="h-10 w-10 text-green-600 dark:text-green-400" />
        </div>
        <h2 className="text-2xl font-bold">Đặt hàng thành công!</h2>
        <p className="text-muted-foreground">
          Mã đơn hàng: <strong>{orderId}</strong>
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

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!city) {
      setError("Vui lòng chọn thành phố giao hàng.");
      return;
    }

    if (items.some((item) => !item.listingId || !item.shopId)) {
      setError("Vui lòng chọn nhà bán cho tất cả sản phẩm trong giỏ hàng.");
      return;
    }

    if (new Set(items.map((item) => item.shopId)).size !== 1) {
      setError("Một đơn hàng chỉ có thể chứa sản phẩm từ cùng một nhà bán.");
      return;
    }

    if (items.some((item) => item.quantity > (item.product.offers?.find((offer) => offer.listingId === item.listingId)?.stock ?? 0))) {
      setError("Số lượng trong giỏ vượt quá tồn kho của nhà bán đã chọn.");
      return;
    }

    setError("");
    setIsSubmitting(true);

    try {
      let activeToken = token;
      if (!activeToken) {
        const loginResponse = await fetch(`${apiBaseUrl}/api/auth/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        });
        const loginResult = await loginResponse.json() as {
          token?: string;
          message?: string;
          user?: { role?: string };
        };

        if (!loginResponse.ok || !loginResult.token) {
          throw new Error(loginResult.message || "Đăng nhập thất bại. Vui lòng kiểm tra email và mật khẩu.");
        }
        if (loginResult.user?.role !== "buyer") {
          throw new Error("Tài khoản seller không thể đặt hàng. Vui lòng đăng nhập bằng tài khoản buyer.");
        }

        activeToken = loginResult.token;
        setToken(activeToken);
      }

      const orderResponse = await fetch(`${apiBaseUrl}/api/orders`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${activeToken}`,
        },
        body: JSON.stringify({
          items: items.map((item) => ({
            listingId: item.listingId,
            quantity: item.quantity,
          })),
          shipping_info: { fullName, phone, address, city },
          payment_method: paymentMethod,
        }),
      });
      const orderResult = await orderResponse.json() as {
        success?: boolean;
        data?: { id?: string };
        message?: string;
      };

      if (!orderResponse.ok || !orderResult.success || !orderResult.data?.id) {
        if (orderResponse.status === 401) setToken("");
        throw new Error(orderResult.message || "Không thể tạo đơn hàng. Vui lòng thử lại.");
      }

      setOrderId(orderResult.data.id);
      clearCart();
      setSubmitted(true);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Không thể hoàn tất đơn hàng.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-2xl font-bold mb-6">Thanh toán</h1>

      <form onSubmit={handleSubmit}>
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Shipping + Payment */}
          <div className="lg:col-span-2 space-y-6">
            {!token && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Đăng nhập tài khoản buyer</CardTitle>
                </CardHeader>
                <CardContent className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label htmlFor="buyer-email" className="text-sm font-medium">Email</label>
                    <Input
                      id="buyer-email"
                      type="email"
                      autoComplete="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      required
                      placeholder="Email tài khoản"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label htmlFor="buyer-password" className="text-sm font-medium">Mật khẩu</label>
                    <Input
                      id="buyer-password"
                      type="password"
                      autoComplete="current-password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      required
                      placeholder="Mật khẩu"
                    />
                  </div>
                </CardContent>
              </Card>
            )}

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
                      id="shipping-name"
                      autoComplete="name"
                      value={fullName}
                      onChange={(event) => setFullName(event.target.value)}
                      required
                      placeholder="Nhập họ tên"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Số điện thoại</label>
                    <Input
                      id="shipping-phone"
                      type="tel"
                      autoComplete="tel"
                      value={phone}
                      onChange={(event) => setPhone(event.target.value)}
                      required
                      placeholder="Nhập số điện thoại"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Địa chỉ</label>
                  <Input
                    id="shipping-address"
                    autoComplete="street-address"
                    value={address}
                    onChange={(event) => setAddress(event.target.value)}
                    required
                    placeholder="Nhập địa chỉ"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Thành phố</label>
                  <Select value={city || null} onValueChange={(value) => setCity(value ?? "")}>
                    <SelectTrigger>
                      <SelectValue placeholder="Chọn thành phố" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="TP. Hồ Chí Minh">TP. Hồ Chí Minh</SelectItem>
                      <SelectItem value="Hà Nội">Hà Nội</SelectItem>
                      <SelectItem value="Đà Nẵng">Đà Nẵng</SelectItem>
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

                {error && (
                  <p role="alert" className="text-sm text-destructive">{error}</p>
                )}
                <Button
                  type="submit"
                  className="w-full bg-gradient-brand text-white hover:opacity-90 h-12"
                  size="lg"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? "Đang xử lý..." : "Đặt hàng"}
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </form>
    </div>
  );
}
