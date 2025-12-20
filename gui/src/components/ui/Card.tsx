import React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/utils";

const cardVariants = cva(
  "bg-[var(--card)] border border-[var(--border)] transition-all duration-200 ease-out",
  {
    variants: {
      variant: {
        default: "shadow-md",
        elevated: "shadow-lg",
        featured: "",
      },
      padding: {
        sm: "p-6",
        md: "p-8",
        lg: "p-10",
      },
    },
    defaultVariants: {
      variant: "default",
      padding: "md",
    },
  }
);

export interface CardProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof cardVariants> {
  featured?: boolean;
}

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant, padding, featured, children, style, ...props }, ref) => {
    const baseStyle: React.CSSProperties = {
      borderRadius: "var(--radius-xl)",
    };

    if (featured) {
      return (
        <div
          style={{
            borderRadius: "var(--radius-xl)",
            background: "linear-gradient(to bottom right, #0052FF, #4D7CFF, #0052FF)",
            padding: "2px",
            ...style,
          }}
          ref={ref}
        >
          <div
            className={cn(cardVariants({ variant: "default", padding, className }))}
            style={{
              borderRadius: "calc(var(--radius-xl) - 2px)",
              ...baseStyle,
            }}
          >
            {children}
          </div>
        </div>
      );
    }

    const shadowStyle = variant === "default" 
      ? { boxShadow: "var(--shadow-md)" }
      : variant === "elevated"
      ? { boxShadow: "var(--shadow-lg)" }
      : {};

    return (
      <div
        className={cn(cardVariants({ variant, padding, className }))}
        style={{
          ...baseStyle,
          ...shadowStyle,
          ...style,
        }}
        onMouseEnter={(e) => {
          if (variant === "default") {
            e.currentTarget.style.boxShadow = "var(--shadow-xl)";
            e.currentTarget.style.transform = "translateY(-2px)";
          } else if (variant === "elevated") {
            e.currentTarget.style.boxShadow = "0 8px 24px rgba(0,82,255,0.35)";
          }
        }}
        onMouseLeave={(e) => {
          if (variant === "default") {
            e.currentTarget.style.boxShadow = shadowStyle.boxShadow as string;
            e.currentTarget.style.transform = "";
          } else if (variant === "elevated") {
            e.currentTarget.style.boxShadow = "var(--shadow-lg)";
          }
        }}
        ref={ref}
        {...props}
      >
        {children}
      </div>
    );
  }
);
Card.displayName = "Card";

export { Card, cardVariants };
