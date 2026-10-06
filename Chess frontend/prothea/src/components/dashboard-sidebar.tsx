"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ArrowRightStartOnRectangleIcon, Bars3Icon, BoltIcon, UserCircleIcon, XMarkIcon } from "@heroicons/react/24/outline";

import { useAuthStore } from "@/features/auth/auth-store";
import { useLogout } from "@/features/auth/hooks/use-logout";

const navigation = [
  {
    label: "Play",
    href: "/dashboard/matchmaking",
    activePaths: ["/dashboard/matchmaking", "/dashboard/chess"],
    Icon: BoltIcon,
  },
  {
    label: "Profile",
    href: "/dashboard/profile",
    activePaths: ["/dashboard/profile", "/dashboard/analysis"],
    Icon: UserCircleIcon,
  },
];

export function DashboardSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const logoutMutation = useLogout();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = () => {
    logoutMutation.mutate(undefined, {
      onSettled: () => router.replace("/login"),
    });
  };

  return (
    <>
      {!mobileOpen && (
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          aria-label="Open navigation"
          aria-expanded={false}
          className="fixed left-4 top-4 z-[60] flex h-10 w-10 items-center justify-center rounded-lg border border-zinc-700 bg-zinc-900 text-white shadow-lg md:hidden"
        >
          <Bars3Icon className="h-5 w-5" />
        </button>
      )}

      {mobileOpen && (
        <button
          type="button"
          aria-label="Close navigation"
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
        />
      )}

      <aside className={[
        "fixed inset-y-0 left-0 z-50 flex h-screen w-64 flex-col border-r border-zinc-800 bg-zinc-950 transition-transform duration-200 md:translate-x-0",
        mobileOpen ? "translate-x-0" : "-translate-x-full",
      ].join(" ")}>
        <div className="flex h-16 shrink-0 items-center justify-between border-b border-zinc-800 px-6">
          <Link href="/dashboard" onClick={() => setMobileOpen(false)} className="font-heading text-xl font-bold tracking-wide text-white">
            PROTHEA
          </Link>
          <button type="button" onClick={() => setMobileOpen(false)} aria-label="Close navigation" className="rounded-md p-1 text-zinc-500 hover:bg-zinc-900 hover:text-white md:hidden">
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        <nav aria-label="Main navigation" className="flex-1 overflow-y-auto p-4">
          <p className="mb-3 px-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-600">Menu</p>
          <div className="space-y-1">
            {navigation.map(({ label, href, activePaths, Icon }) => {
              const active = activePaths.some((path) => pathname === path || pathname.startsWith(`${path}/`));
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setMobileOpen(false)}
                  aria-current={active ? "page" : undefined}
                  className={[
                    "flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition-colors",
                    active ? "bg-zinc-100 text-zinc-950" : "text-zinc-400 hover:bg-zinc-900 hover:text-white",
                  ].join(" ")}
                >
                  <Icon className="h-5 w-5 shrink-0" />
                  <span>{label}</span>
                </Link>
              );
            })}
          </div>
        </nav>

        <div className="shrink-0 border-t border-zinc-800 p-4">
          <div className="mb-3 flex min-w-0 items-center gap-3 rounded-xl bg-zinc-900 p-3">
            <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-sm font-semibold text-zinc-200">
              {(user?.username ?? "U").slice(0, 1).toUpperCase()}
            </span>
            <p className="truncate text-sm font-semibold text-white">{user?.username ?? "User"}</p>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            disabled={logoutMutation.isPending}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-red-400 transition-colors hover:bg-red-950/30 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <ArrowRightStartOnRectangleIcon className="h-5 w-5" />
            {logoutMutation.isPending ? "Logging out..." : "Log out"}
          </button>
        </div>
      </aside>
    </>
  );
}
