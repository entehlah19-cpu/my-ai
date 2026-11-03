import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import PinGate from "./pin-gate";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || "https://my-ai-8q98.vercel.app";

const JUDUL = "My AI - Asisten AI berbahasa Indonesia";
const DESKRIPSI =
  "My AI adalah asisten AI gratis berbahasa Indonesia: tanya jawab, pencarian web, bantu koding, buat gambar, dan kuis.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: JUDUL,
    template: "%s | My AI",
  },
  description: DESKRIPSI,
  applicationName: "My AI",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    url: SITE_URL,
    siteName: "My AI",
    title: JUDUL,
    description: DESKRIPSI,
    locale: "id_ID",
  },
  robots: {
    index: true,
    follow: true,
  },
  verification: process.env.NEXT_PUBLIC_GOOGLE_VERIFICATION
    ? { google: process.env.NEXT_PUBLIC_GOOGLE_VERIFICATION }
    : undefined,
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="id"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <PinGate>{children}</PinGate>
      </body>
    </html>
  );
}
