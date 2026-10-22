"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowRightIcon,
  BoltIcon,
  ChartBarIcon,
  ChevronDownIcon,
} from "@heroicons/react/24/outline";

type Section = "users" | "developers" | "information" | null;

const linkClass =
  "font-medium text-sky-300 underline decoration-sky-300/30 underline-offset-4 transition hover:text-sky-200 hover:decoration-sky-200";

export default function DashboardPage() {
  const [openSection, setOpenSection] = useState<Section>(null);

  const toggleSection = (section: Exclude<Section, null>) => {
    setOpenSection((current) => (current === section ? null : section));
  };

  return (
    <div
      className="mx-auto max-w-5xl space-y-6 py-4 sm:space-y-8"
      data-component="dashboard-home"
    >
      <nav
        aria-label="Chess shortcuts"
        className="grid gap-4 sm:grid-cols-2"
      >
        <Link
          href="/dashboard/matchmaking"
          className="group flex items-center gap-4 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5 transition duration-200 hover:border-sky-400/40 hover:bg-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
          data-component="home-matchmaking-link"
        >
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-sky-400/10 text-sky-300">
            <BoltIcon className="h-6 w-6" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-semibold text-white">Matchmaking</span>
            <span className="mt-1 block text-sm leading-5 text-zinc-400">
              Find an opponent and start a game.
            </span>
          </span>
          <ArrowRightIcon className="h-5 w-5 shrink-0 text-zinc-500 transition group-hover:translate-x-1 group-hover:text-sky-300" />
        </Link>

        <Link
          href="/dashboard/analysis"
          className="group flex items-center gap-4 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5 transition duration-200 hover:border-violet-400/40 hover:bg-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
          data-component="home-analysis-link"
        >
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-violet-400/10 text-violet-300">
            <ChartBarIcon className="h-6 w-6" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-semibold text-white">Game analysis</span>
            <span className="mt-1 block text-sm leading-5 text-zinc-400">
              Review your completed games.
            </span>
          </span>
          <ArrowRightIcon className="h-5 w-5 shrink-0 text-zinc-500 transition group-hover:translate-x-1 group-hover:text-violet-300" />
        </Link>
      </nav>

      <section
        className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/50 shadow-sm shadow-black/10"
        data-component="home-for-users"
      >
        <button
          type="button"
          id="home-for-users"
          aria-expanded={openSection === "users"}
          aria-controls="home-for-users-content"
          onClick={() => toggleSection("users")}
          className="flex w-full cursor-pointer items-center justify-between px-5 py-5 text-left text-lg font-semibold text-white transition hover:bg-zinc-800/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-sky-400 sm:px-8 sm:text-xl"
        >
          <span>For users</span>
          <ChevronDownIcon
            aria-hidden="true"
            className={`h-5 w-5 text-zinc-400 transition-transform duration-200 ${
              openSection === "users" ? "rotate-180" : ""
            }`}
          />
        </button>

        {openSection === "users" && (
          <div
            id="home-for-users-content"
            role="region"
            aria-labelledby="home-for-users"
            className="border-t border-zinc-800 p-4 sm:p-8"
          >
            <div className="space-y-5 rounded-xl border border-zinc-800/80 bg-zinc-950/60 p-5 sm:p-6">
              <div className="space-y-2">
                <h2 className="text-lg font-semibold tracking-tight text-white sm:text-xl">
                  Play, learn, and improve
                </h2>
                <p className="max-w-3xl text-sm leading-7 text-zinc-300">
                  For players who would like to learn how the system works,
                  here is an overview of the page. This website is completely
                  free, so feel free to explore everything. You are welcome
                  here.
                </p>
              </div>

              <div className="space-y-3 text-sm leading-7 text-zinc-400">
                <p>
                  You can play against other people from the Play section in
                  the left sidebar, or play against customizable bots grouped
                  by their predicted Elo ratings. You can check your profile
                  to see your rating and game history.
                </p>
                <p>
                  In the Analyze section, you can analyze your own games or
                  explore the openings database. You can inspect the opening
                  played on the current board, continue from a position, search
                  through openings and your own games, or test how different
                  moves might play out.
                </p>
                <p>
                  In the bottom-right corner, you can chat with your friends
                  and check incoming or outgoing friend requests. You can also
                  search for people or friends using the top sidebar.
                </p>
                <p>
                  After you complete a game, you can find another match using
                  the section on the right side of the chessboard, or return to
                  the Play section in the left sidebar to play again.
                </p>
                <p>
                  For new players, I use the Glicko rating system. You need to
                  play around 20 games for your rating to become more reliable.
                  Your rating volatility, which determines how much rating you
                  gain or lose per game, should become better calibrated as you
                  play more games.
                </p>
              </div>

              <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-4">
                <h3 className="text-sm font-semibold text-white">
                  Questions, feedback, and credits
                </h3>
                <p className="mt-2 text-sm leading-6 text-zinc-400">
                  For questions, bug reports, suggestions, or ideas, you can
                  reach out to me on{" "}
                  <a
                    className={linkClass}
                    href="https://github.com/AliKefall"
                    target="_blank"
                    rel="noreferrer"
                  >
                    GitHub
                  </a>{" "}
                  or by email at{" "}
                  <a
                    className={linkClass}
                    href="mailto:osman.ali_shen@outlook.com"
                  >
                    osman.ali_shen@outlook.com
                  </a>
                  .
                </p>
                <p className="mt-3 text-sm leading-6 text-zinc-400">
                  The opening data shown in the analysis tables comes from the{" "}
                  <a
                    className={linkClass}
                    href="https://github.com/lichess-org/chess-openings"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Lichess chess-openings repository
                  </a>
                  . I am grateful for their work. The chess engine uses the
                  latest version of{" "}
                  <a
                    className={linkClass}
                    href="https://stockfishchess.org/"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Stockfish
                  </a>{" "}
                  and will be updated whenever a better version is released.
                </p>
              </div>
            </div>
          </div>
        )}
      </section>

      <section
        className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/50 shadow-sm shadow-black/10"
        data-component="home-for-developers"
      >
        <button
          type="button"
          id="home-for-developers"
          aria-expanded={openSection === "developers"}
          aria-controls="home-for-developers-content"
          onClick={() => toggleSection("developers")}
          className="flex w-full cursor-pointer items-center justify-between px-5 py-5 text-left text-lg font-semibold text-white transition hover:bg-zinc-800/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-violet-400 sm:px-8 sm:text-xl"
        >
          <span>For developers</span>
          <ChevronDownIcon
            aria-hidden="true"
            className={`h-5 w-5 text-zinc-400 transition-transform duration-200 ${
              openSection === "developers" ? "rotate-180" : ""
            }`}
          />
        </button>

        {openSection === "developers" && (
          <div
            id="home-for-developers-content"
            role="region"
            aria-labelledby="home-for-developers"
            className="border-t border-zinc-800 p-4 sm:p-8"
          >
            <div className="space-y-5 rounded-xl border border-zinc-800/80 bg-zinc-950/60 p-5 sm:p-6">
              <div className="space-y-2">
                <h2 className="text-lg font-semibold tracking-tight text-white sm:text-xl">
                  Build with Prothea
                </h2>
                <p className="max-w-3xl text-sm leading-7 text-zinc-300">
                  This section explains the logic and technologies behind
                  everything you see here. The backend is written in Go
                  1.25.x, and many system scripts are written in Lua. You can
                  inspect the rate limiter and matchmaking algorithms in the
                  main{" "}
                  <a
                    className={linkClass}
                    href="https://github.com/AliKefall/Prothea"
                    target="_blank"
                    rel="noreferrer"
                  >
                    GitHub repository
                  </a>
                  . The frontend uses TypeScript and React, and its source code
                  is also available in the repository.
                </p>
              </div>

              <div className="space-y-3 text-sm leading-7 text-zinc-400">
                <p>
                  Passwords are hashed with Argon2id. Login and registration
                  have their own rate limiters based on users' IP addresses.
                  The main rate limiter uses user tokens, which are only
                  available after a successful login. For more information,
                  check the <code className="rounded bg-zinc-800 px-1.5 py-0.5 text-zinc-200">internal/ratelimiter</code>{" "}
                  and <code className="rounded bg-zinc-800 px-1.5 py-0.5 text-zinc-200">internal/auth</code>{" "}
                  directories in the repository.
                </p>
                <p>
                  Redis (v9 at the moment) improves performance in parts of the
                  project where speed is important. The hub system manages game
                  state. Check{" "}
                  <code className="rounded bg-zinc-800 px-1.5 py-0.5 text-zinc-200">
                    internal/game
                  </code>{" "}
                  and{" "}
                  <code className="rounded bg-zinc-800 px-1.5 py-0.5 text-zinc-200">
                    internal/websocket
                  </code>{" "}
                  for more information.
                </p>
                <p>
                  Metrics are collected with Prometheus and Grafana. I also use
                  k6 as a test suite to evaluate how the backend behaves across
                  different scenarios. A page for uptime and general website
                  metrics will be added when needed.
                </p>
                <p>
                  There is much more to cover, so feel free to explore the
                  repository. You can also check the latest changes in the
                  changelog. Bug reports, suggestions, and questions are
                  welcome. You can reach me on{" "}
                  <a
                    className={linkClass}
                    href="https://github.com/AliKefall"
                    target="_blank"
                    rel="noreferrer"
                  >
                    GitHub
                  </a>{" "}
                  or by email at{" "}
                  <a
                    className={linkClass}
                    href="mailto:osman.ali_shen@outlook.com"
                  >
                    osman.ali_shen@outlook.com
                  </a>
                  .
                </p>
              </div>
            </div>
          </div>
        )}
      </section>

      <section
        className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/50 shadow-sm shadow-black/10"
        data-component="home-page-information"
      >
        <button
          type="button"
          id="home-page-information"
          aria-expanded={openSection === "information"}
          aria-controls="home-page-information-content"
          onClick={() => toggleSection("information")}
          className="flex w-full cursor-pointer items-center justify-between px-5 py-5 text-left text-lg font-semibold text-white transition hover:bg-zinc-800/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-400 sm:px-8 sm:text-xl"
        >
          <span>Information about this page</span>
          <ChevronDownIcon
            aria-hidden="true"
            className={`h-5 w-5 text-zinc-400 transition-transform duration-200 ${
              openSection === "information" ? "rotate-180" : ""
            }`}
          />
        </button>

        {openSection === "information" && (
          <div
            id="home-page-information-content"
            role="region"
            aria-labelledby="home-page-information"
            className="border-t border-zinc-800 p-4 sm:p-8"
          >
            <div className="space-y-5 rounded-xl border border-zinc-800/80 bg-zinc-950/60 p-5 sm:p-6">
              <div className="space-y-2">
                <h2 className="text-lg font-semibold tracking-tight text-white sm:text-xl">
                  About this page
                </h2>
                <p className="max-w-3xl text-sm leading-7 text-zinc-300">
                  Prothea is a free website that provides chess games and an
                  analysis system built by its creator. You are free to explore
                  the code and systems. You can find the repository on{" "}
                  <a
                    className={linkClass}
                    href="https://github.com/AliKefall/Prothea"
                    target="_blank"
                    rel="noreferrer"
                  >
                    GitHub
                  </a>
                  .
                </p>
              </div>

              <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-4">
                <h3 className="text-sm font-semibold text-white">Credits</h3>
                <ul className="mt-3 space-y-2 text-sm text-zinc-400">
                  <li>
                    <span className="mr-2 text-zinc-600">•</span>
                    Opening database:{" "}
                    <a
                      className={linkClass}
                      href="https://github.com/lichess-org/chess-openings"
                      target="_blank"
                      rel="noreferrer"
                    >
                      Lichess chess-openings
                    </a>
                  </li>
                  <li>
                    <span className="mr-2 text-zinc-600">•</span>
                    Chess engine:{" "}
                    <a
                      className={linkClass}
                      href="https://stockfishchess.org/"
                      target="_blank"
                      rel="noreferrer"
                    >
                      Stockfish
                    </a>
                  </li>
                </ul>
              </div>

              <p className="text-sm leading-7 text-zinc-400">
                You are most welcome here.
              </p>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
