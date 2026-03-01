import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdfkit reads font data files at runtime via __dirname — must not be bundled
  serverExternalPackages: ["pdfkit"],
};

export default nextConfig;
