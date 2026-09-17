import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Monster Slayer — Green Edition | Game Boy Style Witcher RPG",
  description:
    "A dark fantasy RPG in authentic Game Boy style: take witcher contracts, hunt monsters with steel and silver, cast signs, brew potions, and face the Leshen of Hollow Creek.",
  keywords: [
    "witcher",
    "game boy",
    "retro RPG",
    "pixel art",
    "monster hunter",
    "dark fantasy",
    "pokemon style",
  ],
  authors: [{ name: "kanishka-namdeo" }],
  icons: { icon: "/favicon.svg" },
  openGraph: {
    title: "Monster Slayer — Green Edition",
    description: "A Game Boy style witcher tale. Steel for beasts, silver for monsters.",
    siteName: "Monster Slayer",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#0f380f",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased bg-zinc-950 text-zinc-200">{children}</body>
    </html>
  );
}
