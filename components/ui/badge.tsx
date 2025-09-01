import * as React from "react";
import { cn } from "@/lib/cn";

type Variant = "muted" | "brand" | "blue";

export function Badge({
  variant = "muted",
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { variant?: Variant }) {
  const v =
    variant === "brand" ? "badge-brand" : variant === "blue" ? "badge-blue" : "badge-muted";
  return <span className={cn("badge", v, className)} {...props} />;
}
