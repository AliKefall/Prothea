import { FriendsPanel } from "@/features/friends/components/friends-panel";
import { FriendsPanelButton } from "@/features/friends/components/friends-panel-button";
import { ChatPanel } from "@/features/chat/components/chat-panel";
import { DashboardSidebar } from "@/components/dashboard-sidebar";
import { ProfileHydrator } from "@/features/profile/components/profile-hydrator";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-screen bg-zinc-950">
      <DashboardSidebar />

      <div className="min-h-screen pl-64">
        <div className="mx-auto max-w-7xl p-6">
          {children}
        </div>
      </div>
        <ProfileHydrator />
      <ChatPanel />
      <FriendsPanelButton />
      <FriendsPanel />
    </main>  );
}
