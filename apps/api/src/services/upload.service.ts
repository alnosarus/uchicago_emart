import { getStorage } from "firebase-admin/storage";
import { randomUUID } from "crypto";
import { HttpError } from "../utils/errors";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic"];
const MAX_SIZE = 10 * 1024 * 1024; // 10MB
const BUCKET_NAME = process.env.FIREBASE_STORAGE_BUCKET || "";

export async function uploadImage(
  fileBuffer: Buffer,
  mimeType: string,
  originalName: string
): Promise<string> {
  if (!ALLOWED_TYPES.includes(mimeType)) {
    throw new HttpError(400, `Invalid file type: ${mimeType}. Allowed: ${ALLOWED_TYPES.join(", ")}`);
  }
  if (fileBuffer.length > MAX_SIZE) {
    throw new HttpError(400, "File too large. Maximum size is 10MB");
  }

  const ext = mimeType.split("/")[1] === "jpeg" ? "jpg" : mimeType.split("/")[1];
  const fileName = `posts/${randomUUID()}.${ext}`;

  const bucket = getStorage().bucket(BUCKET_NAME);
  const file = bucket.file(fileName);

  await file.save(fileBuffer, {
    metadata: {
      contentType: mimeType,
      metadata: { originalName },
    },
  });

  await file.makePublic();

  return `https://storage.googleapis.com/${BUCKET_NAME}/${fileName}`;
}

export async function deleteImage(imageUrl: string) {
  try {
    const path = imageUrl.split(`${BUCKET_NAME}/`)[1];
    if (!path) return;
    const bucket = getStorage().bucket(BUCKET_NAME);
    await bucket.file(path).delete();
  } catch {
    // Image may already be deleted — don't fail
  }
}
