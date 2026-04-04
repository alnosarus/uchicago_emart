import { Queue } from "bullmq";
import { getRedisConnection } from "../config/redis";

export interface ImageProcessingJob {
  imageId: string;
  postId: string;
  originalUrl: string;
  firebasePath: string;
}

let queue: Queue<ImageProcessingJob> | null = null;

export function getImageProcessingQueue(): Queue<ImageProcessingJob> {
  if (!queue) {
    queue = new Queue<ImageProcessingJob>("image-processing", {
      connection: getRedisConnection(),
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: "exponential", delay: 2000 },
        removeOnComplete: 100,
        removeOnFail: 50,
      },
    });
  }
  return queue;
}

export async function enqueueImageProcessing(job: ImageProcessingJob): Promise<void> {
  await getImageProcessingQueue().add("process-image", job, {
    timeout: 30_000,
  });
}
