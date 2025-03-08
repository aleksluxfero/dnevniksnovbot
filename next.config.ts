/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ["grammy", "@huggingface/inference"],
  },
};

export default nextConfig;