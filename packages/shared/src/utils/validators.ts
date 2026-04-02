import { APP_CONFIG } from "../constants/config";

export function isUChicagoEmail(email: string): boolean {
  return email.toLowerCase().endsWith(`@${APP_CONFIG.allowedEmailDomain}`);
}

export function isValidPhone(phone: string): boolean {
  return /^\+?[1-9]\d{9,14}$/.test(phone);
}
