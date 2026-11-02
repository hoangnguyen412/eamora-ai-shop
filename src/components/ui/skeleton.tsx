import * as React from "react"
import { cn } from "cn"

const Skeleton = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => {
  return (
    <div
      ref={ref}
      role="status"
      aria-label="Đang tải"
      className={cn("animate-pulse rounded-md bg-muted", className)}
      {...props}
    />
  )
})
Skeleton.displayName = "Skeleton"

export { Skeleton }
