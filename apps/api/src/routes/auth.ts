import { Router } from "express";
import type { Response } from "express";
import { requireAuth, type AuthRequest } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { googleAuthSchema, phoneVerifyRequestSchema } from "@uchicago-marketplace/shared";
import {
  loginWithGoogle,
  sendPhoneVerification,
  confirmPhoneVerification,
  refreshAccessToken,
} from "../services/auth.service";
import { z } from "zod";

const router = Router();

// POST /api/auth/google — Exchange Google auth code for JWT
router.post("/google", validate(googleAuthSchema), async (req, res: Response, next) => {
  try {
    const { code } = req.body;
    const result = await loginWithGoogle(code);

    // Set refresh token as httpOnly cookie
    res.cookie("refreshToken", result.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      path: "/api/auth",
    });

    res.json({
      user: result.user,
      accessToken: result.accessToken,
      needsPhoneVerification: result.needsPhoneVerification,
      isNewUser: result.isNewUser,
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/verify-phone — Submit phone number
router.post(
  "/verify-phone",
  requireAuth,
  validate(phoneVerifyRequestSchema),
  async (req: AuthRequest, res: Response, next) => {
    try {
      const result = await sendPhoneVerification(req.userId!, req.body.phone);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/auth/verify-phone/confirm — Confirm with Firebase token
const confirmSchema = z.object({ firebaseIdToken: z.string().min(1) });
router.post(
  "/verify-phone/confirm",
  requireAuth,
  validate(confirmSchema),
  async (req: AuthRequest, res: Response, next) => {
    try {
      const result = await confirmPhoneVerification(req.userId!, req.body.firebaseIdToken);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/auth/refresh — Refresh access token
router.post("/refresh", async (req, res: Response, next) => {
  try {
    const refreshToken = req.cookies?.refreshToken;
    if (!refreshToken) {
      res.status(401).json({ message: "No refresh token" });
      return;
    }
    const result = await refreshAccessToken(refreshToken);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/logout — Clear refresh token
router.post("/logout", (_req, res: Response) => {
  res.clearCookie("refreshToken", { path: "/api/auth" });
  res.json({ success: true });
});

export default router;
