import "server-only";
import type { FileKind } from "@prisma/client";
import { db } from "./db";

// Photos live in the StoredFile table (bytea), so uploads behave the same on
// a laptop and on Vercel, with no extra storage service to configure.
// The browser shrinks images before uploading, so files are small.

const TYPES: Record<string, number[]> = {
  "image/jpeg": [0xff, 0xd8, 0xff],
  "image/png": [0x89, 0x50, 0x4e, 0x47],
  "image/webp": [0x52, 0x49, 0x46, 0x46],
};

export const MAX_FILE_BYTES = 2 * 1024 * 1024;

export type SavedFile = { ok: true; id: string; url: string } | { ok: false; error: string };

export const fileUrl = (id: string) => `/files/${id}`;

export async function saveImage(ownerId: string, kind: FileKind, file: File): Promise<SavedFile> {
  const magic = TYPES[file.type];
  if (!magic) return { ok: false, error: "Use a JPG, PNG or WebP image." };
  if (file.size === 0) return { ok: false, error: "That file is empty." };
  if (file.size > MAX_FILE_BYTES) return { ok: false, error: "Images can be up to 2 MB." };
  const bytes = Buffer.from(await file.arrayBuffer());
  // Check the file really is the image type it claims to be.
  if (!magic.every((b, i) => bytes[i] === b)) return { ok: false, error: "That file doesn't look like an image." };
  const row = await db.storedFile.create({
    data: { ownerId, kind, contentType: file.type, size: bytes.length, data: bytes },
    select: { id: true },
  });
  return { ok: true, id: row.id, url: fileUrl(row.id) };
}

// Deletes a stored file by its /files/<id> URL, only if it belongs to ownerId.
export async function deleteFileByUrl(ownerId: string, url: string | null | undefined) {
  const id = url?.match(/^\/files\/([a-z0-9]+)$/)?.[1];
  if (id) await db.storedFile.deleteMany({ where: { id, ownerId } });
}

export async function deleteFile(ownerId: string, id: string | null | undefined) {
  if (id) await db.storedFile.deleteMany({ where: { id, ownerId } });
}
