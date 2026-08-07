import type { Metadata, Viewport } from "next";
import { JetBrains_Mono } from "next/font/google";
import { interDisplay } from "@/lib/fonts";
import "./globals.css";

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Pilot Thread Mills",
  description:
    "Digital operations platform for Pilot Thread Mills — production, inventory, and team management.",
  applicationName: "Pilot Thread Mills",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Pilot Thread Mills",
  },
  formatDetection: {
    telephone: false,
  },
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  themeColor: "#1a1a1a",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${interDisplay.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body
        className={`${interDisplay.className} min-h-full bg-background text-foreground`}
      >
        {children}
      </body>
    </html>
  );
}
