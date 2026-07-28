import { NextResponse } from "next/server";
import { listRobinhoodStockTokens } from "@/lib/rhj/client";

export const revalidate = 300;

export async function GET() {
  try {
    const assets = await listRobinhoodStockTokens();
    return NextResponse.json(
      { assets },
      {
        headers: {
          "Cache-Control": "public, s-maxage=300, stale-while-revalidate=60",
        },
      },
    );
  } catch (err) {
    console.error("[rhj/assets]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load assets" },
      { status: 502 },
    );
  }
}
