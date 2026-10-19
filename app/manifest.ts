// app/manifest.ts — PWA manifest · Luminous Minimalism
import type { MetadataRoute } from "next";
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "خيال",
    short_name: "خيال",
    description: "مساحة عربية لصياغة البرومبتات وتحسينها ومشاركتها.",
    start_url: "/",
    scope: "/",
    display: "fullscreen",
    display_override: ["fullscreen", "standalone", "minimal-ui"],
    orientation: "portrait",
    background_color: "#F7F8FB",
    theme_color: "#CC1728",
    lang: "ar",
    dir: "rtl",
    icons: [
      { src: "/icons/khiyal-mark-192-v5.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/khiyal-mark-512-v5.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/khiyal-maskable-512-v5.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
