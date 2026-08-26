"use client";

import { useState } from "react";
import { upload } from "@vercel/blob/client";

/**
 * Uploads media for embedding in piece content.
 *
 * The file goes from the browser straight to Blob storage; this component only
 * asks the server for a token. Uploaded files are listed as thumbnails with
 * their URL, which is what the author pastes into the content above.
 *
 * Existing images stay on S3 — the URLs already baked into published pieces go
 * on resolving from there. Only new uploads land in Blob.
 */
/**
 * Exactly what /api/upload will issue a token for. `image/*,video/*` let the
 * picker accept an iPhone photo or clip (image/heic, video/quicktime) that the
 * route then refused, surfacing the storage library's own error message.
 */
const ACCEPTED = [
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
    "image/svg+xml",
    "video/mp4",
    "video/webm",
];

export function FileUpload() {
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [files, setFiles] = useState<{ url: string; name: string }[]>([]);

    async function onChange(event: React.ChangeEvent<HTMLInputElement>) {
        const file = event.target.files?.[0];
        if (!file) return;

        setError(null);
        if (!ACCEPTED.includes(file.type)) {
            setError(`${file.type || "That file type"} cannot be uploaded.`);
            event.target.value = "";
            return;
        }
        setUploading(true);
        try {
            const blob = await upload(file.name, file, {
                access: "public",
                handleUploadUrl: "/api/upload",
            });
            setFiles((current) => [...current, { url: blob.url, name: file.name }]);
        } catch (e) {
            setError(e instanceof Error ? e.message : "Upload failed.");
        } finally {
            setUploading(false);
            event.target.value = "";
        }
    }

    return (
        <div className="form-flex file-upload">
            <label>Upload</label>
            <div className="form-field">
                <input type="file" onChange={onChange} disabled={uploading} accept={ACCEPTED.join(",")} />

                {uploading && (
                    <div className="progress-bar">
                        <div className="progress-bar-bar" />
                    </div>
                )}

                {error && <div className="form-error">{error}</div>}

                {files.length > 0 && (
                    <ul className="upload-files">
                        {files.map((file) => (
                            <li className="upload-file" key={file.url}>
                                <a href={file.url} target="_blank" rel="noopener noreferrer">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img className="upload-image" alt={file.name} src={file.url} />
                                </a>
                                <button
                                    type="button"
                                    className="upload-copy"
                                    onClick={() => navigator.clipboard?.writeText(file.url)}
                                    title="Copy URL"
                                >
                                    Copy URL
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    );
}
