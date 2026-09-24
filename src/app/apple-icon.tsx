import { ImageResponse } from "next/og";

export const runtime = "edge";
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

// Matches icon.tsx. iOS rounds the corners itself and never masks further, so
// the letter can sit slightly larger here than in the maskable version.
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          background: "#B4552F",
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <span
          style={{
            fontSize: 112,
            fontWeight: 500,
            color: "#FAF6F1",
            lineHeight: 1,
            fontFamily: "Georgia, serif",
            marginTop: -7,
          }}
        >
          A
        </span>
      </div>
    ),
    { ...size },
  );
}
