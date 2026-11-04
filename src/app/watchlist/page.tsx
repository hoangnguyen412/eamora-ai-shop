"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import Image from "next/image";
import { BellOff, BellRing, ListX, TrendingDown, Clock, Package } from "lucide-react";
import { useAuth } from "@/context/AuthProvider";
import { formatDate, formatPrice } from "@/lib/helpers";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

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
  imageUrl?: string | null;
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

interface QueueEntry {
  id: string;
  status: string;
  result?: {
    dqs?: number;
    reason?: string;
    evaluated_price?: number | null;
    target_price?: number;
    order_id?: string;
    would_buy?: boolean;
    sandbox?: boolean;
  } | null;
  watchlist: {
    id: string;
    targetPrice: number;
    product: { id: string; name: string };
  };
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
  const [queue, setQueue] = useState<QueueEntry[]>([]);
  const [autoBuy, setAutoBuy] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingRule, setIsSavingRule] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadAgentData = useCallback(async (signal: AbortSignal) => {
    setError("");
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const [historyResponse, ruleResponse, queueResponse] = await Promise.all([
        fetch(`${API_BASE_URL}/api/agent/history`, { headers, signal }),
        fetch(`${API_BASE_URL}/api/agent/rules`, { headers, signal }),
        fetch(`${API_BASE_URL}/api/agent/queue`, { headers, signal }),
      ]);
      const [history, rules, queueData] = await Promise.all([
        historyResponse.json() as Promise<AgentHistoryResponse>,
        ruleResponse.json() as Promise<RuleResponse>,
        queueResponse.json() as Promise<{ success: boolean; data: QueueEntry[]; message?: string }>,
      ]);

      if (!historyResponse.ok || !history.success) {
        throw new Error(history.message || "Không thể tải danh sách theo dõi.");
      }
      if (!ruleResponse.ok || !rules.success) {
        throw new Error(rules.message || "Không thể tải cấu hình Price Agent.");
      }
      if (!queueResponse.ok || !queueData.success) {
        throw new Error(queueData.message || "Không thể tải hàng đợi tự động mua.");
      }

      setWatchlist(history.data.watchlist);
      setOrders(history.data.orders);
      setAutoBuy(rules.data.auto_buy);
      setQueue(queueData.data);
    } catch (loadError) {
      if (loadError instanceof Error && loadError.name === "AbortError") return;
      setError(loadError instanceof Error ? loadError.message : "Không thể tải dữ liệu Price Agent.");
    } finally {
      if (!signal.aborted) setIsLoading(false);
    }
  }, [token]);

  const handleDelete = async (watchId: string) => {
    setError("");
    try {
      const response = await fetch(`${API_BASE_URL}/api/agent/watch/${encodeURIComponent(watchId)}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });
      const result = await response.json() as { success?: boolean; message?: string };
      if (!response.ok || !result.success) {
        throw new Error(result.message || "Không thể xoá sản phẩm khỏi danh sách theo dõi.");
      }
      setWatchlist((prev) => prev.filter((watch) => watch.id !== watchId));
      setNotice("Đã xoá sản phẩm khỏi danh sách theo dõi.");
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Không thể xoá sản phẩm.");
    }
  };

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

  const handleExecute = async (queueId: string) => {
    if (!token) return;
    setIsExecuting(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch(`${API_BASE_URL}/api/agent/queue/${encodeURIComponent(queueId)}/execute`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });
      const result = await response.json() as { success?: boolean; data?: QueueEntry; message?: string };
      if (!response.ok || !result.success) {
        throw new Error(result.message || "Không thể thực thi hàng đợi.");
      }
      setNotice("Đã thực thi hàng đợi tự động mua.");
      await loadAgentData(new AbortController().signal);
    } catch (execError) {
      setError(execError instanceof Error ? execError.message : "Không thể thực thi hàng đợi.");
    } finally {
      setIsExecuting(false);
    }
  };

  const priceNotifications = watchlist.flatMap((watch) => watch.status === "active"
    ? watch.product.listings
      .filter((listing) => listing.stock > 0 && listing.price <= watch.targetPrice)
      .map((listing) => ({ watch, listing }))
    : []);

  if (isAuthLoading) {
    return (
      <div role="status" aria-label="Đang tải Price Agent" className="mx-auto max-w-5xl space-y-4 px-4 py-12 sm:px-6 lg:px-8">
        <div className="h-8 w-48 animate-pulse rounded bg-muted" />
        <div className="h-28 animate-pulse rounded-xl bg-muted" />
        <div className="h-44 animate-pulse rounded-xl bg-muted" />
      </div>
    );
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
            <Link href="/login?next=%2Fwatchlist" className={buttonVariants()}>
              Đăng nhập / Đăng ký buyer
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
      <header className="space-y-2 rounded-xl border border-gray-200 bg-gray-50 p-5 sm:p-6">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-blue-600 text-white">
            <TrendingDown className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <h1 className="font-heading text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">Price Agent</h1>
            <p className="text-sm text-gray-500">Theo dõi mức giá và quản lý cấu hình của bạn.</p>
          </div>
        </div>
      </header>

      {error && <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">{error}</p>}
      {notice && <p role="status" className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 text-sm text-emerald-700 dark:text-emerald-300">{notice}</p>}

      <section className="space-y-4" aria-labelledby="price-alerts-heading">
        <div>
          <h2 id="price-alerts-heading" className="text-xl font-semibold">Thông báo giá</h2>
          <p className="text-sm text-muted-foreground">
            Cập nhật biến động giá thực tế của các sản phẩm bạn quan tâm.
          </p>
        </div>
        {priceNotifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-12 text-center rounded-xl border bg-muted/50">
            <BellOff className="h-10 w-10 text-muted-foreground" />
            <div>
              <h3 className="font-semibold">Chưa có cảnh báo giá nào</h3>
              <p className="text-sm text-muted-foreground">
                Bạn sẽ nhận được thông báo khi sản phẩm trong watchlist giảm giá.
              </p>
            </div>
          </div>
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

      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <BellRing className="h-5 w-5 text-blue-600" aria-hidden="true" />
          <h2 className="text-xl font-semibold">Quy tắc mua tự động</h2>
        </div>
        <p className="text-sm text-muted-foreground mb-6">
          Tự động tạo đơn hàng thử nghiệm khi giá sản phẩm chạm ngưỡng mong muốn.
        </p>
        <form onSubmit={handleSaveRule} className="flex items-center gap-4">
          <label className="relative inline-flex items-center cursor-pointer gap-3">
            <input
              id="auto-buy"
              type="checkbox"
              role="switch"
              aria-checked={autoBuy}
              checked={autoBuy}
              onChange={(event) => setAutoBuy(event.target.checked)}
              className="sr-only peer"
            />
            <div
              className={`
                w-11 h-6 bg-gray-200 rounded-full peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-200
                peer peer-checked:bg-blue-600
                after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border
                after:rounded-full after:h-5 after:w-5 after:transition-all
                peer-checked:after:translate-x-full peer-checked:after:border-white
              `}
              aria-hidden="true"
            />
            <span className="ml-3 text-sm font-medium text-gray-900">Bật mua tự động</span>
            <span className="text-xs text-muted-foreground">
              Tự động tạo đơn hàng thử nghiệm khi giá sản phẩm chạm ngưỡng mong muốn.
            </span>
          </label>
          <Button type="submit" disabled={isSavingRule}>
            {isSavingRule ? "Đang lưu..." : "Lưu cấu hình"}
          </Button>
        </form>
      </div>

      <section className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold">Sản phẩm đang theo dõi</h2>
          <p className="text-sm text-muted-foreground">Danh sách sản phẩm bạn đang theo dõi giá.</p>
        </div>
        {watchlist.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-12 text-center rounded-xl border bg-muted/50">
            <ListX className="h-10 w-10 text-muted-foreground" />
            <div>
              <h3 className="font-semibold">Danh sách theo dõi của bạn đang trống</h3>
              <p className="text-sm text-muted-foreground">Thêm sản phẩm để Price Agent theo dõi và cảnh báo giá.</p>
            </div>
            <Link href="/search" className={buttonVariants({ variant: "default" })}>Thêm sản phẩm ngay</Link>
          </div>
        ) : (
          watchlist.map((watch) => {
            const pricesWithStock = watch.product.listings
              .filter((listing) => listing.stock > 0)
              .map((listing) => listing.price);
            const allPrices = watch.product.listings.map((listing) => listing.price);
            const currentPrice =
              pricesWithStock.length > 0
                ? Math.min(...pricesWithStock)
                : allPrices.length > 0
                  ? Math.min(...allPrices)
                  : 0;
            const isTargetReached = currentPrice > 0 && currentPrice <= watch.targetPrice;

            return (
              <Card key={watch.id} className="flex flex-col gap-4 sm:flex-row sm:items-center">
                <div className="flex-shrink-0">
                  {watch.product.imageUrl ? (
                    <Image
                      src={watch.product.imageUrl}
                      alt={watch.product.name}
                      width={80}
                      height={80}
                      className="rounded-xl object-cover"
                    />
                  ) : (
                    <div className="h-20 w-20 rounded-xl bg-muted/50 flex items-center justify-center text-muted-foreground">
                      <span className="text-xs">Không có ảnh</span>
                    </div>
                  )}
                </div>
                <div className="flex-1 space-y-2">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <Link href={`/products/${watch.product.id}`} className="text-lg font-semibold hover:text-primary">
                        {watch.product.name}
                      </Link>
                      <p className="text-sm text-muted-foreground">
                        Theo dõi từ {formatDate(watch.createdAt)} · {watch.product.listings.length} listing
                      </p>
                    </div>
                    <div className="text-right">
                      {isTargetReached ? (
                        <Badge variant="default" className="bg-emerald-100 text-emerald-800 border-emerald-200">
                          Đã chạm giá mục tiêu
                        </Badge>
                      ) : (
                        <Badge variant={watch.status === "active" ? "default" : "secondary"}>
                          {watch.status}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4 pt-2 border-t">
                    <div>
                      <p className="text-xs text-muted-foreground">Giá hiện tại</p>
                      <p className="text-sm font-medium">{currentPrice > 0 ? formatPrice(currentPrice) : "—"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Giá mục tiêu</p>
                      <p className="text-sm font-medium text-primary">{formatPrice(watch.targetPrice)}</p>
                    </div>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleDelete(watch.id)}
                  className="shrink-0"
                >
                  Xóa
                </Button>
              </Card>
            );
          })
        )}
      </section>

      <section className="space-y-4" aria-labelledby="auto-buy-queue-heading">
        <div>
          <h2 id="auto-buy-queue-heading" className="text-xl font-semibold">Hàng đợi tự động mua</h2>
          <p className="text-sm text-muted-foreground">
            Danh sách sản phẩm chờ xử lý mua tự động (sandbox). Chỉ hiển thị khi bật Auto-buy.
          </p>
        </div>
        {queue.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center gap-4 py-12 text-center">
              <Clock className="h-12 w-12 text-muted-foreground" />
              <div>
                <h3 className="font-semibold">Chưa có sản phẩm nào trong hàng đợi</h3>
                <p className="text-sm text-muted-foreground">Bật Auto-buy và thêm sản phẩm vào hàng đợi để tự động mua (sandbox).</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Sản phẩm</TableHead>
                <TableHead className="text-center">DQS</TableHead>
                <TableHead className="text-right">Giá deal</TableHead>
                <TableHead className="text-center">Trạng thái</TableHead>
                <TableHead className="text-center">Hành động</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {queue.map((item) => {
                const dqs = item.result?.dqs ?? "-";
                const dealPrice = item.result?.evaluated_price ?? null;
                const targetPrice = item.watchlist.targetPrice;
                const status = item.status;
                const isPending = status === "pending";
                const badgeVariant =
                  status === "completed" || status === "executed" ? "default" : status === "rejected" ? "destructive" : "secondary";
                const statusLabel =
                  status === "completed" ? "executed" : status === "pending" ? "pending" : status === "rejected" ? "rejected" : status;
                return (
                  <TableRow key={item.id}>
                    <TableCell>
                      <div className="font-medium">{item.watchlist.product.name}</div>
                      <div className="text-xs text-muted-foreground">
                        Mục tiêu {formatPrice(targetPrice)}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      {typeof dqs === "number" ? dqs : "-"}
                    </TableCell>
                    <TableCell className="text-right">
                      {dealPrice !== null ? formatPrice(dealPrice) : "—"}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant={badgeVariant as any} className="text-xs capitalize">
                        {statusLabel}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      {isPending ? (
                        <Button
                          size="sm"
                          onClick={() => handleExecute(item.id)}
                          disabled={isExecuting}
                          className="text-xs"
                        >
                          Mua ngay
                        </Button>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold">Lịch sử đơn hàng</h2>
          <p className="text-sm text-muted-foreground">Đơn hàng gần đây của tài khoản buyer.</p>
        </div>
        {orders.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center gap-4 py-12 text-center">
              <Package className="h-12 w-12 text-muted-foreground" />
              <div>
                <h3 className="font-semibold">Chưa có đơn hàng</h3>
                <p className="text-sm text-muted-foreground">Đơn hàng của bạn sẽ hiển thị ở đây sau khi đặt hàng.</p>
              </div>
              <Link href="/search" className={buttonVariants({ variant: "outline" })}>
                Khám phá sản phẩm
              </Link>
            </CardContent>
          </Card>
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
