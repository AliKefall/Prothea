"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import { useAuthStore } from "@/features/auth/auth-store";
import { useLogout } from "@/features/auth/hooks/use-logout";

const navigation = [
  {
    label: "Play",
    href: "/dashboard/chess",
  },
  {
    label: "Matchmaking",
    href: "/dashboard/matchmaking",
  },
  {
    label: "Profile",
    href: "/dashboard/profile",
  },
];

export function DashboardSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const user = useAuthStore((state) => state.user);

  const logoutMutation = useLogout();

  const handleLogout = () => {
    logoutMutation.mutate(undefined, {
      onSettled: () => {
        router.replace("/login");
      },
    });
  };

  return (
    <aside className="fixed inset-y-0 left-0 z-50 flex h-screen w-64 flex-col border-r border-zinc-800 bg-zinc-950">
      {/* Header */}
      <div className="flex h-16 shrink-0 items-center border-b border-zinc-800 px-6">
        <Link
          href="/dashboard"
          className="font-heading text-xl font-bold tracking-wide text-white"
        >
          PROTHEA
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-4">
        <div className="space-y-1">
          {navigation.map((item) => {
            const active =
              pathname === item.href ||
              pathname.startsWith(`${item.href}/`);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={[
                  "block rounded-lg px-4 py-3 text-sm font-medium transition-colors",
                  active
                    ? "bg-white text-black"
                    : "text-zinc-400 hover:bg-zinc-900 hover:text-white",
                ].join(" ")}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>

      {/* User */}
      <div className="shrink-0 border-t border-zinc-800 p-4">
        <div className="mb-3 rounded-lg bg-zinc-900 p-3">
          <p className="truncate text-sm font-semibold text-white">
            {user?.username ?? "User"}
          </p>

          <div className="mt-1 flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-green-500" />
            <span className="text-xs text-zinc-500">Online</span>
          </div>
        </div>

        <Link
          href="/dashboard/profile"
          className="block rounded-lg px-4 py-2 text-sm text-zinc-400 transition-colors hover:bg-zinc-900 hover:text-white"
        >
          Settings
        </Link>

        <button
          type="button"
          onClick={handleLogout}
          disabled={logoutMutation.isPending}
          className="mt-1 w-full rounded-lg px-4 py-2 text-left text-sm text-red-400 transition-colors hover:bg-red-950/30 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {logoutMutation.isPending ? "Logging out..." : "Logout"}
        </button>
      </div>
    </aside>
  );
}

