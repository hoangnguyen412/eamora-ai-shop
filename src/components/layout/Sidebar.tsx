"use client";

import Link from "next/link";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import {
  Home,
  Search,
  ShoppingCart,
  LayoutDashboard,
  Laptop,
  Smartphone,
  Headphones,
  Cpu,
  TrendingDown,
} from "lucide-react";

interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

const navItems = [
  { href: "/", icon: Home, label: "Trang chủ" },
  { href: "/search", icon: Search, label: "Tìm kiếm" },
  { href: "/watchlist", icon: TrendingDown, label: "Price Agent" },
  { href: "/cart", icon: ShoppingCart, label: "Giỏ hàng" },
  { href: "/seller", icon: LayoutDashboard, label: "Seller Dashboard" },
];

const categories = [
  { icon: Laptop, label: "Laptop", href: "/search?category=Laptop" },
  { icon: Smartphone, label: "Điện thoại", href: "/search?category=Smartphone" },
  { icon: Headphones, label: "Phụ kiện", href: "/search?category=Accessories" },
];

const itemClass =
  "mb-0.5 flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-gray-700 transition-colors duration-200 hover:bg-gray-100 hover:text-gray-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600";

export default function Sidebar({ open, onClose }: SidebarProps) {
  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent id="navigation-sidebar" side="left" className="w-72 p-0">
        <SheetHeader className="p-4 pb-2">
          <SheetTitle className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-900">
              <Cpu className="h-4 w-4 text-white" aria-hidden="true" />
            </span>
            <span className="font-heading text-lg font-bold tracking-tight text-gray-900">
              Amora
            </span>
          </SheetTitle>
        </SheetHeader>

        <div className="px-2 py-2">
          <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-gray-400">
            Điều hướng
          </p>
          {navItems.map((item) => (
            <Link key={item.href} href={item.href} onClick={onClose} className={itemClass}>
              <item.icon className="h-4 w-4" aria-hidden="true" />
              {item.label}
            </Link>
          ))}
        </div>

        <Separator className="my-2" />

        <div className="px-2 py-2">
          <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-gray-400">
            Danh mục
          </p>
          {categories.map((cat) => (
            <Link key={cat.label} href={cat.href} onClick={onClose} className={itemClass}>
              <cat.icon className="h-4 w-4" aria-hidden="true" />
              {cat.label}
            </Link>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}
