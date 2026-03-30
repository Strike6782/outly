"use client";

import { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type ButtonVariant =
  | "primary"
  | "secondary"
  | "google"
  | "danger"
  | "outline"
  | "ghost";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

export default function Button({
  children,
  variant = "primary",
  className,
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      className={cn(
        "inline-flex w-full items-center justify-center rounded-md text-sm",
        "min-h-[44px] transition-colors duration-150",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
        variant === "primary" &&
          "bg-primary px-4 py-2.5 font-medium text-white hover:bg-primary-hover active:bg-primary-active",
        variant === "secondary" &&
          "bg-gray-100 px-4 py-2.5 font-medium text-gray-800 hover:bg-gray-200 active:bg-gray-300",
        variant === "google" &&
          "bg-primary-light px-4 py-2.5 font-medium text-gray-800 hover:bg-[#caf9ca] active:bg-[#b8f0b8]",
        variant === "danger" &&
          "bg-red-500 px-4 py-2.5 font-medium text-white hover:bg-red-600 active:bg-red-700",
        variant === "outline" &&
          "border border-primary bg-white px-3 py-2 text-primary hover:bg-green-50 active:bg-green-100",
        variant === "ghost" &&
          "bg-transparent px-2 py-2 text-gray-500 hover:bg-gray-100 active:bg-gray-200",
        className,
      )}
    >
      {children}
    </button>
  );
}
