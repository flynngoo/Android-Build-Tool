import React from "react";
import { cn } from "../../lib/utils";

export interface SectionLabelProps extends React.HTMLAttributes<HTMLDivElement> {
  dot?: boolean;
  pulsing?: boolean;
}

const SectionLabel = React.forwardRef<HTMLDivElement, SectionLabelProps>(
  ({ className, dot = true, pulsing = false, children, style, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn("inline-flex items-center gap-3", className)}
        style={{
          borderRadius: "var(--radius-full)",
          border: "1px solid rgba(0, 82, 255, 0.3)",
          background: "rgba(0, 82, 255, 0.05)",
          padding: "8px 20px",
          fontFamily: "var(--font-mono)",
          fontSize: "12px",
          textTransform: "uppercase",
          letterSpacing: "0.15em",
          color: "#0052FF",
          ...style,
        }}
        {...props}
      >
        {dot && (
          <span
            style={{
              width: "8px",
              height: "8px",
              borderRadius: "50%",
              background: "#0052FF",
              animation: pulsing ? "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite" : undefined,
            }}
          />
        )}
        <span>{children}</span>
      </div>
    );
  }
);
SectionLabel.displayName = "SectionLabel";

export { SectionLabel };
