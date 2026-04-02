import { z } from "zod";

export const googleAuthSchema = z.object({
  code: z.string().min(1, "Authorization code is required"),
});

export const phoneVerifyRequestSchema = z.object({
  phone: z
    .string()
    .min(10, "Phone number must be at least 10 digits")
    .regex(/^\+?[1-9]\d{9,14}$/, "Invalid phone number format"),
});

export const phoneVerifyConfirmSchema = z.object({
  phone: z.string(),
  code: z
    .string()
    .length(6, "Verification code must be 6 digits")
    .regex(/^\d{6}$/, "Code must be numeric"),
});

export type GoogleAuthInput = z.infer<typeof googleAuthSchema>;
export type PhoneVerifyRequestInput = z.infer<typeof phoneVerifyRequestSchema>;
export type PhoneVerifyConfirmInput = z.infer<typeof phoneVerifyConfirmSchema>;
