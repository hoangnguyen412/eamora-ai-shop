import { Star } from "lucide-react";

interface ProductRatingProps {
  rating: number;
  reviewCount: number;
  size?: "compact" | "detail";
}

export default function ProductRating({
  rating,
  reviewCount,
  size = "compact",
}: ProductRatingProps) {
  const starSize = size === "detail" ? "h-4 w-4" : "h-3 w-3";

  return (
    <div
      role="img"
      aria-label={`${rating} trên 5 sao, ${reviewCount} đánh giá`}
      className={`flex items-center ${size === "detail" ? "gap-3" : "gap-1.5"}`}
    >
      <span className="flex items-center gap-0.5" aria-hidden="true">
        {Array.from({ length: 5 }, (_, index) => (
          <Star
            key={index}
            className={`${starSize} ${index < Math.floor(rating) ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"}`}
          />
        ))}
      </span>
      {size === "detail" ? (
        <>
          <span className="text-sm font-medium" aria-hidden="true">{rating}</span>
          <span className="text-sm text-muted-foreground" aria-hidden="true">
            ({reviewCount} đánh giá)
          </span>
        </>
      ) : (
        <span className="text-xs text-muted-foreground" aria-hidden="true">
          ({reviewCount})
        </span>
      )}
    </div>
  );
}