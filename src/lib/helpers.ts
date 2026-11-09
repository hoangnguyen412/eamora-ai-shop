import { Product } from "@/types";

export function formatPrice(price: number): string {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(price);
}

export function formatDate(dateStr: string): string {
  return new Intl.DateTimeFormat("vi-VN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(dateStr));
}

export function getStatusColor(status: string): string {
  const map: Record<string, string> = {
    pending: "bg-secondary text-foreground",
    processing: "bg-foreground text-background",
    shipped: "border-foreground bg-transparent text-foreground",
    delivered: "bg-success/10 text-success",
    cancelled: "bg-destructive/10 text-destructive",
    active: "bg-success/10 text-success",
    out_of_stock: "bg-destructive/10 text-destructive",
  };
  return map[status] || "bg-secondary text-foreground";
}

export function getStatusLabel(status: string): string {
  const map: Record<string, string> = {
    pending: "Chờ xử lý",
    processing: "Đang xử lý",
    shipped: "Đang giao",
    delivered: "Đã giao",
    cancelled: "Đã hủy",
    active: "Đang bán",
    out_of_stock: "Hết hàng",
  };
  return map[status] || status;
}

export function getBadgeVariant(type: string): "default" | "secondary" | "destructive" | "outline" {
  const map: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
    ai_pick: "default",
    similar_user: "secondary",
    price_drop: "destructive",
    frequently_viewed: "outline",
  };
  return map[type] || "outline";
}

export function filterProducts(
  products: Product[],
  filters: {
    category?: string;
    brand?: string;
    minPrice?: number;
    maxPrice?: number;
    search?: string;
  }
): Product[] {
  return products.filter((p) => {
    if (filters.category && filters.category !== "all" && p.category !== filters.category) return false;
    if (filters.brand && filters.brand !== "all" && p.brand !== filters.brand) return false;
    if (filters.minPrice && p.price < filters.minPrice) return false;
    if (filters.maxPrice && p.price > filters.maxPrice) return false;
    if (filters.search) {
      const q = filters.search.toLowerCase();
      return (
        p.name.toLowerCase().includes(q) ||
        p.brand.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q)
      );
    }
    return true;
  });
}
