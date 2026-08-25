import type { NextConfig } from "next";

const nextConfig: NextConfig = {
    // Cache Components, for the `use cache` boundaries in lib/queries.ts.
    // Without them, every pane in the stack re-queries on every navigation and
    // re-suspends, so changing one segment visibly reloads its neighbours.
    cacheComponents: true,

    // node-wordnet reads WordNet's dictionary files from disk at runtime.
    // Bundling it would sever it from those files, so it stays external.
    serverExternalPackages: ["node-wordnet", "wndb-with-exceptions"],
};

export default nextConfig;
