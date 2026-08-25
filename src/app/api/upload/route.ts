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

export async function POST(request: Request): Promise<Response> {
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

    const body = (await request.json()) as HandleUploadBody;

    try {
        const result = await handleUpload({
            request,
            body,
            onBeforeGenerateToken: async (pathname) => {
                if (!(await isLoggedIn())) {
                    throw new Error("Not authorised.");
                }
                return {
                    // Media only. The codex embeds images and video in piece
                    // content; nothing else needs uploading.
                    allowedContentTypes: [
                        "image/jpeg",
                        "image/png",
                        "image/gif",
                        "image/webp",
                        "image/svg+xml",
                        "video/mp4",
                        "video/webm",
                    ],
                    // Keeps a re-upload of the same filename from silently
                    // replacing what a published piece already points at.
                    addRandomSuffix: true,
                    tokenPayload: pathname,
                };
            },
        });

        return Response.json(result);
    } catch (error) {
        return Response.json(
            { error: error instanceof Error ? error.message : "Upload failed." },
            { status: 400 }
        );
    }
}
