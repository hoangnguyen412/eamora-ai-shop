"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { BellRing, TrendingDown } from "lucide-react";
import { useAuth } from "@/context/AuthProvider";
import { formatDate, formatPrice } from "@/lib/helpers";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const API_BASE_URL = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000").replace(/\/$/, "");

interface RecordedPrice {
  id: string;
  price: number;
  recordedAt: string;
}

interface WatchedListing {
  id: string;
  price: number;
  stock: number;
  shop: { name: string };
  priceHistory: RecordedPrice[];
}

interface WatchedProduct {
  id: string;
  name: string;
  listings: WatchedListing[];
}

interface WatchEntry {
  id: string;
  targetPrice: number;
  status: string;
  createdAt: string;
  product: WatchedProduct;
}

interface OrderEntry {
  id: string;
  totalAmount: number;
  status: string;
  paymentMethod: string;
  createdAt: string;
}

interface AgentHistoryResponse {
  success: boolean;
  data: {
    watchlist: WatchEntry[];
    orders: OrderEntry[];
  };
  message?: string;
}

interface RuleResponse {
  success: boolean;
  data: { auto_buy: boolean };
  message?: string;
}

export default function WatchlistPage() {
  const { token, user, isLoading: isAuthLoading } = useAuth();
  const [watchlist, setWatchlist] = useState<WatchEntry[]>([]);
  const [orders, setOrders] = useState<OrderEntry[]>([]);
  const [autoBuy, setAutoBuy] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingRule, setIsSavingRule] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadAgentData = useCallback(async (signal: AbortSignal) => {
    setError("");
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const [historyResponse, ruleResponse] = await Promise.all([
        fetch(`${API_BASE_URL}/api/agent/history`, { headers, signal }),
        fetch(`${API_BASE_URL}/api/agent/rules`, { headers, signal }),
      ]);
      const [history, rules] = await Promise.all([
        historyResponse.json() as Promise<AgentHistoryResponse>,
        ruleResponse.json() as Promise<RuleResponse>,
      ]);

      if (!historyResponse.ok || !history.success) {
        throw new Error(history.message || "Không thể tải danh sách theo dõi.");
      }
      if (!ruleResponse.ok || !rules.success) {
        throw new Error(rules.message || "Không thể tải cấu hình Price Agent.");
      }

      setWatchlist(history.data.watchlist);
      setOrders(history.data.orders);
      setAutoBuy(rules.data.auto_buy);
    } catch (loadError) {
      if (loadError instanceof Error && loadError.name === "AbortError") return;
      setError(loadError instanceof Error ? loadError.message : "Không thể tải dữ liệu Price Agent.");
    } finally {
      if (!signal.aborted) setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (isAuthLoading || !token || user?.role !== "buyer") return;
    const controller = new AbortController();
    void Promise.resolve().then(() => loadAgentData(controller.signal));
    return () => controller.abort();
  }, [isAuthLoading, loadAgentData, token, user?.role]);

  const handleSaveRule = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!token) return;

    setIsSavingRule(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch(`${API_BASE_URL}/api/agent/rules`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ auto_buy: autoBuy }),
      });
      const result = await response.json() as RuleResponse;
      if (!response.ok || !result.success) {
        throw new Error(result.message || "Không thể lưu cấu hình Price Agent.");
      }

      setAutoBuy(result.data.auto_buy);
      setNotice("Đã lưu cấu hình Price Agent.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Không thể lưu cấu hình.");
    } finally {
      setIsSavingRule(false);
    }
  };

  const priceNotifications = watchlist.flatMap((watch) => watch.status === "active"
    ? watch.product.listings
      .filter((listing) => listing.stock > 0 && listing.price <= watch.targetPrice)
      .map((listing) => ({ watch, listing }))
    : []);

  if (isAuthLoading) {
    return <p role="status" className="py-16 text-center text-sm text-muted-foreground">Đang tải Price Agent...</p>;
  }

  if (!user || user.role !== "buyer") {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16">
        <Card>
          <CardHeader>
            <CardTitle>Cần tài khoản buyer</CardTitle>
            <CardDescription>Đăng nhập buyer để xem danh sách theo dõi và cấu hình Price Agent.</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/login?next=%2Fwatchlist">
              <Button>Đăng nhập / Đăng ký buyer</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return <p role="status" className="py-16 text-center text-sm text-muted-foreground">Đang tải Price Agent...</p>;
  }

  return (
    <div className="mx-auto max-w-5xl space-y-8 px-4 py-8 sm:px-6 lg:px-8">
      <header className="space-y-2">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 text-white">
            <TrendingDown className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Price Agent</h1>
            <p className="text-sm text-muted-foreground">Theo dõi mức giá và quản lý cấu hình của bạn.</p>
          </div>
        </div>
      </header>

      {error && <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</p>}
      {notice && <p role="status" className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3 text-sm text-emerald-700 dark:text-emerald-300">{notice}</p>}

      <section className="space-y-4" aria-labelledby="price-alerts-heading">
        <div>
          <h2 id="price-alerts-heading" className="text-xl font-semibold">Thông báo giá</h2>
          <p className="text-sm text-muted-foreground">
            Cảnh báo được tính từ giá listing hiện tại và watchlist trả về từ API; tải lại trang để kiểm tra giá mới nhất.
          </p>
        </div>
        {priceNotifications.length === 0 ? (
          <Card>
            <CardContent className="py-6 text-sm text-muted-foreground">
              Chưa có sản phẩm đang theo dõi nào chạm giá mục tiêu.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {priceNotifications.map(({ watch, listing }) => (
              <Card key={`${watch.id}-${listing.id}`} className="border-emerald-500/30">
                <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
                  <div>
                    <p className="font-medium">
                      <Link href={`/products/${watch.product.id}`} className="hover:text-primary">
                        {watch.product.name}
                      </Link>
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {listing.shop.name} · Giá mục tiêu {formatPrice(watch.targetPrice)}
                    </p>
                  </div>
                  <Badge variant="default">Đã chạm giá · {formatPrice(listing.price)}</Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BellRing className="h-4 w-4" />
            Quy tắc mua tự động
          </CardTitle>
          <CardDescription>
            Cấu hình được lưu vào tài khoản. Worker chỉ mô phỏng quyết định trong sandbox, không đặt đơn hoặc thanh toán.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSaveRule} className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <label htmlFor="auto-buy" className="flex items-start gap-3 text-sm">
              <input
                id="auto-buy"
                type="checkbox"
                checked={autoBuy}
                onChange={(event) => setAutoBuy(event.target.checked)}
                className="mt-0.5 h-4 w-4 accent-primary"
              />
              <span>
                <span className="block font-medium">Cho phép Auto-buy</span>
                <span className="text-muted-foreground">Cho phép xử lý sandbox; chưa thực hiện mua hàng thật.</span>
              </span>
            </label>
            <Button type="submit" disabled={isSavingRule}>
              {isSavingRule ? "Đang lưu..." : "Lưu cấu hình"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <section className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold">Sản phẩm đang theo dõi</h2>
          <p className="text-sm text-muted-foreground">Các mốc giá hiển thị là dữ liệu đã được backend ghi nhận.</p>
        </div>
        {watchlist.length === 0 ? (
          <Card>
            <CardContent className="space-y-3 py-8 text-center">
              <p className="text-sm text-muted-foreground">Bạn chưa theo dõi sản phẩm nào.</p>
              <Link href="/search"><Button variant="outline">Tìm sản phẩm</Button></Link>
            </CardContent>
          </Card>
        ) : (
          watchlist.map((watch) => {
            const recordedPrices = watch.product.listings.flatMap((listing) =>
              listing.priceHistory.map((point) => ({ ...point, shopName: listing.shop.name })),
            ).sort((left, right) => new Date(right.recordedAt).getTime() - new Date(left.recordedAt).getTime());

            return (
              <Card key={watch.id}>
                <CardHeader className="flex-row items-start justify-between gap-4">
                  <div className="space-y-1">
                    <CardTitle>
                      <Link href={`/products/${watch.product.id}`} className="hover:text-primary">
                        {watch.product.name}
                      </Link>
                    </CardTitle>
                    <CardDescription>Theo dõi từ {formatDate(watch.createdAt)}</CardDescription>
                  </div>
                  <Badge variant={watch.status === "active" ? "default" : "secondary"}>{watch.status}</Badge>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm">
                    Giá mục tiêu: <strong className="text-primary">{formatPrice(watch.targetPrice)}</strong>
                  </p>
                  {recordedPrices.length > 0 ? (
                    <div className="space-y-2">
                      <h3 className="text-sm font-medium">Lịch sử giá đã ghi nhận</h3>
                      <ul className="divide-y rounded-lg border">
                        {recordedPrices.slice(0, 10).map((point) => (
                          <li key={point.id} className="flex flex-wrap justify-between gap-2 px-3 py-2 text-sm">
                            <span>{point.shopName} · {formatDate(point.recordedAt)}</span>
                            <strong>{formatPrice(point.price)}</strong>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">Chưa có mốc giá nào được ghi nhận cho listing của sản phẩm.</p>
                  )}
                </CardContent>
              </Card>
            );
          })
        )}
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold">Lịch sử đơn hàng</h2>
          <p className="text-sm text-muted-foreground">Đơn hàng gần đây của tài khoản buyer.</p>
        </div>
        {orders.length === 0 ? (
          <Card><CardContent className="py-6 text-sm text-muted-foreground">Chưa có đơn hàng.</CardContent></Card>
        ) : (
          <div className="space-y-3">
            {orders.map((order) => (
              <Card key={order.id}>
                <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
                  <div>
                    <p className="font-medium">Đơn {order.id}</p>
                    <p className="text-xs text-muted-foreground">{formatDate(order.createdAt)} · {order.paymentMethod.toUpperCase()}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">{formatPrice(order.totalAmount)}</p>
                    <Badge variant="outline">{order.status}</Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
