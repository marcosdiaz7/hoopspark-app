import * as React from "react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "blue" | "outline";
type Size = "sm" | "md" | "lg";

function classes(variant: Variant, size: Size, className?: string) {
  const base = "btn";
  const v =
    variant === "primary"
      ? "btn-primary"
      : variant === "blue"
      ? "btn-primary-blue"
      : "btn-outline";
  const s =
    size === "sm" ? "px-3 py-1.5 text-xs" : size === "lg" ? "px-5 py-3" : "";
  return cn(base, v, s, className);
}

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
};

export function Button({
  variant = "outline",
  size = "md",
  className,
  ...props
}: ButtonProps) {
  return <button className={classes(variant, size, className)} {...props} />;
}

/** Utility to style links like buttons */
export function button(opts?: Partial<{ variant: Variant; size: Size; className: string }>) {
  return classes(opts?.variant ?? "outline", opts?.size ?? "md", opts?.className);
}
