import { execSync } from "child_process";

/** @type {import('next').NextConfig} */

// Embed the current git commit SHA at build time so the service worker
// can use a unique cache name per deploy — prevents stale cache issues.
let commitSha = "dev";
try {
  commitSha = execSync("git rev-parse --short HEAD", { stdio: ["pipe", "pipe", "ignore"] })
    .toString()
    .trim();
} catch {
  // Not a git repo or git not available — use "dev"
}

const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
      },
    ],
  },
  env: {
    NEXT_PUBLIC_COMMIT_SHA: commitSha,
  },
  // Netlify's @netlify/plugin-nextjs handles output mode
};

export default nextConfig;
