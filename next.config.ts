import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Prompts are read with fs at runtime (lib/ai/prompts.ts); make sure they ship with the function.
  outputFileTracingIncludes: {
    "/api/generate": ["./prompts/**/*.md"],
  },
};

export default nextConfig;
