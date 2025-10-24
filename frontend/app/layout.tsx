import type { Metadata } from "next";
import { Bruno_Ace } from "next/font/google";
import "leaflet/dist/leaflet.css";
import "./globals.css";

const brunoAce = Bruno_Ace({ 
  weight: "400",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Go Hawaii | Real-time Weather, Surf & AI Guide",
  description: "Your complete guide to Hawaii outdoor adventures. Real-time weather, surf conditions, and AI-powered recommendations for beaches, hiking, and more.",
  keywords: "Hawaii, surf, weather, outdoor, beach, Waikiki, North Shore, activities",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={brunoAce.className}>{children}</body>
    </html>
  );
}
