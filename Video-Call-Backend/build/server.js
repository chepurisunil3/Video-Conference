"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var _a, _b;
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const socket_io_1 = require("socket.io");
const socket_management_1 = require("./controllers/socket-management");
const app = (0, express_1.default)();
const frontendOrigin = (_a = process.env.FRONTEND_ORIGIN) !== null && _a !== void 0 ? _a : "http://localhost:3000";
const port = Number((_b = process.env.PORT) !== null && _b !== void 0 ? _b : 3001);
app.use((0, cors_1.default)({ origin: frontendOrigin }));
app.use(express_1.default.json());
app.get("/health", (_req, res) => {
    res.json({ success: true });
});
app.get("/checkUserName", (req, res) => {
    var _a;
    const userName = String((_a = req.query.userName) !== null && _a !== void 0 ? _a : "").trim();
    if (!userName) {
        res.json({ success: false, reason: "Username cannot be empty" });
        return;
    }
    const isUserRegistered = (0, socket_management_1.checkIfUserExists)(userName);
    res.json({
        success: !isUserRegistered,
        reason: isUserRegistered ? "Username is already taken" : null,
    });
});
const server = app.listen(port, () => {
    console.log(`Video conference backend listening on port ${port}`);
});
const io = new socket_io_1.Server(server, {
    cors: {
        origin: frontendOrigin,
        methods: ["GET", "POST"],
    },
});
io.on("connection", (socket) => (0, socket_management_1.newSocketConnection)(io, socket));
