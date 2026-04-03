import { z } from "zod";
import dotenv from "dotenv";

dotenv.config({ path: "../../.env" });

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().default(3000),
  GOOGLE_CLIENT_ID: z.string().min(1),
  GOOGLE_CLIENT_ID_IOS: z.string().optional(),
  GOOGLE_CLIENT_ID_ANDROID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().min(1),
  JWT_SECRET: z.string().min(1),
  JWT_REFRESH_SECRET: z.string().min(1),
  FIREBASE_SERVICE_ACCOUNT: z.string().min(1),
  FIREBASE_STORAGE_BUCKET: z.string().optional(),
  ALLOWED_EMAIL_DOMAIN: z.string().default("uchicago.edu"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment variables:", parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
