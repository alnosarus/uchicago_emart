import jwt from "jsonwebtoken";
import { googleClient, JWT_CONFIG } from "../config/auth";
import { firebaseAuth } from "../config/firebase";
import { prisma } from "../config/database";
import { env } from "../config/env";

interface GoogleUserInfo {
  sub: string;
  email: string;
  name: string;
  picture?: string;
  hd?: string;
}

export async function loginWithGoogle(code: string) {
  // Exchange auth code for tokens
  const { tokens } = await googleClient.getToken(code);
  const idToken = tokens.id_token;
  if (!idToken) throw new HttpError(400, "No ID token received from Google");

  // Verify and decode the ID token
  const ticket = await googleClient.verifyIdToken({
    idToken,
    audience: env.GOOGLE_CLIENT_ID,
  });
  const payload = ticket.getPayload() as GoogleUserInfo;

  // Enforce UChicago domain
  if (payload.hd !== env.ALLOWED_EMAIL_DOMAIN) {
    throw new HttpError(403, "Only @uchicago.edu accounts are allowed");
  }

  // Find or create user
  let user = await prisma.user.findUnique({ where: { googleId: payload.sub } });
  const isNewUser = !user;

  if (!user) {
    user = await prisma.user.create({
      data: {
        googleId: payload.sub,
        email: payload.email,
        name: payload.name,
        avatarUrl: payload.picture || null,
        isVerified: false,
      },
    });
  }

  // Issue JWTs
  const accessToken = generateAccessToken(user.id);
  const refreshToken = generateRefreshToken(user.id);

  return {
    user,
    accessToken,
    refreshToken,
    needsPhoneVerification: !user.isVerified,
    isNewUser,
  };
}

export async function sendPhoneVerification(userId: string, phone: string) {
  // Use Firebase Phone Auth — create a session for the phone number
  // The actual SMS is sent by Firebase on the client side
  // Server just stores the phone number once verified
  await prisma.user.update({
    where: { id: userId },
    data: { phone },
  });

  return { success: true };
}

export async function confirmPhoneVerification(userId: string, firebaseIdToken: string) {
  // Verify the Firebase ID token from phone auth
  const decoded = await firebaseAuth.verifyIdToken(firebaseIdToken);

  if (!decoded.phone_number) {
    throw new HttpError(400, "No phone number in Firebase token");
  }

  // Mark user as verified with their phone number
  const user = await prisma.user.update({
    where: { id: userId },
    data: {
      phone: decoded.phone_number,
      isVerified: true,
    },
  });

  return { user };
}

export async function refreshAccessToken(refreshToken: string) {
  try {
    const payload = jwt.verify(refreshToken, JWT_CONFIG.refreshSecret) as { userId: string };
    const user = await prisma.user.findUnique({ where: { id: payload.userId } });
    if (!user) throw new HttpError(401, "User not found");

    const accessToken = generateAccessToken(user.id);
    return { accessToken };
  } catch {
    throw new HttpError(401, "Invalid refresh token");
  }
}

function generateAccessToken(userId: string): string {
  return jwt.sign({ userId }, JWT_CONFIG.accessSecret, {
    expiresIn: JWT_CONFIG.accessExpiresIn,
  });
}

function generateRefreshToken(userId: string): string {
  return jwt.sign({ userId }, JWT_CONFIG.refreshSecret, {
    expiresIn: JWT_CONFIG.refreshExpiresIn,
  });
}

export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = "HttpError";
  }
}
