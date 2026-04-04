import sharp from "sharp";
import { encode } from "blurhash";
import { getStorage } from "firebase-admin/storage";
import { prisma } from "../config/database";
import type { ImageProcessingJob } from "../queues/image-processing.queue";

const BUCKET_NAME = process.env.FIREBASE_STORAGE_BUCKET || "";

export async function processImage(job: ImageProcessingJob): Promise<void> {
  const { imageId, postId, firebasePath } = job;

  // Check image still exists (post may have been deleted)
  const image = await prisma.postImage.findUnique({ where: { id: imageId } });
  if (!image) return;

  const bucket = getStorage().bucket(BUCKET_NAME);

  // Download original
  const [buffer] = await bucket.file(firebasePath).download();

  // Detect animated images (GIF) — skip processing
  const metadata = await sharp(buffer).metadata();
  if (metadata.pages && metadata.pages > 1) {
    await prisma.postImage.update({
      where: { id: imageId },
      data: { status: "ready" },
    });
    return;
  }

  // Generate full-size WebP (max 1200px wide, 80% quality)
  const fullBuffer = await sharp(buffer)
    .rotate() // auto-rotate based on EXIF
    .resize({ width: 1200, withoutEnlargement: true })
    .webp({ quality: 80 })
    .toBuffer();

  // Generate thumbnail (400px wide, 70% quality)
  const thumbBuffer = await sharp(buffer)
    .rotate()
    .resize({ width: 400, withoutEnlargement: true })
    .webp({ quality: 70 })
    .toBuffer();

  // Compute blur hash from thumbnail
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

  // Build storage paths from the original path
  const baseName = firebasePath.split("/").pop()!.replace(/\.[^.]+$/, "");
  const fullPath = `posts/${postId}/full/${baseName}.webp`;
  const thumbPath = `posts/${postId}/thumb/${baseName}.webp`;

  // Upload processed images
  const fullFile = bucket.file(fullPath);
  await fullFile.save(fullBuffer, { metadata: { contentType: "image/webp" } });
  await fullFile.makePublic();

  const thumbFile = bucket.file(thumbPath);
  await thumbFile.save(thumbBuffer, { metadata: { contentType: "image/webp" } });
  await thumbFile.makePublic();

  const fullUrl = `https://storage.googleapis.com/${BUCKET_NAME}/${fullPath}`;
  const thumbUrl = `https://storage.googleapis.com/${BUCKET_NAME}/${thumbPath}`;

  // Update database record
  await prisma.postImage.update({
    where: { id: imageId },
    data: { fullUrl, thumbUrl, blurHash, status: "ready" },
  });
}
