"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const socket_io_1 = __importDefault(require("socket.io"));
const peer_1 = require("peer");
const cors_1 = __importDefault(require("cors"));
const socket_management_1 = require("./controllers/socket-management");
const app = (0, express_1.default)();
app.use((0, cors_1.default)());
app.get("/checkUserName", (req, res) => {
    const userName = String(req.query.userName);
    if (userName) {
        const isUserRegistered = (0, socket_management_1.checkIfUserExists)(userName);
        res.json({
            success: isUserRegistered ? false : true,
            reason: isUserRegistered ? "Username is already taken" : null,
        });
    }
    else {
        res.json({ success: false, reason: "Username cannot be empty" });
    }
});
const server = app.listen("3001");
const io = new socket_io_1.default.Server(server, {
    cors: {
        origin: "http://localhost:3000",
        methods: ["GET", "POST", "WSS"],
    },
});
io.on("connection", (socket) => (0, socket_management_1.newSocketConnection)(io, socket));
const peerServer = (0, peer_1.PeerServer)({ port: 9000, path: "/" });
peerServer.on("connection", (client) => { });
