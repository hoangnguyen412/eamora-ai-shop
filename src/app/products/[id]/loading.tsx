export default function ProductDetailLoading() {
  return (
    <div className="mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-6 lg:px-8" role="status" aria-label="Đang tải sản phẩm">
      <div className="h-4 w-56 animate-pulse rounded bg-muted" />
      <div className="grid gap-8 lg:grid-cols-2">
        <div className="aspect-square animate-pulse rounded-2xl bg-muted" />
        <div className="space-y-5">
          <div className="h-6 w-32 animate-pulse rounded bg-muted" />
          <div className="h-10 w-4/5 animate-pulse rounded bg-muted" />
          <div className="h-6 w-2/5 animate-pulse rounded bg-muted" />
          <div className="h-12 animate-pulse rounded bg-muted" />
          <div className="h-12 animate-pulse rounded bg-muted" />
        </div>
      </div>
    </div>
  );
}
