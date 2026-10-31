"use client";

import { useEffect, useState } from "react";
import { Order } from "@/types";
import { formatPrice, formatDate, getStatusColor, getStatusLabel } from "@/lib/helpers";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertCircle, DollarSign, Package, ShoppingCart, TrendingUp } from "lucide-react";

import mockData from "@/mocks/db.json";

const sellerProducts = mockData.sellerProducts;

const API_BASE_URL = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000").replace(/\/$/, "");

export default function SellerPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;

    const fetchOrders = async () => {
      setIsLoading(true);
      setError("");
      try {
        const response = await fetch(`${API_BASE_URL}/api/orders`, {
          signal: controller.signal,
        });
        if (!response.ok) {
          throw new Error("Không thể tải danh sách đơn hàng.");
        }
        const result = await response.json() as { success?: boolean; data?: any[]; message?: string };
        if (!result.success) {
          throw new Error(result.message || "Không thể tải danh sách đơn hàng.");
        }

        const mapped: Order[] = (result.data ?? []).map((o) => ({
          id: o.id,
          userId: o.buyerId ?? o.userId ?? "",
          items: (o.items ?? []).map((item: any) => ({
            productId: item.listing?.product?.id ?? item.listingId ?? "",
            productName: item.listing?.product?.name ?? item.productName ?? "Sản phẩm",
            productImage: item.listing?.product?.thumbnailUrl ?? item.productImage ?? "",
            price: item.price ?? 0,
            quantity: item.quantity ?? 0,
          })),
          totalAmount: o.totalAmount ?? 0,
          status: o.status as Order["status"],
          paymentMethod: o.paymentMethod as Order["paymentMethod"],
          shippingAddress: o.shippingInfo ?? {},
          createdAt: o.createdAt ?? new Date().toISOString(),
        }));

        if (!cancelled) {
          setOrders(mapped);
        }
      } catch (err) {
        if (!cancelled && err instanceof Error && err.name !== "AbortError") {
          setError(err.message);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    fetchOrders();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, []);

  const totalRevenue = orders.reduce((sum, o) => sum + o.totalAmount, 0);
  const totalOrders = orders.length;

  const stats = [
    { label: "Doanh thu", value: formatPrice(totalRevenue), icon: DollarSign, color: "from-emerald-500 to-teal-500" },
    { label: "Đơn hàng", value: totalOrders.toString(), icon: ShoppingCart, color: "from-blue-500 to-cyan-500" },
    { label: "Sản phẩm", value: sellerProducts.length.toString(), icon: Package, color: "from-violet-500 to-indigo-500" },
    { label: "Tăng trưởng", value: "+12.5%", icon: TrendingUp, color: "from-amber-500 to-orange-500" },
  ];

  if (isLoading) {
    return (
      <div className="mx-auto max-w-7xl space-y-8 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-primary">Kênh nhà bán</p>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Seller Dashboard</h1>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">Đang tải đơn hàng...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-7xl space-y-8 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-primary">Kênh nhà bán</p>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Seller Dashboard</h1>
          </div>
        </div>
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-primary">Kênh nhà bán</p>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Seller Dashboard</h1>
          <p className="text-sm text-muted-foreground">Quản lý đơn hàng và sản phẩm của bạn</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        {stats.map((s) => (
          <Card key={s.label} className="border-border/70">
            <CardContent className="flex items-center gap-3 p-4 sm:gap-4">
              <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${s.color} shadow-lg`}>
                <s.icon className="h-6 w-6 text-white" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{s.label}</p>
                <p className="text-lg font-bold">{s.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tabs */}
      <Tabs defaultValue="orders">
        <TabsList>
          <TabsTrigger value="orders">Đơn hàng</TabsTrigger>
          <TabsTrigger value="products">Sản phẩm đăng bán</TabsTrigger>
        </TabsList>

        <TabsContent value="orders">
          <Card className="border-border/70">
            <CardHeader>
              <CardTitle className="text-base">Quản lý đơn hàng</CardTitle>
            </CardHeader>
            <CardContent>
              <Table containerLabel="Bảng quản lý đơn hàng, có thể cuộn ngang">
                <TableHeader>
                  <TableRow>
                    <TableHead>Mã đơn</TableHead>
                    <TableHead>Sản phẩm</TableHead>
                    <TableHead>Tổng tiền</TableHead>
                    <TableHead>Trạng thái</TableHead>
                    <TableHead>Thanh toán</TableHead>
                    <TableHead>Ngày tạo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-4 text-muted-foreground">
                        Chưa có đơn hàng nào.
                      </TableCell>
                    </TableRow>
                  ) : (
                    orders.map((order) => (
                      <TableRow key={order.id}>
                        <TableCell className="font-mono text-xs font-medium">{order.id}</TableCell>
                        <TableCell>
                          <div className="space-y-0.5">
                            {order.items.map((item, i) => (
                              <p key={i} className="text-xs">{item.productName} <span className="text-muted-foreground">×{item.quantity}</span></p>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell className="font-medium">{formatPrice(order.totalAmount)}</TableCell>
                        <TableCell>
                          <Badge className={`text-[10px] ${getStatusColor(order.status)}`}>{getStatusLabel(order.status)}</Badge>
                        </TableCell>
                        <TableCell className="text-xs uppercase">{order.paymentMethod}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{formatDate(order.createdAt)}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="products">
          <Card className="border-border/70">
            <CardHeader>
              <CardTitle className="text-base">Danh sách sản phẩm</CardTitle>
            </CardHeader>
            <CardContent>
                <Table containerLabel="Bảng sản phẩm đăng bán, có thể cuộn ngang">
                  <TableHeader>
                    <TableRow>
                      <TableHead>ID</TableHead>
                      <TableHead>Tên sản phẩm</TableHead>
                      <TableHead>Giá</TableHead>
                      <TableHead>Tồn kho</TableHead>
                      <TableHead>Đã bán</TableHead>
                      <TableHead>Trạng thái</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sellerProducts.map((sp) => (
                      <TableRow key={sp.id}>
                        <TableCell className="font-mono text-xs">{sp.id}</TableCell>
                        <TableCell className="font-medium text-sm">{sp.name}</TableCell>
                        <TableCell>{formatPrice(sp.price)}</TableCell>
                        <TableCell>{sp.stock}</TableCell>
                        <TableCell>{sp.totalSold}</TableCell>
                        <TableCell>
                          <Badge className={`text-[10px] ${getStatusColor(sp.status)}`}>{getStatusLabel(sp.status)}</Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
