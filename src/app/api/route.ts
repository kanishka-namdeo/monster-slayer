import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    ok: true,
    game: "monster-slayer",
    edition: "green",
    screen: "160x144",
    palette: ["#0f380f", "#306230", "#8bac0f", "#9bbc0f"],
  });
}
