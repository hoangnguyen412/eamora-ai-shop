import Link from "next/link";

export default function HeroBanner() {
  return (
    <section
      className="relative my-6 overflow-hidden rounded-3xl bg-gradient-to-r from-slate-100 via-indigo-50 to-slate-100 border border-slate-200/80 p-8 md:p-14 shadow-sm"
    >
      {/* Decorative background glow */}
      <div className="absolute -right-20 -top-20 h-72 w-72 rounded-full bg-indigo-200/50 blur-3xl pointer-events-none" aria-hidden="true" />

      <div className="relative z-10 max-w-2xl space-y-5">
        {/* Sub-tag đơn giản, bỏ icon rườm rà */}
        <span className="block text-xs font-semibold uppercase tracking-wider text-indigo-600">
          Sale công nghệ tháng 11
        </span>

        {/* Headline sạch sẽ */}
        <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight text-slate-900 leading-tight">
          Amora — Công Nghệ <br className="hidden sm:inline" /> Chính Hãng
        </h1>

        {/* Description */}
        <p className="text-slate-600 text-sm md:text-base leading-relaxed max-w-lg">
          Laptop, điện thoại và phụ kiện công nghệ với giá tốt nhất tháng 11. Giảm đến 50% cho các sản phẩm nổi bật.
        </p>

        {/* Buttons - Sửa lỗi màu chữ & bỏ icon */}
        <div className="flex flex-wrap items-center gap-3 pt-2">
          {/* Nút chính - Pill Button */}
          <a
            href="#products"
            className="inline-flex min-h-11 items-center rounded-full bg-slate-900 px-8 py-3.5 text-sm font-semibold text-white transition-all hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 active:scale-95"
          >
            Khám phá ngay
          </a>

          {/* Nút phụ - Pill Button */}
          <Link
            href="/watchlist"
            className="inline-flex min-h-11 items-center rounded-full border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-slate-800 transition-all hover:bg-slate-50 hover:border-slate-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-500 active:scale-95 shadow-sm"
          >
            Xem Price Agent
          </Link>
        </div>
      </div>
    </section>
  );
}