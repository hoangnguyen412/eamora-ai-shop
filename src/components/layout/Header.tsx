"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCart } from "@/context/CartProvider";
import {
  ShoppingCart,
  Search,
  Menu,
  LayoutDashboard,
  TrendingDown,
} from "lucide-react";
import ThemeToggle from "@/components/layout/ThemeToggle";
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
      "relative inline-flex items-center gap-1.5 px-3.5 py-2 text-sm transition-colors duration-200",
      "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
      "after:absolute after:inset-x-3.5 after:-bottom-[17px] after:h-0.5 after:origin-left after:bg-brand after:transition-transform after:duration-300",
      active
        ? "font-semibold text-foreground after:scale-x-100"
        : "font-medium text-muted-foreground hover:text-foreground after:scale-x-0 hover:after:scale-x-100",
    ].join(" ");

  useEffect(() => {
    setIsMounted(true);
  }, []);

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/90 backdrop-blur">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between gap-4">
          {/* Mobile menu button */}
          <button
            type="button"
            className="inline-flex h-10 w-10 items-center justify-center text-foreground transition-colors duration-200 hover:bg-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring lg:hidden"
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
            className="flex shrink-0 items-center gap-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            <span className="h-3 w-3 bg-brand" aria-hidden="true" />
            <span className="font-heading text-xl font-extrabold sm:text-2xl uppercase leading-none tracking-[0.02em]">
              Eamora
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
          <div className="flex items-center gap-1">
            <ThemeToggle />
            {/* Cart */}
            <Link
              href="/cart"
              className="relative inline-flex h-10 w-10 items-center justify-center text-foreground transition-colors duration-200 hover:bg-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              aria-label={`Giỏ hàng${isMounted && itemCount > 0 ? `, ${itemCount} sản phẩm` : ""}`}
            >
              <ShoppingCart className="h-5 w-5" aria-hidden="true" />
              {isMounted && (
                <span
                  aria-hidden="true"
                  className="absolute right-0 top-0 flex h-4 min-w-4 items-center justify-center bg-brand px-1 text-[10px] font-bold text-[#111315]"
                >
                  {itemCount}
                </span>
              )}
            </Link>

            {!user ? (
              <Link
                href="/login"
                className="ml-1 inline-flex h-10 items-center whitespace-nowrap bg-foreground px-3 sm:px-5 text-sm font-semibold text-background transition-colors duration-200 hover:bg-brand hover:text-[#111315] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
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
