import Link from "next/link";
import { Cpu } from "lucide-react";
import { Separator } from "@/components/ui/separator";

export default function Footer() {
  return (
    <footer className="mt-auto border-t bg-muted/30">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-brand">
                <Cpu className="h-4 w-4 text-white" />
              </div>
              <span className="text-lg font-bold text-gradient">TechAI Shop</span>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Nền tảng E-Commerce đồ công nghệ tích hợp AI thông minh. 
              Tìm kiếm, so sánh và mua sắm dễ dàng với trợ lý AI.
            </p>
          </div>

          {/* Quick links */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold">Khám phá</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link href="/search?category=Laptop" className="hover:text-primary transition-colors">Laptop</Link></li>
              <li><Link href="/search?category=Smartphone" className="hover:text-primary transition-colors">Smartphone</Link></li>
              <li><Link href="/search?category=Accessories" className="hover:text-primary transition-colors">Phụ kiện</Link></li>
              <li><Link href="/search" className="hover:text-primary transition-colors">Tất cả sản phẩm</Link></li>
            </ul>
          </div>

          {/* Support */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold">Hỗ trợ</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link href="/chat" className="hover:text-primary transition-colors">AI Chat tư vấn</Link></li>
              <li><span className="cursor-default">Chính sách bảo hành</span></li>
              <li><span className="cursor-default">Đổi trả & Hoàn tiền</span></li>
              <li><span className="cursor-default">Liên hệ</span></li>
            </ul>
          </div>

          {/* Contact */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold">Liên hệ</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>📧 support@techai.shop</li>
              <li>📞 1900-TECH-AI</li>
              <li>📍 TP. Hồ Chí Minh, Việt Nam</li>
            </ul>
          </div>
        </div>

        <Separator className="my-8" />

        <div className="flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-muted-foreground">
          <p>© 2026 TechAI Shop. Dự án IT in EC — Mock-Driven Development.</p>
          <p>Phiên bản 1.0 • Next.js + Tailwind CSS + shadcn/ui</p>
        </div>
      </div>
    </footer>
  );
}
