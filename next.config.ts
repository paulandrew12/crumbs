import path from "node:path";
import type { NextConfig } from "next";

const config: NextConfig = {
  reactStrictMode: true,
  // There is a stray package-lock.json in the home directory, so Next infers
  // the workspace root wrongly and traces the wrong files on deploy. Pin it.
  outputFileTracingRoot: path.join(__dirname),
};

export default config;
