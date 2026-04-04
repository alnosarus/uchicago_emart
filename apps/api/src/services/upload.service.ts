import sharp from "sharp";
import { encode } from "blurhash";
import { getStorage } from "firebase-admin/storage";
import { randomUUID } from "crypto";
import { HttpError } from "../utils/errors";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic"];
const MAX_SIZE = 10 * 1024 * 1024; // 10MB
const BUCKET_NAME = process.env.FIREBASE_STORAGE_BUCKET || "";

export interface UploadResult {
  url: string;
  fullUrl: string;
  thumbUrl: string;
  blurHash: string;
}

export async function uploadImage(
  fileBuffer: Buffer,
  mimeType: string,
  originalName: string,
  postId: string
): Promise<UploadResult> {
  if (!ALLOWED_TYPES.includes(mimeType)) {
    throw new HttpError(400, `Invalid file type: ${mimeType}. Allowed: ${ALLOWED_TYPES.join(", ")}`);
  }
  if (fileBuffer.length > MAX_SIZE) {
    throw new HttpError(400, "File too large. Maximum size is 10MB");
  }

  const bucket = getStorage().bucket(BUCKET_NAME);
  const uuid = randomUUID();

  // Strip EXIF, auto-rotate
  const rotatedBuffer = await sharp(fileBuffer).rotate().toBuffer();

  // Detect animated images (GIF) — skip processing
  const metadata = await sharp(rotatedBuffer).metadata();
  const isAnimated = metadata.pages && metadata.pages > 1;

  // Original
  const ext = mimeType.split("/")[1] === "jpeg" ? "jpg" : mimeType.split("/")[1];
  const originalPath = `posts/${postId}/original/${uuid}.${ext}`;
  const originalFile = bucket.file(originalPath);
  await originalFile.save(rotatedBuffer, {
    metadata: { contentType: mimeType, metadata: { originalName } },
  });
  await originalFile.makePublic();
  const url = `https://storage.googleapis.com/${BUCKET_NAME}/${originalPath}`;

  if (isAnimated) {
    return { url, fullUrl: url, thumbUrl: url, blurHash: "" };
  }

  // Full-size WebP (max 1200px wide, 80% quality)
  const fullBuffer = await sharp(rotatedBuffer)
    .resize({ width: 1200, withoutEnlargement: true })
    .webp({ quality: 80 })
    .toBuffer();
  const fullPath = `posts/${postId}/full/${uuid}.webp`;
  const fullFile = bucket.file(fullPath);
  await fullFile.save(fullBuffer, { metadata: { contentType: "image/webp" } });
  await fullFile.makePublic();
  const fullUrl = `https://storage.googleapis.com/${BUCKET_NAME}/${fullPath}`;

  // Thumbnail (400px wide, 70% quality)
  const thumbBuffer = await sharp(rotatedBuffer)
    .resize({ width: 400, withoutEnlargement: true })
    .webp({ quality: 70 })
    .toBuffer();
  const thumbPath = `posts/${postId}/thumb/${uuid}.webp`;
  const thumbFile = bucket.file(thumbPath);
  await thumbFile.save(thumbBuffer, { metadata: { contentType: "image/webp" } });
  await thumbFile.makePublic();
  const thumbUrl = `https://storage.googleapis.com/${BUCKET_NAME}/${thumbPath}`;

  // Blur hash
  const blurInput = await sharp(thumbBuffer)
    .raw()
    .ensureAlpha()
    .resize({ width: 32, height: 32, fit: "inside" })
    .toBuffer({ resolveWithObject: true });
  const blurHash = encode(
    new Uint8ClampedArray(blurInput.data),
    blurInput.info.width,
    blurInput.info.height,
    4,
    3
  );

  return { url, fullUrl, thumbUrl, blurHash };
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
