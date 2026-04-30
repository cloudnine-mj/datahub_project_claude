/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    // Frontend (3000) → Backend (8000) 프록시. CORS 부담 없이 같은 origin 처럼 호출.
    return [
      {
        source: "/api/:path*",
        destination: `${process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000"}/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
