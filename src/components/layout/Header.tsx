"use client";

import Link from "next/link";
import { useCart } from "@/context/CartProvider";
import { Button } from "@/components/ui/button";
import {
  ShoppingCart,
  Search,
  MessageSquareText,
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
  onMenuClick: () => void;
}

export default function Header({ onMenuClick }: HeaderProps) {
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
          >
            <Menu className="h-5 w-5" />
          </Button>

          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 shrink-0">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-brand">
              <Cpu className="h-5 w-5 text-white" />
            </div>
            <span className="hidden sm:block text-xl font-bold text-gradient">
              TechAI Shop
            </span>
          </Link>

          {/* Desktop navigation */}
          <nav className="hidden lg:flex items-center gap-1">
            <Link href="/">
              <Button variant="ghost" className="text-sm font-medium">
                Trang chủ
              </Button>
            </Link>
            <Link href="/search">
              <Button variant="ghost" className="text-sm font-medium">
                <Search className="mr-1 h-4 w-4" />
                Tìm kiếm
              </Button>
            </Link>
            <Link href="/chat">
              <Button variant="ghost" className="text-sm font-medium">
                <MessageSquareText className="mr-1 h-4 w-4" />
                AI Chat
              </Button>
            </Link>
            <Link href="/watchlist">
              <Button variant="ghost" className="text-sm font-medium">
                <TrendingDown className="mr-1 h-4 w-4" />
                Price Agent
              </Button>
            </Link>
            <Link href="/seller">
              <Button variant="ghost" className="text-sm font-medium">
                <LayoutDashboard className="mr-1 h-4 w-4" />
                Seller
              </Button>
            </Link>
          </nav>

          {/* Right side */}
          <div className="flex items-center gap-2">
            {/* Cart */}
            <Link href="/cart">
              <Button variant="ghost" size="icon" className="relative">
                <ShoppingCart className="h-5 w-5" />
                {itemCount > 0 && (
                  <Badge className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 flex items-center justify-center text-[10px] bg-gradient-brand text-white border-0">
                    {itemCount}
                  </Badge>
                )}
              </Button>
            </Link>

            {!user ? (
              <Link href="/login">
                <Button variant="outline" size="sm" disabled={isLoading}>
                  {isLoading ? "Đang tải..." : "Đăng nhập"}
                </Button>
              </Link>
            ) : (
              <DropdownMenu>
                <DropdownMenuTrigger className="rounded-full cursor-pointer outline-none">
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
