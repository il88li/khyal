// app/opengraph-image.tsx — صورة المشاركة الاجتماعية (OG/Twitter) بتصميم الهوية
import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Khiyal — Arabic prompt studio";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OG() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%", height: "100%", display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center", gap: 24,
          background: "#F7F8FB", color: "#12141C",
        }}
      >
        <div style={{ width: 132, height: 132, borderRadius: 9999, background: "#CC1728", display: "flex", alignItems: "center", justifyContent: "center", color: "#FFFFFF", fontSize: 72, fontWeight: 800 }}>K</div>
        <div style={{ fontSize: 76, fontWeight: 800, letterSpacing: -1 }}>Khiyal</div>
        <div style={{ fontSize: 30, color: "#686F84" }}>From an idea to a clearer prompt</div>
      </div>
    ),
    { ...size },
  );
}
