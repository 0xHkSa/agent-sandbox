import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Hawaii Outdoor Hub | Real-time Weather, Surf & AI Guide",
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
      <body className={inter.className}>{children}</body>
    </html>
  );
}
