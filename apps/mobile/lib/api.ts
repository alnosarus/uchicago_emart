import { createApi } from "@uchicago-marketplace/shared";

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || "http://localhost:3000";

let tokenGetter: () => string | null = () => null;

export function setTokenGetter(fn: () => string | null) {
  tokenGetter = fn;
}

export const api = createApi(API_BASE_URL, () => tokenGetter());
