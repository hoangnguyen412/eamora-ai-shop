import { Truck, ShieldCheck, RotateCcw, Headphones } from "lucide-react";

const features = [
  {
    icon: Truck,
    title: "Miễn phí vận chuyển",
    desc: "Đơn hàng trên 500.000đ",
  },
  {
    icon: ShieldCheck,
    title: "Bảo hành 24 tháng",
    desc: "Chính hãng nguồn gốc",
  },
  {
    icon: RotateCcw,
    title: "Đổi trả 7 ngày",
    desc: "Không cần lý do",
  },
  {
    icon: Headphones,
    title: "Hỗ trợ 24/7",
    desc: "Tư vấn mua sắm",
  },
];

export default function FeatureBadges() {
  return (
    <section className="border-y border-zinc-200 bg-zinc-50">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="flex flex-col items-center gap-2 p-3 rounded-xl bg-white border border-zinc-100 shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <feature.icon className="h-5 w-5" aria-hidden="true" />
              </div>
              <h3 className="text-sm font-semibold text-zinc-900 leading-tight">{feature.title}</h3>
              <p className="text-xs text-zinc-500 leading-tight text-center">{feature.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
