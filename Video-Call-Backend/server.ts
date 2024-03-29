import express, { Express, Request, Response } from "express";
import socket, { Socket } from "socket.io";
import { PeerServer } from "peer";
import cors from "cors";
import {
	checkIfUserExists,
	newSocketConnection,
} from "./controllers/socket-management";
const app: Express = express();
app.use(cors());
app.get("/checkUserName", (req: Request, res: Response) => {
	const userName: string = String(req.query.userName);
	if (userName) {
		const isUserRegistered = checkIfUserExists(userName);
		res.json({
			success: isUserRegistered ? false : true,
			reason: isUserRegistered ? "Username is already taken" : null,
		});
	} else {
		res.json({ success: false, reason: "Username cannot be empty" });
	}
});
const server = app.listen("3001");
const io: socket.Server = new socket.Server(server, {
	cors: {
		origin: "http://localhost:3000",
		methods: ["GET", "POST", "WSS"],
	},
});
io.on("connection", (socket) => newSocketConnection(io, socket));

const peerServer = PeerServer({ port: 9000, path: "/" });

peerServer.on("connection", (client) => {});
