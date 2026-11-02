import ProductDetailClient from "@/components/pages/ProductDetailClient";

// Đã xóa generateStaticParams: app dùng DB thật, không cần SSG cho trang sản phẩm.
// IDs thật (uuid từ DB) được render request-time (dynamicParams mặc định true),
// nên /products/<uuid> vẫn hoạt động mà không sinh 8 trang mock prod_001... khi build.
export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ProductDetailClient id={id} />;
}
