"use client";

import { forwardRef, InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
interface InputProps extends InputHTMLAttributes<HTMLInputElement> {}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, ...props }, ref) => {
    return (
      <input
        ref={ref ?? undefined}
        className={cn(
          "w-full rounded-md bg-gray-100 px-3 md:px-4 py-2 md:py-3 text-xs md:text-sm text-gray-900",
          "min-h-[40px] md:min-h-[44px] transition-colors duration-150",
          "placeholder:text-gray-500",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
          className,
        )}
        {...props}
      />
    );
  },
);

Input.displayName = "Input";
export default Input;
