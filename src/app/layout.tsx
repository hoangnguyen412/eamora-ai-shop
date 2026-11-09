import type { Metadata } from "next";
import "./globals.css";
import AppShell from "@/components/layout/AppShell";
import ChatWidgetMount from "@/components/shared/ChatWidgetMount";

export const metadata: Metadata = {
  title: "Eamora - Công nghệ chính hãng",
  description:
    "Cửa hàng công nghệ chính hãng: điện thoại, laptop, âm thanh và nhà thông minh.",
};

// Chạy trước khi paint để tránh nháy sáng/tối; mặc định theo hệ điều hành.
const themeScript = `try{var t=localStorage.getItem("theme");if(t==="dark"||(!t&&matchMedia("(prefers-color-scheme: dark)").matches))document.documentElement.classList.add("dark")}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi" className="h-full antialiased" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
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
          href="/fonts/bricolage-latin.woff2"
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
