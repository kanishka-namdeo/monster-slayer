import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Monster Slayer — Green Edition | Game Boy Style Witcher RPG",
  description: "A dark fantasy RPG in authentic Game Boy style: take witcher contracts, hunt monsters with steel and silver, cast signs, brew potions, and face the Leshen of Hollow Creek.",
  keywords: ["witcher", "game boy", "retro RPG", "pixel art", "monster hunter", "dark fantasy"],
  authors: [{ name: "SerpentSoft" }],
  icons: {
    icon: "https://z-cdn.chatglm.cn/z-ai/static/logo.svg",
  },
  openGraph: {
    title: "Monster Slayer — Green Edition",
    description: "A Game Boy style witcher tale. Steel for beasts, silver for monsters.",
    siteName: "Z.ai",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
