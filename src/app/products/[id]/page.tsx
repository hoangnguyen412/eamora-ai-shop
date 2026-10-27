import ProductDetailClient from "@/components/pages/ProductDetailClient";
import mockData from "@/mocks/db.json";

export function generateStaticParams() {
  return mockData.products.map((p) => ({ id: p.id }));
}

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ProductDetailClient id={id} />;
}
