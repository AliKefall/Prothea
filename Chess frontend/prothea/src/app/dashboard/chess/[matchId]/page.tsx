import { ChessBoard } from "@/features/chess/components/chessboard";

interface ChessPageProps {
  params: Promise<{
    matchId: string;
  }>;
}

export default async function ChessPage({ params }: ChessPageProps) {
  const { matchId } = await params;

  return <ChessBoard matchId={matchId} />;
}
