import { Server } from "socket.io";
import type { Server as HttpServer } from "http";
import jwt from "jsonwebtoken";
import { JWT_CONFIG } from "../config/auth";
import type { ServerToClientEvents, ClientToServerEvents } from "@uchicago-marketplace/shared";

let io: Server<ClientToServerEvents, ServerToClientEvents> | null = null;

export function initSocket(httpServer: HttpServer, corsOrigins: string[]) {
  io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
    cors: {
      origin: corsOrigins,
      credentials: true,
    },
  });

  // JWT authentication middleware
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) {
      return next(new Error("Authentication required"));
    }
    try {
      const payload = jwt.verify(token, JWT_CONFIG.accessSecret) as { userId: string };
      socket.data.userId = payload.userId;
      next();
    } catch {
      next(new Error("Invalid or expired token"));
    }
  });

  io.on("connection", (socket) => {
    const userId = socket.data.userId as string;
    socket.join(`user:${userId}`);

    socket.on("disconnect", () => {
      // Cleanup if needed in the future
    });
  });

  return io;
}

export function getIO() {
  return io;
}
