import type { NextConfig } from "next";

// ── Validate required environment variables at build time ────────────────
const requiredEnvVars = [
    "NEXT_PUBLIC_CONVEX_URL",
    "ELEVENLABS_API_KEY",
    "ELEVENLABS_VOICE_ID",
] as const;

for (const key of requiredEnvVars) {
    if (!process.env[key]) {
        console.warn(`⚠ Missing environment variable: ${key}`);
    }
}

const nextConfig: NextConfig = {
    reactStrictMode: false,
    images: {
        remotePatterns: [
            {
                protocol: "https",
                hostname: "cdn.sanity.io",
            },
        ],
    },

    async redirects() {
        return [
            // ── Legacy /product/ → new /products/ (singular → plural) ──────
            {
                source: "/product/:slug",
                destination: "/products/:slug",
                permanent: true,
            },

            // ── Legacy PHP category pages → /catalog with filters ──────────
            {
                source: "/all-bottles/:path*.php",
                destination: "/catalog",
                permanent: true,
            },
            {
                source: "/all-bottles/:path*",
                destination: "/catalog",
                permanent: true,
            },

            // ── Legacy content pages ───────────────────────────────────────
            {
                source: "/product-packaging-ideas.php",
                destination: "/blog",
                permanent: true,
            },
            {
                source: "/about-us.php",
                destination: "/about",
                permanent: true,
            },
            {
                source: "/contact-us.php",
                destination: "/contact",
                permanent: true,
            },
            {
                source: "/contact.php",
                destination: "/contact",
                permanent: true,
            },

            // ── Catch-all for stray .php pages ─────────────────────────────
            {
                source: "/:path*.php",
                destination: "/",
                permanent: true,
            },

            // ── Non-www → www canonicalization (handled at DNS/Vercel level,
            //    but this catches any direct hits) ──────────────────────────
        ];
    },

    async headers() {
        return [
            {
                source: "/(.*)",
                headers: [
                    { key: "X-Content-Type-Options", value: "nosniff" },
                    { key: "X-Frame-Options", value: "SAMEORIGIN" },
                    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
                    { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
                    { key: "Permissions-Policy", value: "camera=(), microphone=(self), geolocation=(), payment=(self), usb=()" },
                ],
            },
        ];
    },
};

export default nextConfig;
