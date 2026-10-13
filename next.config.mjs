/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Paket AWS SDK hanya dipakai di server, jadi tidak perlu di-bundle ke browser.
  serverExternalPackages: ["@aws-sdk/client-bedrock-runtime"],
};

export default nextConfig;
