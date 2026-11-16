/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    // Lets product photos uploaded to Supabase Storage load through next/image.
    remotePatterns: [{ protocol: "https", hostname: "**.supabase.co" }],
  },
};

export default nextConfig;
