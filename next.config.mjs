/** @type {import('next').NextConfig} */
const nextConfig = {
  async redirects() {
    return []
  },
  images: {
    // Both supabase (user-uploaded wardrobe photos) and unsplash (seed script
    // demo wardrobe) are allowed. Anything not listed here will fail at build
    // or runtime — intentional, so leaks are obvious.
    remotePatterns: [
      { protocol: 'https', hostname: '**.supabase.co' },
      { protocol: 'https', hostname: 'images.unsplash.com' },
    ],
  },
};

export default nextConfig;
