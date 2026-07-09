import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Face Analysis — Aya's Dashboard",
  description: "Real, landmark-based facial geometry analysis: symmetry, proportions, and feature measurements.",
};

export default function FaceAnalysisLayout({ children }: { children: React.ReactNode }) {
  return children;
}
