"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCart } from "@/context/CartProvider";
import {
  ShoppingCart,
  Search,
  Menu,
  Cpu,
  LayoutDashboard,
  TrendingDown,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/context/AuthProvider";
import { useState, useEffect } from "react";

// Chỉ khách đã đăng nhập mới cần DropdownMenu + Avatar (base-ui) → tách chunk.
const AccountMenu = dynamic(() => import("@/components/layout/AccountMenu"), {
  ssr: false,
});

interface HeaderProps {
  menuOpen: boolean;
  onMenuClick: () => void;
}

export default function Header({ menuOpen, onMenuClick }: HeaderProps) {
  const { itemCount } = useCart();
  const { user, isLoading, signOut } = useAuth();
  const pathname = usePathname();
  const [isMounted, setIsMounted] = useState(false);

  const navLinkClass = (active: boolean) =>
    [
      "inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-sm transition-all duration-200",
      "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600",
      active
        ? "bg-blue-50 font-semibold text-blue-700"
        : "font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900",
    ].join(" ");

  useEffect(() => {
    setIsMounted(true);
  }, []);

  return (
    <header className="sticky top-0 z-50 border-b border-gray-200 bg-white/95 backdrop-blur">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between gap-4">
          {/* Mobile menu button */}
          <button
            type="button"
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-gray-700 transition-colors duration-200 hover:bg-gray-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 lg:hidden"
            onClick={onMenuClick}
            aria-label="Mở menu điều hướng"
            aria-expanded={menuOpen}
            aria-controls="navigation-sidebar"
          >
            <Menu className="h-5 w-5" />
          </button>

          {/* Logo */}
          <Link
            href="/"
            className="flex shrink-0 items-center gap-2 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-gray-900">
              <Cpu className="h-5 w-5 text-white" aria-hidden="true" />
            </span>
            <span className="flex flex-col leading-none">
              <span className="font-heading text-xl font-bold tracking-tight text-gray-900">
                Amora
              </span>
              <span className="mt-0.5 text-[10px] font-medium uppercase tracking-[0.18em] text-gray-400">
                Tech store
              </span>
            </span>
          </Link>

          {/* Desktop navigation */}
          <nav aria-label="Điều hướng chính" className="hidden items-center gap-1 lg:flex">
            <Link href="/" className={navLinkClass(pathname === "/")}>
              Trang chủ
            </Link>
            <Link href="/search" className={navLinkClass(pathname.startsWith("/search"))}>
              <Search className="mr-1 h-4 w-4" aria-hidden="true" />
              Tìm kiếm
            </Link>
            <Link href="/watchlist" className={navLinkClass(pathname.startsWith("/watchlist"))}>
              <TrendingDown className="mr-1 h-4 w-4" aria-hidden="true" />
              Price Agent
            </Link>
            <Link href="/seller/login" className={navLinkClass(pathname.startsWith("/seller"))}>
              <LayoutDashboard className="mr-1 h-4 w-4" aria-hidden="true" />
              Seller
            </Link>
          </nav>

          {/* Right side */}
          <div className="flex items-center gap-2">
            {/* Cart */}
            <Link
              href="/cart"
              className="relative inline-flex h-10 w-10 items-center justify-center rounded-full text-gray-700 transition-all duration-200 hover:bg-gray-100 hover:text-gray-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
              aria-label={`Giỏ hàng${isMounted && itemCount > 0 ? `, ${itemCount} sản phẩm` : ""}`}
            >
              <ShoppingCart className="h-5 w-5" aria-hidden="true" />
              {isMounted && (
                <Badge
                  aria-hidden="true"
                  className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full border-0 bg-blue-600 p-0 px-1 text-[10px] text-white"
                >
                  {itemCount}
                </Badge>
              )}
            </Link>

            {!user ? (
              <Link
                href="/login"
                className="inline-flex h-10 items-center rounded-full bg-blue-600 px-5 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:bg-blue-700 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
              >
                {isLoading ? "Đang tải..." : "Đăng nhập"}
              </Link>
            ) : (
              <AccountMenu
                email={user.email}
                role={user.role}
                onSignOut={signOut}
              />
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
