import type { VercelConfig } from "@vercel/config/v1";

/**
 * Project configuration, replacing the 2020 vercel.json.
 *
 * That file was the pre-2020 now.sh format: a `builds` array naming the
 * retired @now/node and @now/static-build builders, a low-level `routes` table
 * doing the SPA fallback by hand, and an `env` block referencing Vercel
 * Secrets — a product that no longer exists. Next is detected with no
 * configuration at all now, so almost none of it needs replacing.
 *
 * What is kept is the region. The codex and its author are in Australia and
 * the database is in Sydney, so keeping functions there avoids a round trip
 * across the Pacific on every read.
 */
export const config: VercelConfig = {
    framework: "nextjs",
    regions: ["syd1"],
};
