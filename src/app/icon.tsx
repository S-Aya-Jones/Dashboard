import { ImageResponse } from "next/og";

export const runtime = "edge";
export const size = { width: 512, height: 512 };
export const contentType = "image/png";

export default function Icon() {
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
            width: 360,
            height: 360,
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
              fontSize: 220,
              fontWeight: 800,
              color: "#C8FF00",
              lineHeight: 1,
              letterSpacing: "-10px",
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
