import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/** Apple touch icon Discelyn. */
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#3dcfb0",
          borderRadius: 36,
        }}
      >
        <div
          style={{
            fontSize: 108,
            fontWeight: 800,
            color: "#0f1720",
            letterSpacing: "-0.04em",
            fontFamily: "system-ui, sans-serif",
            lineHeight: 1,
          }}
        >
          D
        </div>
      </div>
    ),
    { ...size }
  );
}
