"use client";

import mockData from "@/mocks/db.json";
import { Order } from "@/types";
import { formatPrice, formatDate, getStatusColor, getStatusLabel } from "@/lib/helpers";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DollarSign, Package, ShoppingCart, TrendingUp } from "lucide-react";

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
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Seller Dashboard</h1>
        <p className="text-sm text-muted-foreground">Quản lý đơn hàng và sản phẩm của bạn</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardContent className="p-4 flex items-center gap-4">
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
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Quản lý đơn hàng</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
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
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="products">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Danh sách sản phẩm</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
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
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
