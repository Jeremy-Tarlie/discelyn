import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

/** Favicon Discelyn — D monochrome sur fond signal. */
export default function Icon() {
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
          borderRadius: 8,
        }}
      >
        <div
          style={{
            fontSize: 20,
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
