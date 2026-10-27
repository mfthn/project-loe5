/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  distDir: process.env.NODE_ENV === "development" ? ".next-dev" : ".next",
  async rewrites() {
    return [
      {
        source: "/api/v1/auth/:path*",
        destination: "http://127.0.0.1:8001/api/v1/auth/:path*",
      },
      {
        source: "/api/v1/sample/:path*",
        destination: "http://127.0.0.1:8002/api/v1/sample/:path*",
      },
      {
        source: "/api/v1/gudang/:path*",
        destination: "http://127.0.0.1:8002/api/v1/gudang/:path*",
      },
      {
        source: "/api/v1/produksi/:path*",
        destination: "http://127.0.0.1:8002/api/v1/produksi/:path*",
      },
      {
        source: "/api/v1/qc/:path*",
        destination: "http://127.0.0.1:8002/api/v1/qc/:path*",
      },
      {
        source: "/api/v1/finance/:path*",
        destination: "http://127.0.0.1:8003/api/v1/finance/:path*",
      },
      {
        source: "/api/v1/payroll/:path*",
        destination: "http://127.0.0.1:8003/api/v1/payroll/:path*",
      },
      {
        source: "/api/v1/ai/:path*",
        destination: "http://127.0.0.1:8004/api/v1/ai/:path*",
      },
    ];
  },
};

export default nextConfig;
