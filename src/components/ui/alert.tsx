"use client"

import * as React from "react"
import { cn } from "cn"

interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "destructive"
}

function Alert({ className, variant = "default", ...props }: AlertProps) {
  return (
    <div
      role="alert"
      className={cn(
        "relative rounded-lg border p-4 [&>svg]:absolute [&>svg]:left-3.5 [&>svg]:top-3.5 [&>svg]:text-foreground [&>svg+div]:pl-7",
        variant === "destructive"
          ? "border-destructive/30 bg-destructive/5 text-destructive"
          : "border-border bg-background text-foreground",
        className
      )}
      {...props}
    />
  )
}

function AlertTitle({
  className,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      {...props}
      className={cn("mb-1 font-semibold leading-none tracking-tight", className)}
    />
  )
}

function AlertDescription({
  className,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      {...props}
      className={cn("text-sm [&_p]:leading-relaxed", className)}
    />
  )
}

export { Alert, AlertTitle, AlertDescription }
