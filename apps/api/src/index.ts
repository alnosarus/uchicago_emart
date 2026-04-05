import express from "express";
import { createServer } from "http";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import { env } from "./config/env";
import { errorHandler } from "./middleware/errorHandler";
import { initSocket } from "./socket";
import healthRoutes from "./routes/health";
import authRoutes from "./routes/auth";
import userRoutes from "./routes/users";
import postRoutes from "./routes/posts";
import transactionRoutes from "./routes/transactions";
import reviewRoutes from "./routes/reviews";
import savedRoutes from "./routes/saved";
import notificationRoutes from "./routes/notifications";

const app = express();
const server = createServer(app);

const CORS_ORIGINS = [
  "http://localhost:3001",
  "http://localhost:8081",
  "https://www.uchicagoemart.com",
  "https://uchicagoemart.com",
];

// Middleware
app.use(helmet());
app.use(cors({
  origin: CORS_ORIGINS,
  credentials: true,
}));
app.use(morgan("dev"));
app.use(express.json());
app.use(cookieParser());

// Routes
app.use("/api", healthRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/posts", postRoutes);
app.use("/api/transactions", transactionRoutes);
app.use("/api/reviews", reviewRoutes);
app.use("/api/saved", savedRoutes);
app.use("/api/notifications", notificationRoutes);

// Error handler (must be last)
app.use(errorHandler);

// Socket.IO
initSocket(server, CORS_ORIGINS);

server.listen(env.PORT, () => {
  console.log(`API running on http://localhost:${env.PORT}`);
  console.log(`Health check: http://localhost:${env.PORT}/api/health`);
});

export default app;
