import React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 font-medium transition-all duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        primary: "text-white shadow-sm active:scale-[0.98]",
        secondary: "bg-transparent border text-[var(--foreground)] hover:bg-[var(--muted)]",
        ghost: "bg-transparent text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--muted)]",
      },
      size: {
        default: "h-12 px-6 text-base rounded-xl",
        sm: "h-10 px-4 text-sm rounded-lg",
        lg: "h-14 px-8 text-lg rounded-xl",
        icon: "h-10 w-10 rounded-lg",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, style, ...props }, ref) => {
    const variantStyles: React.CSSProperties = variant === "primary" 
      ? {
          background: "linear-gradient(to right, #0052FF, #4D7CFF)",
          boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
        }
      : variant === "secondary"
      ? {
          borderColor: "var(--border)",
        }
      : {};

    const hoverStyles = variant === "primary" 
      ? {
          boxShadow: "0 4px 14px rgba(0,82,255,0.25)",
          transform: "translateY(-2px)",
          filter: "brightness(1.1)",
        }
      : {};

    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        style={{
          ...variantStyles,
          ...style,
        }}
        onMouseEnter={(e) => {
          if (variant === "primary") {
            Object.assign(e.currentTarget.style, hoverStyles);
          }
          props.onMouseEnter?.(e);
        }}
        onMouseLeave={(e) => {
          if (variant === "primary") {
            e.currentTarget.style.boxShadow = variantStyles.boxShadow as string;
            e.currentTarget.style.transform = "";
            e.currentTarget.style.filter = "";
          }
          props.onMouseLeave?.(e);
        }}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
