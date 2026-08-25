import type { NextConfig } from "next";

const nextConfig: NextConfig = {
    // Cache Components, for the `use cache` boundaries in lib/queries.ts.
    // Without them, every pane in the stack re-queries on every navigation and
    // re-suspends, so changing one segment visibly reloads its neighbours.
    cacheComponents: true,
};

export default nextConfig;
