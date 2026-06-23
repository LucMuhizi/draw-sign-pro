import { useMemo } from "react";

const COLORS = [
  "rgba(59,130,246,0.25)",
  "rgba(6,182,212,0.2)",
  "rgba(249,115,22,0.15)",
  "rgba(99,102,241,0.2)",
];

interface Particle {
  key: number;
  width: number;
  height: number;
  left: string;
  top: string;
  color: string;
  delay: string;
  duration: string;
}

/**
 * Lightweight animated background using pure CSS.
 * Replaces the Three.js particle system (~500KB) with CSS animations
 * that work on all devices including low-RAM mobile phones.
 */
export function ParticleBackground() {
  const particles = useMemo<Particle[]>(
    () =>
      Array.from({ length: 20 }).map((_, i) => ({
        key: i,
        width: 4 + Math.random() * 10,
        height: 4 + Math.random() * 10,
        left: `${Math.random() * 100}%`,
        top: `${Math.random() * 100}%`,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        delay: `${Math.random() * 8}s`,
        duration: `${12 + Math.random() * 18}s`,
      })),
    [],
  );

  return (
    <div className="fixed inset-0 pointer-events-none z-0 select-none overflow-hidden">
      {particles.map((p) => (
        <div
          key={p.key}
          className="absolute rounded-full animate-float"
          style={{
            width: p.width,
            height: p.height,
            left: p.left,
            top: p.top,
            backgroundColor: p.color,
            animationDelay: p.delay,
            animationDuration: p.duration,
          }}
        />
      ))}
    </div>
  );
}
