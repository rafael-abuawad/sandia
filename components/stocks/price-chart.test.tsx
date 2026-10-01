// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PriceChart } from "./price-chart";

const theme = vi.hoisted(() => ({ resolvedTheme: undefined as string | undefined }));
vi.mock("next-themes", () => ({ useTheme: () => theme }));
afterEach(cleanup);

describe("stock price chart theme", () => {
  it("keeps the embed dark before hydration and across app theme changes", () => {
    theme.resolvedTheme = undefined;
    const { rerender } = render(<PriceChart address="0x123" symbol="AAPL" />);

    for (const resolvedTheme of [undefined, "light", "dark", "system"]) {
      theme.resolvedTheme = resolvedTheme;
      rerender(<PriceChart address="0x123" symbol="AAPL" />);
      const chart = screen.getByTitle("AAPL price chart");
      const url = new URL(chart.getAttribute("src")!);
      expect(url.searchParams.get("light_chart")).toBe("0");
      expect(url.searchParams.get("embed")).toBe("1");
      expect(chart.getAttribute("sandbox")).toContain("allow-same-origin");
    }
  });
});
