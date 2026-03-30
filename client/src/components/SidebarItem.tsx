interface SidebarItemProps {
  label: string;
  count?: number;
  isActive?: boolean;
  icon?: React.ReactNode;
  onClick: React.MouseEventHandler;
}

export function SidebarItem({
  label,
  count,
  isActive,
  icon,
  onClick,
}: SidebarItemProps) {
  return (
    <div
      className={`group relative flex items-center justify-between rounded-lg px-3 py-2 text-[13px] cursor-pointer min-h-[40px] transition-all duration-200
        ${isActive
          ? "bg-gray-100/80 text-gray-900 font-semibold"
          : "text-gray-500 hover:bg-gray-50 hover:text-gray-900"}
      `}
      onClick={onClick}
    >
      {/* Active Indicator Line */}
      {isActive && (
        <div className="absolute left-0 top-1.5 bottom-1.5 w-1 bg-primary rounded-r-md" />
      )}

      <div className="flex items-center gap-2.5">
        <span className={`transition-transform duration-200 ${isActive ? "text-primary" : "group-hover:text-gray-700 opacity-70 group-hover:opacity-100"}`}>
          {icon}
        </span>
        <span className="tracking-tight">{label}</span>
      </div>

      {count !== undefined && (
        <span className={`text-[10px] font-bold rounded-md px-1.5 py-0.5 tracking-tight transition-all ${
          isActive ? "bg-white text-gray-600 shadow-[0_1px_2px_rgba(0,0,0,0.05)]" : "bg-gray-100 text-gray-400 group-hover:bg-gray-200"
        }`}>
          {count}
        </span>
      )}
    </div>
  );
}
