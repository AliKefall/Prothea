import { FriendsPanel } from "@/features/friends/components/friends-panel";
import { FriendsPanelButton } from "@/features/friends/components/friends-panel-button";

export default function DashboardPage() {
  return (
    <main className="min-h-screen bg-zinc-950">
      {/* Dashboard içeriğin */}

      <FriendsPanelButton />
      <FriendsPanel />
    </main>
  );
}
