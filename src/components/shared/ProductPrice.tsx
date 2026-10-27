import { Badge } from "@/components/ui/badge";
import { formatPrice } from "@/lib/helpers";

interface ProductPriceProps {
  price: number;
  originalPrice?: number;
  discountPercent?: number;
  size?: "card" | "detail";
}

export default function ProductPrice({
  price,
  originalPrice,
  discountPercent,
  size = "card",
}: ProductPriceProps) {
  const hasDiscount = originalPrice !== undefined && originalPrice > price;

  return (
    <div className="flex flex-wrap items-baseline gap-2">
      <span className={`${size === "detail" ? "text-3xl" : "text-lg"} font-bold text-primary`}>
        {formatPrice(price)}
      </span>
      {hasDiscount && (
        <span className={`${size === "detail" ? "text-lg" : "text-xs"} text-muted-foreground line-through`}>
          {formatPrice(originalPrice)}
        </span>
      )}
      {size === "detail" && hasDiscount && discountPercent !== undefined && (
        <Badge variant="destructive" className="text-xs">-{discountPercent}%</Badge>
      )}
    </div>
  );
}