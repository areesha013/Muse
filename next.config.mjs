// Product photos come from your Supabase project. Allow whatever host NEXT_PUBLIC_SUPABASE_URL points to.
const supabaseImage = (() => {
  try {
    const u = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "");
    return [{ protocol: u.protocol.replace(":", ""), hostname: u.hostname, port: u.port }];
  } catch {
    return [];
  }
})();

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Allows payment receipt photos (up to 5 MB) to be sent to the server.
    serverActions: { bodySizeLimit: "6mb" },
  },
  images: {
    // Lets product photos uploaded to Supabase Storage load through next/image.
    remotePatterns: [{ protocol: "https", hostname: "**.supabase.co" }, ...supabaseImage],
  },
};

export default nextConfig;
