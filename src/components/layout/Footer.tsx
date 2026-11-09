import Link from "next/link";
import { Mail, Phone, MapPin } from "lucide-react";
import { Separator } from "@/components/ui/separator";

const linkClass =
  "text-sm text-muted-foreground transition-colors duration-200 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

export default function Footer() {
  return (
    <footer className="mt-auto border-t border-border bg-background">
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-4">
          {/* Brand */}
          <div className="space-y-4">
            <Link
              href="/"
              className="inline-flex items-center gap-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              <span className="h-3 w-3 bg-brand" aria-hidden="true" />
              <span className="font-heading text-2xl font-extrabold uppercase leading-none tracking-[0.02em]">
                Eamora
              </span>
            </Link>
            <p className="max-w-xs text-sm leading-relaxed text-muted-foreground">
              Cửa hàng công nghệ chính hãng — lựa chọn thiết bị phù hợp với nhu cầu,
              giá minh bạch, tư vấn thật.
            </p>
          </div>

          {/* Explore */}
          <div className="space-y-4">
            <h4 className="font-heading text-sm font-semibold text-foreground">Khám phá</h4>
            <ul className="space-y-2.5">
              <li><Link href="/search?category=Laptop" className={linkClass}>Laptop</Link></li>
              <li><Link href="/search?category=Smartphone" className={linkClass}>Điện thoại</Link></li>
              <li><Link href="/search?category=Accessories" className={linkClass}>Phụ kiện</Link></li>
              <li><Link href="/search" className={linkClass}>Tất cả sản phẩm</Link></li>
            </ul>
          </div>

          {/* Support */}
          <div className="space-y-4">
            <h4 className="font-heading text-sm font-semibold text-foreground">Hỗ trợ</h4>
            <ul className="space-y-2.5">
              <li><Link href="/watchlist" className={linkClass}>Price Agent</Link></li>
              <li><span className="text-sm text-muted-foreground">Chính sách bảo hành</span></li>
              <li><span className="text-sm text-muted-foreground">Đổi trả &amp; hoàn tiền</span></li>
              <li><span className="text-sm text-muted-foreground">Câu hỏi thường gặp</span></li>
            </ul>
          </div>

          {/* Contact */}
          <div className="space-y-4">
            <h4 className="font-heading text-sm font-semibold text-foreground">Liên hệ</h4>
            <ul className="space-y-2.5 text-sm text-muted-foreground">
              <li className="flex items-center gap-2.5">
                <Mail className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                support@amora.vn
              </li>
              <li className="flex items-center gap-2.5">
                <Phone className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                1900-AMORA
              </li>
              <li className="flex items-center gap-2.5">
                <MapPin className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                TP. Hồ Chí Minh, Việt Nam
              </li>
            </ul>
          </div>
        </div>

        <Separator className="my-10" />

        <div className="flex flex-col items-center justify-between gap-2 text-xs text-muted-foreground sm:flex-row">
          <p>© 2026 Eamora. All rights reserved.</p>
          <p>Thiết kế tối giản — mua sắm minh bạch.</p>
        </div>
      </div>
    </footer>
  );
}
