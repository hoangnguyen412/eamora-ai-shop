import Link from "next/link";
import { Cpu, Mail, Phone, MapPin } from "lucide-react";
import { Separator } from "@/components/ui/separator";

const linkClass =
  "text-sm text-gray-600 transition-colors duration-200 hover:text-blue-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 rounded";

export default function Footer() {
  return (
    <footer className="mt-auto border-t border-gray-200 bg-white">
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-4">
          {/* Brand */}
          <div className="space-y-4">
            <Link
              href="/"
              className="inline-flex items-center gap-2 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-gray-900">
                <Cpu className="h-5 w-5 text-white" aria-hidden="true" />
              </span>
              <span className="font-heading text-xl font-bold tracking-tight text-gray-900">
                Amora
              </span>
            </Link>
            <p className="max-w-xs text-sm leading-relaxed text-gray-500">
              Cửa hàng công nghệ chính hãng — lựa chọn thiết bị phù hợp với nhu cầu,
              giá minh bạch, tư vấn thật.
            </p>
          </div>

          {/* Explore */}
          <div className="space-y-4">
            <h4 className="font-heading text-sm font-semibold text-gray-900">Khám phá</h4>
            <ul className="space-y-2.5">
              <li><Link href="/search?category=Laptop" className={linkClass}>Laptop</Link></li>
              <li><Link href="/search?category=Smartphone" className={linkClass}>Điện thoại</Link></li>
              <li><Link href="/search?category=Accessories" className={linkClass}>Phụ kiện</Link></li>
              <li><Link href="/search" className={linkClass}>Tất cả sản phẩm</Link></li>
            </ul>
          </div>

          {/* Support */}
          <div className="space-y-4">
            <h4 className="font-heading text-sm font-semibold text-gray-900">Hỗ trợ</h4>
            <ul className="space-y-2.5">
              <li><Link href="/watchlist" className={linkClass}>Price Agent</Link></li>
              <li><span className="text-sm text-gray-600">Chính sách bảo hành</span></li>
              <li><span className="text-sm text-gray-600">Đổi trả &amp; hoàn tiền</span></li>
              <li><span className="text-sm text-gray-600">Câu hỏi thường gặp</span></li>
            </ul>
          </div>

          {/* Contact */}
          <div className="space-y-4">
            <h4 className="font-heading text-sm font-semibold text-gray-900">Liên hệ</h4>
            <ul className="space-y-2.5 text-sm text-gray-600">
              <li className="flex items-center gap-2.5">
                <Mail className="h-4 w-4 shrink-0 text-gray-400" aria-hidden="true" />
                support@amora.vn
              </li>
              <li className="flex items-center gap-2.5">
                <Phone className="h-4 w-4 shrink-0 text-gray-400" aria-hidden="true" />
                1900-AMORA
              </li>
              <li className="flex items-center gap-2.5">
                <MapPin className="h-4 w-4 shrink-0 text-gray-400" aria-hidden="true" />
                TP. Hồ Chí Minh, Việt Nam
              </li>
            </ul>
          </div>
        </div>

        <Separator className="my-10" />

        <div className="flex flex-col items-center justify-between gap-2 text-xs text-gray-500 sm:flex-row">
          <p>© 2026 Amora Inc. All rights reserved.</p>
          <p>Thiết kế tối giản — mua sắm minh bạch.</p>
        </div>
      </div>
    </footer>
  );
}
