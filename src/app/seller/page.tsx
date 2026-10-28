"use client";

import mockData from "@/mocks/db.json";
import { Order } from "@/types";
import { formatPrice, formatDate, getStatusColor, getStatusLabel } from "@/lib/helpers";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertCircle, DollarSign, Package, ShoppingCart, TrendingUp } from "lucide-react";

const orders = mockData.orders as unknown as Order[];
const sellerProducts = mockData.sellerProducts;

const stats = [
  { label: "Doanh thu", value: formatPrice(orders.reduce((s, o) => s + o.totalAmount, 0)), icon: DollarSign, color: "from-emerald-500 to-teal-500" },
  { label: "Đơn hàng", value: orders.length.toString(), icon: ShoppingCart, color: "from-blue-500 to-cyan-500" },
  { label: "Sản phẩm", value: sellerProducts.length.toString(), icon: Package, color: "from-violet-500 to-indigo-500" },
  { label: "Tăng trưởng", value: "+12.5%", icon: TrendingUp, color: "from-amber-500 to-orange-500" },
];

export default function SellerPage() {
  return (
    <div className="mx-auto max-w-7xl space-y-8 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-primary">Kênh nhà bán</p>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Seller Dashboard</h1>
          <p className="text-sm text-muted-foreground">Quản lý đơn hàng và sản phẩm của bạn</p>
        </div>
        <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-800 dark:text-amber-300">
          Bản xem trước
        </span>
      </div>

      <div role="status" className="flex gap-3 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm text-amber-900 dark:text-amber-200">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
        <p>Các số liệu và bảng bên dưới là dữ liệu minh họa, chưa được kết nối với tài khoản nhà bán.</p>
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
                    {orders.map((order) => (
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
                    ))}
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
