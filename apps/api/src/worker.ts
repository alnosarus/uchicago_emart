import "dotenv/config";
import { Worker } from "bullmq";
import { getRedisConnection } from "./config/redis";
import { processImage } from "./workers/image-processing.worker";
import type { ImageProcessingJob } from "./queues/image-processing.queue";

// Initialize Firebase (same as main app)
import { initializeApp, cert, getApps } from "firebase-admin/app";

if (getApps().length === 0) {
  const serviceAccount = JSON.parse(
    Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT || "", "base64").toString()
  );
  initializeApp({ credential: cert(serviceAccount) });
}

const worker = new Worker<ImageProcessingJob>(
  "image-processing",
  async (job) => {
    console.log(`Processing image ${job.data.imageId} for post ${job.data.postId}`);
    await processImage(job.data);
    console.log(`Completed image ${job.data.imageId}`);
  },
  {
    connection: getRedisConnection(),
    concurrency: 3,
    stalledInterval: 30_000,
  }
);

worker.on("failed", (job, err) => {
  console.error(`Image processing failed for ${job?.data.imageId}:`, err.message);
  // Mark as failed in DB on final attempt
  if (job && job.attemptsMade >= (job.opts.attempts ?? 3)) {
    import("./config/database").then(({ prisma }) =>
      prisma.postImage.update({
        where: { id: job.data.imageId },
        data: { status: "failed" },
      }).catch(() => {})
    );
  }
});

worker.on("ready", () => {
  console.log("Image processing worker ready");
});

process.on("SIGTERM", async () => {
  await worker.close();
  process.exit(0);
});

process.on("SIGINT", async () => {
  await worker.close();
  process.exit(0);
});
