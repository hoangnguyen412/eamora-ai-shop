"use client";

import Link from "next/link";
import { useCart } from "@/context/CartProvider";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  ShoppingCart,
  Search,
  Menu,
  Cpu,
  User,
  LayoutDashboard,
  TrendingDown,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useAuth } from "@/context/AuthProvider";

interface HeaderProps {
  menuOpen: boolean;
  onMenuClick: () => void;
}

export default function Header({ menuOpen, onMenuClick }: HeaderProps) {
  const { itemCount } = useCart();
  const { user, isLoading, signOut } = useAuth();

  return (
    <header className="sticky top-0 z-50 glass border-b">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between gap-4">
          {/* Mobile menu button */}
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={onMenuClick}
            aria-label="Mở menu điều hướng"
            aria-expanded={menuOpen}
            aria-controls="navigation-sidebar"
          >
            <Menu className="h-5 w-5" />
          </Button>

          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 shrink-0">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-brand">
              <Cpu className="h-5 w-5 text-white" />
            </div>
            <span className="text-sm font-bold text-gradient sm:text-xl">
              TechAI Shop
            </span>
          </Link>

          {/* Desktop navigation */}
          <nav aria-label="Điều hướng chính" className="hidden lg:flex items-center gap-1">
            <Link href="/" className={buttonVariants({ variant: "ghost", className: "text-sm font-medium" })}>
              Trang chủ
            </Link>
            <Link href="/search" className={buttonVariants({ variant: "ghost", className: "text-sm font-medium" })}>
              <Search className="mr-1 h-4 w-4" aria-hidden="true" />
              Tìm kiếm
            </Link>
            <Link href="/watchlist" className={buttonVariants({ variant: "ghost", className: "text-sm font-medium" })}>
              <TrendingDown className="mr-1 h-4 w-4" aria-hidden="true" />
              Price Agent
            </Link>
            <Link href="/seller" className={buttonVariants({ variant: "ghost", className: "text-sm font-medium" })}>
              <LayoutDashboard className="mr-1 h-4 w-4" aria-hidden="true" />
              Seller
            </Link>
          </nav>

          {/* Right side */}
          <div className="flex items-center gap-2">
            {/* Cart */}
            <Link
              href="/cart"
              className={buttonVariants({ variant: "ghost", size: "icon", className: "relative" })}
              aria-label={`Giỏ hàng${itemCount > 0 ? `, ${itemCount} sản phẩm` : ""}`}
            >
              <ShoppingCart className="h-5 w-5" aria-hidden="true" />
              {itemCount > 0 && (
                <Badge aria-hidden="true" className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 flex items-center justify-center text-[10px] bg-gradient-brand text-white border-0">
                  {itemCount}
                </Badge>
              )}
            </Link>

            {!user ? (
              <Link href="/login" className={buttonVariants({ variant: "outline", size: "sm" })}>
                {isLoading ? "Đang tải..." : "Đăng nhập"}
              </Link>
            ) : (
              <DropdownMenu>
                <DropdownMenuTrigger
                  aria-label="Mở menu tài khoản"
                  className="rounded-full cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  <Avatar className="h-8 w-8">
                    <AvatarFallback>
                      <User className="h-4 w-4" />
                    </AvatarFallback>
                  </Avatar>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <div className="px-2 py-1.5">
                    <p className="text-sm font-medium">{user.email}</p>
                    <p className="text-xs text-muted-foreground">
                      {user.role === "seller" ? "Nhà bán" : "Người mua"}
                    </p>
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={signOut}>Đăng xuất</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
