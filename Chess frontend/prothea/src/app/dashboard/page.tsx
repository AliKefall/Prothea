"use client";

import { http } from "@/lib/http";
import axios from "axios";

export default function DashboardPage() {
  async function testMatchmaking() {
    try {
      const response = await http.post("/matchmaking/enqueue", {
        time_control: "10+0",
      });

      console.log("Matchmaking response:", response.data);
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.error("Matchmaking error:", error.response?.data);
        console.error("Status:", error.response?.status);
      } else {
        console.error("Unexpected error:", error);
      }
    }
  }

  return (
    <main className="min-h-screen bg-zinc-950 p-6">
      <button
        type="button"
        onClick={testMatchmaking}
        className="rounded-md bg-white px-4 py-2 text-black"
      >
        Test Matchmaking
      </button>
    </main>
  );
}
