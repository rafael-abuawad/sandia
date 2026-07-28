import { NextResponse } from "next/server";
import { fetchRhjQuote, listRobinhoodStockQuotes, toStockQuote } from "@/lib/rhj/client";

export const revalidate = 15;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get("symbol")?.trim().toUpperCase();

    if (symbol) {
      const raw = await fetchRhjQuote(symbol);
      if (!raw) {
        return NextResponse.json({ error: "Quote not found" }, { status: 404 });
      }
      return NextResponse.json(
        { quote: toStockQuote(raw) },
        {
          headers: {
            "Cache-Control": "public, s-maxage=15, stale-while-revalidate=15",
          },
        },
      );
    }

    const quotes = await listRobinhoodStockQuotes();
    return NextResponse.json(
      { quotes },
      {
        headers: {
          "Cache-Control": "public, s-maxage=15, stale-while-revalidate=15",
        },
      },
    );
  } catch (err) {
    console.error("[rhj/prices]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load prices" },
      { status: 502 },
    );
  }
}
