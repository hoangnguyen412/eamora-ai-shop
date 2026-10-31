import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import AppShell from "@/components/layout/AppShell";
import ChatWidget from "@/components/shared/ChatWidget";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin", "vietnamese"],
});

export const metadata: Metadata = {
  title: "TechAI Shop — E-Commerce Đồ Công Nghệ Tích Hợp AI",
  description:
    "Nền tảng E-Commerce đồ công nghệ tích hợp AI: tìm kiếm thông minh, chatbot tư vấn, Price Agent theo dõi giá, và gợi ý cá nhân hóa.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi" className={`${inter.variable} h-full antialiased`} suppressHydrationWarning>
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        <AppShell>{children}</AppShell>
        <ChatWidget />
      </body>
    </html>
  );
}
