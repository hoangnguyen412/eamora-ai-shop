import { Package } from "lucide-react";

interface InventoryStatusProps {
  stock: number;
}

export default function InventoryStatus({ stock }: InventoryStatusProps) {
  const label = stock > 0 ? `Còn ${stock} sản phẩm trong kho` : "Sản phẩm hiện đã hết hàng";

  return (
    <p
      role="status"
      aria-label={label}
      className={`flex items-center gap-1.5 text-sm ${stock > 0 ? "text-muted-foreground" : "text-destructive"}`}
    >
      <Package className="h-3.5 w-3.5" aria-hidden="true" />
      {label}
    </p>
  );
}