import type { Metadata } from "next";
import "./globals.css";
import AppShell from "@/components/layout/AppShell";
import ChatWidgetMount from "@/components/shared/ChatWidgetMount";

export const metadata: Metadata = {
  title: "Amora - Công nghệ chính hãng",
  description:
    "Cửa hàng công nghệ chính hãng: điện thoại, laptop, âm thanh và nhà thông minh.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi" className="h-full antialiased" suppressHydrationWarning>
      <body className="min-h-full flex flex-col font-sans bg-background text-foreground" suppressHydrationWarning>
        {/* React hoists <link rel="preload"> lên <head> — font latin nạp song song với CSS. */}
        <link
          rel="preload"
          href="/fonts/inter-latin.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
        <link
          rel="preload"
          href="/fonts/space-grotesk-latin.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
        <AppShell>{children}</AppShell>
        <ChatWidgetMount />
      </body>
    </html>
  );
}
