import "dotenv/config";
import express, { Express, NextFunction, Request, Response } from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import { Server } from "socket.io";
import {
  checkIfUserExists,
  newSocketConnection,
} from "./controllers/socket-management";

const app: Express = express();
const isProduction = process.env.NODE_ENV === "production";
const port = Number(process.env.PORT ?? 3001);

const allowedOrigins = (process.env.FRONTEND_ORIGIN ?? "http://localhost:3000")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const corsOptions = {
  origin: allowedOrigins,
  methods: ["GET", "POST"],
};

if (isProduction) {
  app.set("trust proxy", 1);
}

app.use(helmet());
app.use(cors(corsOptions));
app.use(express.json());
app.use(morgan(isProduction ? "combined" : "dev"));

const checkUserNameLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
});

app.get("/health", (_req: Request, res: Response) => {
  res.json({ success: true });
});

app.get(
  "/checkUserName",
  checkUserNameLimiter,
  (req: Request, res: Response) => {
    const userName = String(req.query.userName ?? "").trim();
    if (!userName) {
      res.json({ success: false, reason: "Username cannot be empty" });
      return;
    }

    const isUserRegistered = checkIfUserExists(userName);
    res.json({
      success: !isUserRegistered,
      reason: isUserRegistered ? "Username is already taken" : null,
    });
  },
);

app.use((_req: Request, res: Response) => {
  res.status(404).json({ success: false, reason: "Not found" });
});

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error("Unhandled request error", err);
  res.status(500).json({ success: false, reason: "Internal server error" });
});

const server = app.listen(port, () => {
  console.log(`Video conference backend listening on port ${port}`);
});

const io = new Server(server, {
  cors: corsOptions,
});

io.on("connection", (socket) => newSocketConnection(io, socket));

const shutdown = (signal: string) => {
  console.log(`${signal} received, shutting down gracefully`);
  io.close();
  server.close(() => {
    console.log("Server closed");
    process.exit(0);
  });

  setTimeout(() => {
    console.error("Forcing shutdown after timeout");
    process.exit(1);
  }, 10_000).unref();
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

process.on("unhandledRejection", (reason) => {
  console.error("Unhandled promise rejection", reason);
});

process.on("uncaughtException", (error) => {
  console.error("Uncaught exception", error);
  process.exit(1);
});
