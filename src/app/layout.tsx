import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SAMURA AI — Intelligence, built with integrity",
  description: "An independent AI platform focused on useful intelligence, trustworthy engineering, and research.",
  applicationName: "SAMURA AI",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
