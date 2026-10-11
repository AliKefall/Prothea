"use client";

import { useParams } from "next/navigation";
import { ProfileOverview } from "@/features/profile/components/profile-overview";

export default function PlayerProfilePage() {
  const params = useParams<{ username: string }>();
  return <ProfileOverview username={decodeURIComponent(params.username)} />;
}
