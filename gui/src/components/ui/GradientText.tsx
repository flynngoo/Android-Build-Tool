import React from "react";
import { cn } from "../../lib/utils";

export interface GradientTextProps extends React.HTMLAttributes<HTMLSpanElement> {
  underline?: boolean;
}

const GradientText = React.forwardRef<HTMLSpanElement, GradientTextProps>(
  ({ className, underline = false, children, style, ...props }, ref) => {
    return (
      <span
        ref={ref}
        className={cn("relative inline-block", className)}
        style={style}
        {...props}
      >
        <span
          style={{
            background: "linear-gradient(to right, #0052FF, #4D7CFF)",
            WebkitBackgroundClip: "text",
            backgroundClip: "text",
            color: "transparent",
            WebkitTextFillColor: "transparent",
          }}
        >
          {children}
        </span>
        {underline && (
          <span
            style={{
              position: "absolute",
              bottom: "-0.25rem",
              left: 0,
              height: "12px",
              width: "100%",
              borderRadius: "2px",
              background: "linear-gradient(to right, rgba(0, 82, 255, 0.15), rgba(77, 124, 255, 0.1))",
            }}
          />
        )}
      </span>
    );
  }
);
GradientText.displayName = "GradientText";

export { GradientText };
