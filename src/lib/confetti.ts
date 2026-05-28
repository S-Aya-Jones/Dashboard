import type confettiModule from "canvas-confetti";

let confetti: typeof confettiModule | null = null;

export async function celebrate() {
  if (typeof window === "undefined") return;
  if (!confetti) {
    const mod = await import("canvas-confetti");
    confetti = mod.default;
  }
  confetti({
    particleCount: 60,
    spread: 60,
    origin: { y: 0.6 },
    colors: ["#DA667B", "#71816D", "#C9B79C", "#F1E0C5", "#342A21"],
    scalar: 0.8,
    gravity: 0.8,
  });
}
