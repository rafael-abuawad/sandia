import { ImageResponse } from "next/og";

export const alt = "Sandia. Request dollars. Receive USDG on Robinhood Chain.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        background: "#eef2ee",
        color: "#0e1512",
        padding: "72px",
      }}
    >
      <div style={{ display: "flex", fontSize: 28, letterSpacing: "0.18em" }}>SANDIA</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 20, maxWidth: 920 }}>
        <div style={{ fontSize: 68, lineHeight: 1.05, letterSpacing: "-0.03em" }}>
          Request dollars. Receive USDG on Robinhood Chain.
        </div>
        <div style={{ fontSize: 28, color: "#5a6a60" }}>
          Payment links, sends, stocks, and USDG earn.
        </div>
      </div>
    </div>,
    { ...size },
  );
}
