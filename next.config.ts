import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // AJOUTEZ CETTE LIGNE EXACTEMENT COMME CECI :
  allowedDevOrigins: ['192.168.1.129'],
};

export default nextConfig;