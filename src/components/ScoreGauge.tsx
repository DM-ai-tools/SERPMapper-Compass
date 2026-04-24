"use client";

import { useEffect, useState } from "react";

interface ScoreGaugeProps {
  score: number; // 0–100
  /** Dark navy background (Compass full report) */
  variant?: "default" | "navy";
}

export default function ScoreGauge({ score, variant = "default" }: ScoreGaugeProps) {
  const [displayed, setDisplayed] = useState(0);

  // Animate counter up on mount
  useEffect(() => {
    let frame: number;
    const start = performance.now();
    const duration = 1200;

    function tick(now: number) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
      setDisplayed(Math.round(eased * score));
      if (progress < 1) frame = requestAnimationFrame(tick);
    }

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [score]);

  const color =
    variant === "navy"
      ? "#2dc5d1"
      : score >= 60
        ? "#22C55E"
        : score >= 30
          ? "#FCD34D"
          : "#EF4444";
  const track = variant === "navy" ? "rgba(255,255,255,0.10)" : "#F3F4F6";
  const numClass = variant === "navy" ? "text-white" : "text-gray-900";
  const denomClass = variant === "navy" ? "text-slate-400" : "text-gray-400";

  const circumference = 2 * Math.PI * 40;
  const strokeDash = (score / 100) * circumference;

  return (
    <div className="relative flex h-32 w-32 items-center justify-center sm:h-36 sm:w-36">
      <svg
        className="h-32 w-32 -rotate-90 sm:h-36 sm:w-36"
        viewBox="0 0 100 100"
        aria-hidden
      >
        <circle cx="50" cy="50" r="40" fill="none" stroke={track} strokeWidth="7" />
        <circle
          cx="50"
          cy="50"
          r="40"
          fill="none"
          stroke={color}
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={`${strokeDash} ${circumference}`}
          style={{ transition: "stroke-dasharray 1.2s cubic-bezier(0.16,1,0.3,1)" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`text-4xl font-black tabular-nums ${numClass}`}>{displayed}</span>
        <span className={`text-xs font-semibold ${denomClass}`}>/ 100</span>
      </div>
    </div>
  );
}
