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

  if (size === "compact") {
    return (
      <div
        role="img"
        aria-label={`${rating} trên 5 sao, ${reviewCount} đánh giá`}
        className="flex items-center gap-1.5 text-xs"
      >
        <Star className="h-3.5 w-3.5 fill-brand text-brand" aria-hidden="true" />
        <span className="font-semibold text-foreground" aria-hidden="true">{rating}</span>
        <span className="text-muted-foreground" aria-hidden="true">({reviewCount})</span>
      </div>
    );
  }

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
            className={`${starSize} ${index < Math.floor(rating) ? "fill-foreground text-foreground" : "text-muted-foreground/40"}`}
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