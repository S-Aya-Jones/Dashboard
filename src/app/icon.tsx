import { ImageResponse } from "next/og";

export const runtime = "edge";
export const size = { width: 512, height: 512 };
export const contentType = "image/png";

// A solid clay tile with a cream serif A.
//
// The previous icon was black with acid-lime lettering, left over from an
// earlier design — so the one thing representing a warm cream-and-clay app on
// her home screen was the only part of it that wasn't. Clay is the theme colour,
// which also means the icon and the launch screen finally agree.
//
// No ring or inset shape: Android masks this to its own outline, and a circle
// drawn inside a circle reads as a mistake once cropped. The letter sits within
// the middle 60% so nothing important is lost to the mask.
export default function Icon() {
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
            fontSize: 300,
            fontWeight: 500,
            color: "#FAF6F1",
            lineHeight: 1,
            fontFamily: "Georgia, serif",
            // Georgia's cap-height sits high; nudge it onto the optical centre.
            marginTop: -18,
          }}
        >
          A
        </span>
      </div>
    ),
    { ...size },
  );
}
