"use client";

interface GameResultProps {
  result: "white" | "black" | "draw" | "abandoned";
  reason: string;

  isWhite: boolean;

  whiteRatingBefore: number;
  whiteRatingAfter: number;

  blackRatingBefore: number;
  blackRatingAfter: number;
}

function getResultLabel(
  result: GameResultProps["result"],
  isWhite: boolean,
): string {
  if (result === "draw") {
    return "Draw";
  }

  if (result === "abandoned") {
    return "Abandoned";
  }

  const playerWon =
    (isWhite && result === "white") || (!isWhite && result === "black");

  return playerWon ? "You won" : "You lost";
}

function formatReason(reason: string): string {
    switch(reason) {
        case "timeout":
            return "Time expired"
        case "resignation":
            return "Resignation"
        case "agreement":
            return "Draw by agreement"

        default:
            return reason
    }
}


export function GameResult({
  result,
  reason,
  isWhite,
  whiteRatingBefore,
  whiteRatingAfter,
  blackRatingBefore,
  blackRatingAfter,
}: GameResultProps) {
  const myRatingBefore = isWhite
    ? whiteRatingBefore
    : blackRatingBefore;

  const myRatingAfter = isWhite
    ? whiteRatingAfter
    : blackRatingAfter;

  const opponentRatingBefore = isWhite
    ? blackRatingBefore
    : whiteRatingBefore;

  const opponentRatingAfter = isWhite
    ? blackRatingAfter
    : whiteRatingAfter;

  const myRatingChange =
    myRatingAfter - myRatingBefore;

  const opponentRatingChange =
    opponentRatingAfter - opponentRatingBefore;

  const title = getResultLabel(result, isWhite);

  return (
    <div className="border-t border-zinc-800 px-5 py-5">
      <div className="mb-5 text-center">
        <h3 className="text-lg font-semibold">
          {title}
        </h3>

        <p className="mt-1 text-xs text-zinc-500">
          {formatReason(reason)}
        </p>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-zinc-500">
            Your rating
          </span>

          <div className="text-right">
            <span className="font-semibold">
              {myRatingAfter}
            </span>

            {myRatingChange !== 0 && (
              <span
                className={
                  myRatingChange > 0
                    ? "ml-2 text-green-400"
                    : "ml-2 text-red-400"
                }
              >
                {myRatingChange > 0 ? "+" : ""}
                {myRatingChange}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-sm text-zinc-500">
            Opponent rating
          </span>

          <div className="text-right">
            <span className="font-semibold">
              {opponentRatingAfter}
            </span>

            {opponentRatingChange !== 0 && (
              <span
                className={
                  opponentRatingChange > 0
                    ? "ml-2 text-green-400"
                    : "ml-2 text-red-400"
                }
              >
                {opponentRatingChange > 0 ? "+" : ""}
                {opponentRatingChange}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
