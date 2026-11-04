"use client";

import { Suspense, useState } from "react";
import dynamic from "next/dynamic";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import { CartProvider } from "@/context/CartProvider";
import { AuthProvider } from "@/context/AuthProvider";

// Drawer điều hướng (base-ui Sheet) chỉ cần khi người dùng bấm menu.
const Sidebar = dynamic(() => import("@/components/layout/Sidebar"), {
  ssr: false,
});

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarMounted, setSidebarMounted] = useState(false);

  const openSidebar = () => {
    setSidebarMounted(true);
    setSidebarOpen(true);
  };

  return (
    <AuthProvider>
      <CartProvider>
        <a
          href="#main-content"
          className="sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-md focus:bg-background focus:px-4 focus:py-2 focus:text-foreground focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-ring"
        >
          Bỏ qua đến nội dung chính
        </a>
        <Suspense fallback={<div className="h-16 bg-white border-b"></div>}>
          <Header menuOpen={sidebarOpen} onMenuClick={openSidebar} />
        </Suspense>
        {sidebarMounted && (
          <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        )}
        <main id="main-content" tabIndex={-1} className="flex-1">
          {children}
        </main>
        <Footer />
      </CartProvider>
    </AuthProvider>
  );
}
