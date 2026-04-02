import { OAuth2Client } from "google-auth-library";
import { env } from "./env";

export const googleClient = new OAuth2Client(
  env.GOOGLE_CLIENT_ID,
  env.GOOGLE_CLIENT_SECRET,
  "postmessage" // for auth code flow from frontend
);

export const JWT_CONFIG = {
  accessSecret: env.JWT_SECRET!,
  refreshSecret: env.JWT_REFRESH_SECRET!,
  accessExpiresIn: "15m" as const,
  refreshExpiresIn: "7d" as const,
};
