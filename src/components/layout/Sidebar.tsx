"use client";

import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
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
  { icon: Smartphone, label: "Smartphone", href: "/search?category=Smartphone" },
  { icon: Headphones, label: "Accessories", href: "/search?category=Accessories" },
];

export default function Sidebar({ open, onClose }: SidebarProps) {
  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent id="navigation-sidebar" side="left" className="w-72 p-0">
        <SheetHeader className="p-4 pb-2">
          <SheetTitle className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-brand">
              <Cpu className="h-4 w-4 text-white" />
            </div>
            <span className="text-gradient font-bold">TechAI Shop</span>
          </SheetTitle>
        </SheetHeader>

        <div className="px-2 py-2">
          <p className="px-3 mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Điều hướng
          </p>
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={onClose}
              className={buttonVariants({ variant: "ghost", className: "mb-0.5 w-full justify-start gap-3 text-sm font-medium" })}
            >
              <item.icon className="h-4 w-4" aria-hidden="true" />
              {item.label}
            </Link>
          ))}
        </div>

        <Separator className="my-2" />

        <div className="px-2 py-2">
          <p className="px-3 mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Danh mục
          </p>
          {categories.map((cat) => (
            <Link
              key={cat.label}
              href={cat.href}
              onClick={onClose}
              className={buttonVariants({ variant: "ghost", className: "mb-0.5 w-full justify-start gap-3 text-sm font-medium" })}
            >
              <cat.icon className="h-4 w-4" aria-hidden="true" />
              {cat.label}
            </Link>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}
