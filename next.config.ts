import type { NextConfig } from "next";
import imageLoader from "./lib/image-loader";

const nextConfig: NextConfig = {
  transpilePackages: ["@privy-io/react-auth"],
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
        source: "/stocks/:path*",
        destination: "/",
        permanent: true,
      },
      {
        source: "/earn",
        destination: "/",
        permanent: true,
      },
      {
        source: "/lending",
        destination: "/",
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
