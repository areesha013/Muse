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
  async headers() {
    const security = [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "X-Frame-Options", value: "SAMEORIGIN" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
      { key: "Strict-Transport-Security", value: "max-age=31536000" },
      // Blocks other sites from framing ours, plugins, and forms posting elsewhere.
      { key: "Content-Security-Policy", value: "frame-ancestors 'self'; base-uri 'self'; form-action 'self'; object-src 'none'" },
    ];
    return [{ source: "/:path*", headers: security }];
  },
  images: {
    // Lets product photos uploaded to Supabase Storage load through next/image.
    remotePatterns: [{ protocol: "https", hostname: "**.supabase.co" }, ...supabaseImage],
  },
};

export default nextConfig;
