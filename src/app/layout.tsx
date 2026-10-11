import type { Metadata, Viewport } from "next";
import "./globals.css";
import PwaInstall from "@/components/pwa-install";

export const metadata: Metadata = {
  title: "SAMURA AI — Intelligence, built with integrity",
  description: "An independent AI platform focused on useful intelligence, trustworthy engineering, and research.",
  applicationName: "SAMURA AI",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "SAMURA" },
  icons: { icon: [{ url: "/icons/samura-192.svg", type: "image/svg+xml" }], apple: [{ url: "/icons/samura-192.svg" }] },
};
export const viewport: Viewport = { themeColor: "#080b12", width: "device-width", initialScale: 1, viewportFit: "cover" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}<div className="fixed bottom-4 right-4 z-50 rounded-2xl border border-white/10 bg-[#080b12]/95 p-2 shadow-2xl backdrop-blur"><PwaInstall /></div></body></html>;
}
