"use client";

import { useState } from "react";
import {
  InformationCircleIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import {
  StarIcon,
} from "@heroicons/react/24/solid";

const symbols: {
  mark?: string;
  icon?: "star";
  style: string;
  title: string;
  description: string;
}[] = [
  {
    icon: "star",
    style: "bg-emerald-400 text-emerald-950",
    title: "Engine best move",
    description: "The engine’s top move from the current position.",
  },
  {
    mark: "?",
    style: "bg-amber-300 text-amber-950",
    title: "Inaccuracy",
    description: "The move gives up a noticeable amount of advantage.",
  },
  {
    mark: "?",
    style: "bg-orange-400 text-orange-950",
    title: "Mistake",
    description: "The move gives up a significant amount of advantage.",
  },
  {
    mark: "?",
    style: "bg-rose-400 text-rose-950",
    title: "Blunder",
    description: "The move loses a large amount of advantage or misses a major chance.",
  },
];

export function AnalysisSymbolInfo() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative" data-component="analysis-symbol-info">
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        aria-label="Explain analysis symbols"
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        className="grid h-9 w-9 place-items-center rounded-lg border border-zinc-700 text-zinc-300 transition hover:border-sky-300/40 hover:bg-zinc-800 hover:text-white"
      >
        <InformationCircleIcon className="h-5 w-5" aria-hidden="true" />
      </button>
      {isOpen && (
        <section
          role="dialog"
          aria-label="Analysis symbol guide"
          className="absolute left-0 top-full z-30 mt-2 w-[min(21rem,calc(100vw-2rem))] rounded-xl border border-zinc-700 bg-zinc-900 p-4 text-left shadow-2xl"
          data-component="analysis-symbol-info-popover"
        >
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white">Board symbols</h2>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              aria-label="Close symbol guide"
              className="rounded-md p-1 text-zinc-400 hover:bg-zinc-800 hover:text-white"
            >
              <XMarkIcon className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
          <ul className="space-y-2.5">
            {symbols.map((symbol) => (
              <li key={symbol.title} className="flex items-start gap-2.5">
                <span
                  className={`grid h-5 w-5 shrink-0 place-items-center rounded-full text-xs font-bold ${symbol.style}`}
                  aria-hidden="true"
                >
                  {symbol.icon === "star" ? (
                    <StarIcon className="h-3 w-3" />
                  ) : (
                    symbol.mark
                  )}
                </span>
                <span>
                  <span className="block text-xs font-medium text-zinc-100">
                    {symbol.title}
                  </span>
                  <span className="block text-xs leading-relaxed text-zinc-400">
                    {symbol.description}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
