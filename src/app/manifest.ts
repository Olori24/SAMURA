import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/", name: "SAMURA AI", short_name: "SAMURA", description: "Your private space for thoughtful AI conversations.", start_url: "/", scope: "/", display: "standalone", orientation: "portrait-primary", background_color: "#080b12", theme_color: "#080b12", categories: ["productivity", "utilities"], icons: [
      { src: "/icons/samura-192.svg", sizes: "192x192", type: "image/svg+xml", purpose: "any" },
      { src: "/icons/samura-512.svg", sizes: "512x512", type: "image/svg+xml", purpose: "any" }
    ]
  };
}
