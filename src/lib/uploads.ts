import "server-only";
import path from "node:path";
import { mkdir, writeFile, unlink } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import { del, put } from "@vercel/blob";

// Profile photo storage. On Vercel (BLOB_READ_WRITE_TOKEN set) photos go to
// Vercel Blob, because serverless servers don't keep files on disk. Locally
// they're written to ./uploads and served by /uploads/[name].
export const UPLOAD_DIR = path.join(process.cwd(), "uploads");

const TYPES: Record<string, { ext: string; magic: number[] }> = {
  "image/jpeg": { ext: "jpg", magic: [0xff, 0xd8, 0xff] },
  "image/png": { ext: "png", magic: [0x89, 0x50, 0x4e, 0x47] },
  "image/webp": { ext: "webp", magic: [0x52, 0x49, 0x46, 0x46] },
};

const blobEnabled = () => !!process.env.BLOB_READ_WRITE_TOKEN;

export const MAX_UPLOAD_BYTES = 2 * 1024 * 1024;

export async function saveImage(file: File): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const type = TYPES[file.type];
  if (!type) return { ok: false, error: "Use a JPG, PNG or WebP image." };
  if (file.size > MAX_UPLOAD_BYTES) return { ok: false, error: "Images can be up to 2 MB." };
  const bytes = Buffer.from(await file.arrayBuffer());
  // Check the file really is the image type it claims to be.
  if (!type.magic.every((b, i) => bytes[i] === b)) return { ok: false, error: "That file doesn't look like an image." };
  const name = `${randomBytes(16).toString("hex")}.${type.ext}`;
  if (blobEnabled()) {
    const blob = await put(`avatars/${name}`, bytes, { access: "public", contentType: file.type });
    return { ok: true, url: blob.url };
  }
  await mkdir(UPLOAD_DIR, { recursive: true });
  await writeFile(path.join(UPLOAD_DIR, name), bytes);
  return { ok: true, url: `/uploads/${name}` };
}

export async function deleteImage(url: string | null | undefined) {
  if (url && blobEnabled() && /^https:\/\/[a-z0-9-]+\.public\.blob\.vercel-storage\.com\//.test(url)) {
    await del(url).catch(() => {});
    return;
  }
  if (!url?.startsWith("/uploads/")) return;
  const name = path.basename(url);
  await unlink(path.join(UPLOAD_DIR, name)).catch(() => {});
}
