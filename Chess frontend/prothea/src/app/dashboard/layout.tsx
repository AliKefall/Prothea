import { FriendsPanel } from "@/features/friends/components/friends-panel";
import { FriendsPanelButton } from "@/features/friends/components/friends-panel-button";
import { ChatPanel } from "@/features/chat/components/chat-panel";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-screen bg-zinc-950">
      {children}

      <ChatPanel />

      <FriendsPanelButton />
      <FriendsPanel />
    </main>
  );
}
