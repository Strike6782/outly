"use client";

import { useRef, useCallback, useState } from "react";
import Button from "@/components/Button";
import { SidebarItem } from "@/components/SidebarItem";
import { UserCard } from "@/components/UserCard";
import { SidebarProps } from "@/types";
import { useSidebar } from "@/hooks/useSidebar";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { X, PenSquare, Megaphone, LogOut, FileText, Mail } from "lucide-react";
import { Logo } from "@/components/Logo";
import { logout } from "@/lib/apis";
import { cn } from "@/lib/utils";

export function Sidebar({ currentLabel, setLabel, onItemClick, profile, items }: SidebarProps) {
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const { isOpen, close } = useSidebar();
  const router = useRouter();
  const pathname = usePathname();
  const touchStartX = useRef(0);

  const handleNavClick = useCallback(
    (item: (typeof items)[number]) => {
      if (pathname !== "/dashboard") {
        const queryParams = new URLSearchParams();
        if (item.label === "Scheduled") queryParams.set("status", "PENDING");
        if (item.label === "Sent") queryParams.set("status", "SENT");
        if (item.label === "Starred") queryParams.set("starred", "true");
        
        const qs = queryParams.toString();
        router.push(qs ? `/dashboard?${qs}` : "/dashboard");
        close();
        return;
      }

      setLabel(item.label);
      onItemClick?.(item.label);
      close();
    },
    [pathname, router, setLabel, onItemClick, close],
  );

  const handleCompose = useCallback(() => {
    router.push("/dashboard/compose");
    close();
  }, [router, close]);

  // Logout handler: best-effort API call, then always clear token and redirect
  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await logout();
    } catch {
      // Best-effort — proceed with client-side cleanup even if API fails
    }
    localStorage.removeItem("accessToken");
    router.push("/login");
  };

  const handleTouchStart = (e: React.TouchEvent) => { touchStartX.current = e.touches[0].clientX; };
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (e.changedTouches[0].clientX - touchStartX.current < -50) close();
  };

  const sidebarContent = (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Logo Group */}
      <div className="mb-6 pt-1 shrink-0">
        <Link href="/dashboard" onClick={close} className="inline-block hover:opacity-80 transition-opacity">
          <Logo size="md" />
        </Link>
      </div>

      {/* Account Info */}
      <div className="mb-6 shrink-0">
        <UserCard {...profile} />
      </div>

      {/* Compose */}
      <div className="mb-6 shrink-0">
        <Button
          variant="primary"
          className="w-full rounded-lg gap-2.5 py-3 text-sm font-semibold shadow-md shadow-primary/10 active:scale-[0.99] transition-all bg-primary border-none"
          onClick={handleCompose}
        >
          <PenSquare className="h-4 w-4" />
          New Campaign
        </Button>
      </div>

      {/* Primary Context Navigation */}
      <nav className="space-y-0.5 shrink-0">
        <div className="px-3 mb-1.5">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-none">Inbox</p>
        </div>
        {items.map((item, idx) => (
          <SidebarItem
            key={idx}
            {...item}
            isActive={currentLabel === item.label}
            onClick={() => handleNavClick(item)}
          />
        ))}
      </nav>

      {/* System Actions & Footer */}
      <div className="mt-auto pt-4 border-t border-gray-100 space-y-0.5 shrink-0">
        <div className="px-3 mb-1.5">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-none">Management</p>
        </div>
        
        <Link
          href="/dashboard/campaigns"
          onClick={close}
          className={cn(
            "group flex items-center gap-3 px-3 py-1.5 rounded-lg text-[13px] font-medium transition-all min-h-[36px]",
            pathname === "/dashboard/campaigns"
              ? "bg-gray-100 text-gray-900 shadow-sm"
              : "text-gray-500 hover:bg-gray-50 hover:text-gray-900"
          )}
        >
          <Megaphone className={cn("h-4 w-4 transition-colors", pathname === "/dashboard/campaigns" ? "text-primary" : "text-gray-400 opacity-60 group-hover:opacity-100 group-hover:text-gray-600")} />
          <span>Campaigns</span>
        </Link>

        <Link
          href="/dashboard/senders"
          onClick={close}
          className={cn(
            "group flex items-center gap-3 px-3 py-1.5 rounded-lg text-[13px] font-medium transition-all min-h-[36px]",
            pathname === "/dashboard/senders"
              ? "bg-gray-100 text-gray-900 shadow-sm"
              : "text-gray-500 hover:bg-gray-50 hover:text-gray-900"
          )}
        >
          <Mail className={cn("h-4 w-4 transition-colors", pathname === "/dashboard/senders" ? "text-primary" : "text-gray-400 opacity-60 group-hover:opacity-100 group-hover:text-gray-600")} />
          <span>Senders</span>
        </Link>

        <Link
          href="/dashboard/templates"
          onClick={close}
          className={cn(
            "group flex items-center gap-3 px-3 py-1.5 rounded-lg text-[13px] font-medium transition-all min-h-[36px]",
            pathname === "/dashboard/templates"
              ? "bg-gray-100 text-gray-900 shadow-sm"
              : "text-gray-500 hover:bg-gray-50 hover:text-gray-900"
          )}
        >
          <FileText className={cn("h-4 w-4 transition-colors", pathname === "/dashboard/templates" ? "text-primary" : "text-gray-400 opacity-60 group-hover:opacity-100 group-hover:text-gray-600")} />
          <span>Templates</span>
        </Link>

        <div className="pt-2">
          <button
            onClick={handleLogout}
            disabled={isLoggingOut}
            className="group flex items-center justify-between px-3 py-1.5 text-gray-400 hover:bg-red-50/50 hover:text-red-500 rounded-lg cursor-pointer transition-all min-h-[36px] w-full disabled:opacity-50 active:scale-[0.99]"
          >
            <div className="flex items-center gap-3">
              <LogOut className="h-4 w-4 opacity-50 transition-opacity group-hover:opacity-100" />
              <span className="text-[13px] font-medium">{isLoggingOut ? "Logging out..." : "Logout"}</span>
            </div>
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop View */}
      <aside className="hidden lg:flex h-full w-[260px] flex-col bg-white p-6 border-r border-gray-100">
        {sidebarContent}
      </aside>

      {/* Mobile overlay */}
      {isOpen && (
        <>
          <div
            className="lg:hidden fixed inset-0 z-40 bg-black/25 backdrop-blur-[3px] transition-opacity duration-300"
            onClick={close}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
            aria-hidden="true"
          />
          <aside
            className="lg:hidden fixed inset-y-0 left-0 z-50 w-[280px] max-w-[85vw] bg-white p-5 shadow-2xl transition-transform duration-300 animate-[fadeInUp_0.3s_ease-out] flex flex-col"
            role="dialog"
            aria-label="Navigation sidebar"
          >
            <button
              onClick={close}
              className="absolute right-3 top-3 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-all"
              aria-label="Close sidebar"
            >
              <X className="h-5 w-5" />
            </button>
            {sidebarContent}
          </aside>
        </>
      )}
    </>
  );
}
