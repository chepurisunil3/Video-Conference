import express, { Express, Request, Response } from "express";
import cors from "cors";
import { Server } from "socket.io";
import {
  checkIfUserExists,
  newSocketConnection,
} from "./controllers/socket-management";

const app: Express = express();
const frontendOrigin = process.env.FRONTEND_ORIGIN ?? "http://localhost:3000";
const port = Number(process.env.PORT ?? 3001);

app.use(cors({ origin: frontendOrigin }));
app.use(express.json());

app.get("/health", (_req: Request, res: Response) => {
  res.json({ success: true });
});

app.get("/checkUserName", (req: Request, res: Response) => {
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
});

const server = app.listen(port, () => {
  console.log(`Video conference backend listening on port ${port}`);
});

const io = new Server(server, {
  cors: {
    origin: frontendOrigin,
    methods: ["GET", "POST"],
  },
});

io.on("connection", (socket) => newSocketConnection(io, socket));
