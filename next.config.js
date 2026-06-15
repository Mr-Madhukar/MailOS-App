/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // We want to make sure Next.js handles ESM modules from @corsair-dev correctly
  transpilePackages: ['corsair', '@corsair-dev/gmail', '@corsair-dev/googlecalendar'],
};

export default nextConfig;
