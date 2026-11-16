/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Allows payment receipt photos (up to 5 MB) to be sent to the server.
    serverActions: { bodySizeLimit: "6mb" },
  },
  images: {
    // Lets product photos uploaded to Supabase Storage load through next/image.
    remotePatterns: [{ protocol: "https", hostname: "**.supabase.co" }],
  },
};

export default nextConfig;
