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
    colors: ["#c47a5e", "#d68d84", "#7a816c", "#cfbb9f", "#785b4e"],
    scalar: 0.8,
    gravity: 0.8,
  });
}
