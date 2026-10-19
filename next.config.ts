import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Prompts are read with fs at runtime (lib/ai/prompts.ts); make sure they ship with the function.
  outputFileTracingIncludes: {
    "/api/generate": ["./prompts/**/*.md"],
    "/api/consistency": ["./prompts/**/*.md"],
    "/api/asset": ["./prompts/**/*.md"],
    // OG cards render with Geist from the npm package.
    "/opengraph-image": ["./node_modules/geist/dist/fonts/geist-sans/Geist-{Regular,Bold}.ttf"],
    "/demo/opengraph-image": ["./node_modules/geist/dist/fonts/geist-sans/Geist-{Regular,Bold}.ttf"],
    "/share/[id]/opengraph-image": ["./node_modules/geist/dist/fonts/geist-sans/Geist-{Regular,Bold}.ttf"],
  },
};

export default nextConfig;
