import admin from "firebase-admin";
import { env } from "./env";

const serviceAccount = JSON.parse(
  Buffer.from(env.FIREBASE_SERVICE_ACCOUNT, "base64").toString("utf-8")
);

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

export const firebaseAuth = admin.auth();
export default admin;
