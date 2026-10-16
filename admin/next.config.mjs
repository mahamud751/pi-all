import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));

/** @type {import("next").NextConfig} */
const nextConfig = {
  turbopack: { root },
  allowedDevOrigins: ["127.0.0.1"],
  devIndicators: { position: "bottom-right" },
};

export default nextConfig;
