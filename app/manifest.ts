import type { MetadataRoute } from "next";

// Data aplikasi supaya My AI bisa dipasang di layar utama (PWA)
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "My AI",
    short_name: "My AI",
    description: "Asisten AI pribadi",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#0a0a0a",
    theme_color: "#0a0a0a",
    lang: "id",
    icons: [
      { src: "/pwa-icon/192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/pwa-icon/512", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/pwa-icon/512", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
