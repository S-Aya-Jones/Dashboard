import { ImageResponse } from "next/og";

export const runtime = "edge";
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          background: "#141414",
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            width: 126,
            height: 126,
            borderRadius: "50%",
            background: "rgba(200,255,0,0.07)",
            border: "2px solid rgba(200,255,0,0.18)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <span
            style={{
              fontSize: 78,
              fontWeight: 800,
              color: "#C8FF00",
              lineHeight: 1,
              letterSpacing: "-4px",
              fontFamily: "serif",
            }}
          >
            A
          </span>
        </div>
      </div>
    ),
    { ...size },
  );
}
