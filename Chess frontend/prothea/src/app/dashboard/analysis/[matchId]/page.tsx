import { AnalysisReview } from "@/features/analysis/components/analysis-review";

interface AnalysisPageProps {
  params: Promise<{ matchId: string }>;
}

export default async function AnalysisPage({ params }: AnalysisPageProps) {
  const { matchId } = await params;
  return <AnalysisReview matchId={matchId} />;
}
