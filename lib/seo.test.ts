import { afterEach, describe, expect, it, vi } from "vitest";
import { publicSitemapPaths, siteOrigin } from "@/lib/seo";

describe("siteOrigin", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("uses NEXT_PUBLIC_APP_URL when it is an http origin", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://sandia.example");
    expect(siteOrigin().origin).toBe("https://sandia.example");
  });

  it("ignores a malformed app url", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "not a url");
    vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "");
    expect(siteOrigin().origin).toBe("http://localhost:3000");
  });
});

describe("publicSitemapPaths", () => {
  it("lists product pages and leaves account pages out", () => {
    const paths = publicSitemapPaths();
    expect(paths).toContain("/");
    expect(paths).toContain("/about");
    expect(paths).toContain("/requests/new");
    expect(paths).toContain("/send");
    expect(paths).toContain("/earn");
    expect(paths).toContain("/stocks");
    expect(paths).toContain("/stocks/ETH");
    expect(paths).toContain("/stocks/HOOD");
    expect(paths).not.toContain("/dashboard");
    expect(paths).not.toContain("/activity");
    expect(paths).not.toContain("/address-book");
    expect(paths).not.toContain("/agent");
  });
});
