"use client";

interface RatingCardProps {
  title: string;
  rating?: number;
  gamesPlayed?: number;
}

export function RatingCard({ title, rating, gamesPlayed }: RatingCardProps) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
      <p className="text-sm text-zinc-400">{title} </p>
      <p className="mt-1 text-2xl font-bold text-white">{rating ?? "-"}</p>

      <p className="mt-1 text-xs text-zinc-500">{gamesPlayed ?? 0} games</p>
    </div>
  );
}
