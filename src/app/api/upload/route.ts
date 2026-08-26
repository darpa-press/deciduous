import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";

import { isLoggedIn } from "@/lib/auth/session";

/**
 * Issues short-lived tokens for client uploads to Vercel Blob.
 *
 * The file goes straight from the browser to Blob storage rather than through
 * this function, so nothing here has to carry the bytes and request body
 * limits never come into it.
 *
 * The admin check happens inside onBeforeGenerateToken, which is the only
 * place it can: Blob calls this route a second time to report a completed
 * upload, and that callback arrives from Vercel, not from a logged-in browser.
 *
 * Replaces the legacy /api/file, which streamed uploads through the server to
 * S3 with multer and aws-sdk v2, using ACLs that S3 now disables by default.
 */

/** Media only. The codex embeds images and video in piece content. */
const ALLOWED_CONTENT_TYPES = [
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
    "image/svg+xml",
    "video/mp4",
    "video/webm",
];

/**
 * The token the browser gets back is a bearer credential for Blob storage,
 * usable without a cookie by anyone who obtains it. Left unbounded it lasted
 * an hour and carried Blob's own 5 TB ceiling; both are cut to what an editing
 * session actually needs.
 */
const MAX_UPLOAD_BYTES = 64 * 1024 * 1024;
const TOKEN_LIFETIME_MS = 60 * 1000;

export async function POST(request: Request): Promise<Response> {
    // Before anything else: an anonymous caller learned from the 501 below
    // whether Blob was configured, and was told the command to configure it.
    if (!(await isLoggedIn())) {
        return Response.json({ error: "Not authorised." }, { status: 401 });
    }

    if (!process.env.BLOB_READ_WRITE_TOKEN) {
        return Response.json(
            {
                error:
                    "Uploads are not configured. Set BLOB_READ_WRITE_TOKEN — " +
                    "run `vercel blob store add` and pull the env var.",
            },
            { status: 501 }
        );
    }

    try {
        // Inside the try: a body that is not JSON rejects here, and outside it
        // that was an uncaught 500 with a framework error page rather than the
        // 400 this handler means to return.
        const body = (await request.json()) as HandleUploadBody;

        const result = await handleUpload({
            request,
            body,
            onBeforeGenerateToken: async (pathname) => {
                // Checked again here: the completion callback re-enters this
                // route from Vercel rather than from the browser, so the two
                // paths cannot share one check.
                if (!(await isLoggedIn())) {
                    throw new Error("Not authorised.");
                }
                return {
                    allowedContentTypes: ALLOWED_CONTENT_TYPES,
                    maximumSizeInBytes: MAX_UPLOAD_BYTES,
                    validUntil: Date.now() + TOKEN_LIFETIME_MS,
                    // Keeps a re-upload of the same filename from silently
                    // replacing what a published piece already points at.
                    addRandomSuffix: true,
                    tokenPayload: pathname,
                };
            },
        });

        return Response.json(result);
    } catch (error) {
        // The library's own messages describe its internals; they are of no
        // use to a caller and need not be published.
        console.error("upload token request failed", error);
        return Response.json({ error: "Upload failed." }, { status: 400 });
    }
}
