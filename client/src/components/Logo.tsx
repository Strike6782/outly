import { cn } from "@/lib/utils";

interface LogoProps {
  size?: "sm" | "md" | "lg";
  variant?: "light" | "dark";
  showText?: boolean;
  className?: string;
}

/**
 * Outly logo — a minimal paper plane with a trailing arc.
 * Represents outreach in motion — clean, fast, purposeful.
 */
function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      {/* Paper plane — tilted for dynamism */}
      <path
        d="M4 4L20 12L4 20L7 12L4 4Z"
        fill="white"
        fillOpacity="0.9"
      />
      {/* Inner fold line — gives depth */}
      <path
        d="M7 12L20 12"
        stroke="rgba(0,166,62,0.4)"
        strokeWidth="1"
      />
      {/* Trailing motion arc — the "outreach" feel */}
      <path
        d="M2 17C4 15 5 13 7 12"
        stroke="white"
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity="0.5"
      />
    </svg>
  );
}

export function Logo({ size = "md", variant = "dark", showText = true, className }: LogoProps) {
  const sizes = {
    sm: { box: "h-7 w-7 rounded-[10px]", text: "text-[15px]", svg: "h-4 w-4" },
    md: { box: "h-9 w-9 rounded-[12px]", text: "text-[18px]", svg: "h-[18px] w-[18px]" },
    lg: { box: "h-11 w-11 rounded-[14px]", text: "text-[22px]", svg: "h-[22px] w-[22px]" },
  };

  const s = sizes[size];
  const textColor = variant === "light" ? "text-white" : "text-gray-900";

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className={cn(
        s.box,
        "bg-gradient-to-br from-[#00A63E] via-[#00B847] to-[#10B981]",
        "flex items-center justify-center",
        "shadow-[0_2px_8px_rgba(0,166,62,0.3)]",
        "relative overflow-hidden",
      )}>
        <LogoMark className={s.svg} />
        {/* Glass highlight */}
        <div className="absolute inset-0 bg-gradient-to-b from-white/15 to-transparent h-1/2" />
      </div>
      {showText && (
        <span className={cn(s.text, "font-extrabold tracking-tight leading-none", textColor)}>
          Out<span className="text-primary">ly</span>
        </span>
      )}
    </div>
  );
}
