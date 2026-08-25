/**
 * Service worker kill-switch.
 *
 * The 2020 site registered a Workbox service worker at this path which
 * precaches the app shell and calls clientsClaim(). Anyone who has visited
 * before still has it installed, and it will go on serving them the old shell
 * from cache after the cutover — indefinitely, with no error anywhere to show
 * for it.
 *
 * Deleting the file is not enough: a 404 leaves the installed worker in place.
 * The path has to keep answering, with a worker that deletes the caches,
 * unregisters itself, and reloads whatever windows it controls.
 *
 * Served with no-store so it is never held anywhere. It can be removed once
 * enough time has passed that no unvisited install remains — there is no hurry,
 * and no cost to leaving it.
 */

const KILL_SWITCH = `// Replaces the 2020 Workbox service worker.
self.addEventListener("install", () => {
    self.skipWaiting();
});

self.addEventListener("activate", (event) => {
    event.waitUntil(
        (async () => {
            // Drop everything the old worker precached.
            const keys = await caches.keys();
            await Promise.all(keys.map((key) => caches.delete(key)));

            await self.registration.unregister();

            // Reload any window this worker still controls, so it picks up the
            // new site rather than sitting on markup from the old cache.
            const clients = await self.clients.matchAll({ type: "window" });
            for (const client of clients) {
                client.navigate(client.url);
            }
        })()
    );
});

// Never serve from cache while this worker is winding down.
self.addEventListener("fetch", () => {});
`;

export function GET(): Response {
    return new Response(KILL_SWITCH, {
        headers: {
            "content-type": "application/javascript; charset=utf-8",
            "cache-control": "no-store, max-age=0, must-revalidate",
        },
    });
}
