import { NextResponse } from "next/server";
import { fetchListedChainStats } from "@/lib/stocks/gecko";

export const revalidate = 30;

export async function GET() {
  try {
    const stats = await fetchListedChainStats();
    return NextResponse.json(
      { stats },
      {
        headers: {
          "Cache-Control": "public, s-maxage=30, stale-while-revalidate=30",
        },
      },
    );
  } catch (err) {
    console.error("[stocks] chain stats failed", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load chain token stats" },
      { status: 502 },
    );
  }
}
