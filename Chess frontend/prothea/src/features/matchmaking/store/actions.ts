
import { dequeueMatchmaking, enqueueMatchmaking } from "../api/matchmaking_api";
import { useMatchmakingStore } from "./matchmaking-store";

export async function startMatchmaking(timeControl: string) {
  try {
    useMatchmakingStore.getState().startSearching(timeControl);

    await enqueueMatchmaking(timeControl);
  } catch (error) {
    console.error("Failed to enqueue matchmaking:", error);

    useMatchmakingStore.getState().setError("Failed to find an opponent.");
  }
}

export async function stopMatchmaking() {
  const { timeControl } = useMatchmakingStore.getState();

  if (!timeControl) {
    return;
  }

  try {
    await dequeueMatchmaking(timeControl);

    useMatchmakingStore.getState().stopSearching();
  } catch (error) {
    console.error("Failed to dequeue matchmaking:", error);

    useMatchmakingStore.getState().setError("Failed to cancel matchmaking.");
  }
}
