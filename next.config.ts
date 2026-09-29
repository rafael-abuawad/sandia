import type { NextConfig } from "next";
import imageLoader from "./lib/image-loader";

const nextConfig: NextConfig = {
  transpilePackages: ["@privy-io/react-auth", "@privy-io/wagmi"],
  logging: {
    incomingRequests: {
      ignore: [/\/json(\/|$)/],
    },
  },
  async redirects() {
    return [
      {
        source: "/otc",
        destination: "/requests/new",
        permanent: true,
      },
      {
        source: "/lending",
        destination: "/earn",
        permanent: true,
      },
    ];
  },
  images: {
    loader: "custom",
    loaderFile: "./lib/image-loader.ts",
  },
};

// Keep a live import of the loader so tooling sees the module edge.
void imageLoader;

export default nextConfig;

import("@opennextjs/cloudflare").then((m) => m.initOpenNextCloudflareForDev());
