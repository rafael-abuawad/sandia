import type { NextConfig } from "next";
import imageLoader from "./lib/image-loader";

const nextConfig: NextConfig = {
  images: {
    loader: "custom",
    loaderFile: "./lib/image-loader.ts",
  },
};

// Keep a live import of the loader so tooling sees the module edge.
void imageLoader;

export default nextConfig;
