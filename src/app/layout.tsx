import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import AppShell from "@/components/layout/AppShell";
import ChatWidget from "@/components/shared/ChatWidget";

const plusJakartaSans = Plus_Jakarta_Sans({
  variable: "--font-sans",
  subsets: ["latin", "vietnamese"],
});

export const metadata: Metadata = {
  title: "Amora - AI-Powered Tech Store",
  description:
    "Nền tảng E-commerce đồ công nghệ tích hợp AI thông minh.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi" className={`${plusJakartaSans.variable} h-full antialiased`} suppressHydrationWarning>
      <body className="min-h-full flex flex-col font-sans bg-background text-foreground" suppressHydrationWarning>
        <AppShell>{children}</AppShell>
        <ChatWidget />
      </body>
    </html>
  );
}
