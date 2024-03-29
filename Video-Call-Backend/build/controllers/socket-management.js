"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkIfUserExists = exports.newSocketConnection = void 0;
let listOfUsers = {};
const newSocketConnection = (io, socket) => {
    if (!socket.handshake.query || !socket.handshake.query.userName) {
        socket.disconnect();
    }
    sendDefaultPollData(socket);
    socket.on("setTimer", (data) => startTimer(io, socket, data));
    socket.on("hostCall", () => hostNewCall(io, socket));
    socket.on("joinCall", (data) => joinExistingCall(io, socket, data));
    socket.on("offer", (data) => {
        var _a, _b;
        const userName = (_b = (_a = socket.handshake.query) === null || _a === void 0 ? void 0 : _a.userName) === null || _b === void 0 ? void 0 : _b.toString();
        if (!userName) {
            return;
        }
        if (listOfUsers[userName] && data.offer) {
            listOfUsers[userName].offer = data.offer;
        }
    });
    socket.on("membersDetails", (data) => sendExistingCallUsers(io, socket, data));
    socket.on("requestToJoin", (data) => requestToJoin(io, socket, data));
    socket.on("endParticipantCall", (data) => endParticipantCall(io, socket, data));
    socket.on("endHostCall", (data) => endHostCall(io, socket, data));
    socket.on("removeParticipant", (data) => removeParticipant(io, socket, data));
    socket.on("muteParticipant", (data) => muteParticipant(io, socket, data));
};
exports.newSocketConnection = newSocketConnection;
const checkIfUserExists = (userName) => {
    if (listOfUsers[userName]) {
        return true;
    }
    else {
        listOfUsers[userName] = {
            joinedRoom: null,
            hostedRoom: null,
            socketid: null,
            isTimerRunning: false,
            timerCount: 0,
            offer: null,
        };
        return false;
    }
};
exports.checkIfUserExists = checkIfUserExists;
const sendDefaultPollData = (socket) => {
    var _a, _b;
    const userName = (_b = (_a = socket.handshake.query) === null || _a === void 0 ? void 0 : _a.userName) === null || _b === void 0 ? void 0 : _b.toString();
    if (!userName) {
        return;
    }
    if (listOfUsers[userName]) {
        socket.emit("defaultPoll", listOfUsers[userName]);
        const hostedRoom = listOfUsers[userName].hostedRoom;
        const joinedRoom = listOfUsers[userName].joinedRoom;
        if (hostedRoom) {
            socket.join(hostedRoom);
        }
        if (joinedRoom) {
            socket.join(joinedRoom);
        }
    }
    else {
        listOfUsers[userName] = {
            joinedRoom: null,
            hostedRoom: null,
            socketid: null,
            isTimerRunning: false,
            timerCount: 0,
            offer: null,
        };
    }
    listOfUsers[userName].socketid = socket.id;
};
const startTimer = (io, socket, data) => {
    var _a, _b;
    const userName = (_b = (_a = socket.handshake.query) === null || _a === void 0 ? void 0 : _a.userName) === null || _b === void 0 ? void 0 : _b.toString();
    if (!userName) {
        return;
    }
    let room = userName.toLowerCase();
    listOfUsers[userName].isTimerRunning = true;
    listOfUsers[userName].timerCount = Number(data.seconds) + 1;
    let stopInterval = setInterval(() => {
        if (listOfUsers[userName].timerCount <= 0) {
            clearInterval(stopInterval);
            socket.emit("timerStopped", {});
        }
        else {
            listOfUsers[userName].timerCount--;
        }
        io.to(room).emit("timerUpdate", {
            count: listOfUsers[userName].timerCount,
        });
    }, 1000);
    socket.emit("startedTimer", { success: true });
};
const hostNewCall = (io, socket) => {
    var _a, _b;
    const userName = (_b = (_a = socket.handshake.query) === null || _a === void 0 ? void 0 : _a.userName) === null || _b === void 0 ? void 0 : _b.toString();
    if (!userName) {
        socket.emit("hostingResponse", {
            success: false,
            reason: "User not Authenticated",
        });
        return;
    }
    if (listOfUsers[userName]) {
        const roomName = userName.toLocaleLowerCase();
        const rooms = io.sockets.adapter.rooms;
        const room = rooms.get(roomName);
        if (room) {
            socket.emit("hostingResponse", {
                success: false,
                reason: "Already hosting!",
            });
        }
        else {
            socket.join(roomName);
            socket.emit("hostingResponse", { success: true, roomName });
            listOfUsers[userName].hostedRoom = roomName;
        }
    }
};
const joinExistingCall = (io, socket, data) => {
    var _a, _b;
    const userName = (_b = (_a = socket.handshake.query) === null || _a === void 0 ? void 0 : _a.userName) === null || _b === void 0 ? void 0 : _b.toString();
    if (!userName) {
        socket.emit("joiningResponse", {
            success: false,
            reason: "User not found",
        });
        return;
    }
    const roomName = data.roomToJoin.toLowerCase();
    if (!roomName) {
        socket.emit("joiningResponse", {
            success: false,
            reason: "Room name not specified",
        });
    }
    if (listOfUsers[userName]) {
        if (!socket.rooms.has(roomName)) {
            const rooms = io.sockets.adapter.rooms;
            const room = rooms.get(roomName);
            if (room) {
                socket.join(roomName);
                socket.to(roomName).emit("userJoined", { userName });
                socket.emit("joiningResponse", {
                    success: true,
                    reason: null,
                    roomName,
                });
                listOfUsers[userName].joinedRoom = roomName;
            }
            else {
                socket.emit("joiningResponse", {
                    success: false,
                    reason: "Call you're joining is not found!",
                });
            }
        }
        else {
            socket.emit("joiningResponse", {
                success: false,
                reason: "Already in the call!",
            });
        }
    }
};
const requestToJoin = (io, socket, data) => {
    var _a, _b;
    const userName = (_b = (_a = socket.handshake.query) === null || _a === void 0 ? void 0 : _a.userName) === null || _b === void 0 ? void 0 : _b.toString();
    if (!userName) {
        socket.emit("requestJoiningResponse", {
            success: false,
            reason: "Authentication failed",
        });
        return;
    }
    if (data && data.userName) {
        const requestedUser = data.userName;
        if (listOfUsers[requestedUser] && listOfUsers[requestedUser].socketid) {
            const socketId = listOfUsers[requestedUser].socketid;
            if (socketId) {
                io.to(socketId).emit("requestToJoin", { roomName: userName });
            }
        }
        else {
            socket.emit("requestJoiningResponse", {
                success: false,
                reason: "User is not connected",
            });
        }
    }
};
const sendExistingCallUsers = (io, socket, data) => {
    var _a, _b;
    const userName = (_b = (_a = socket.handshake.query) === null || _a === void 0 ? void 0 : _a.userName) === null || _b === void 0 ? void 0 : _b.toString();
    if (!userName) {
        socket.emit("membersDetails", { success: false, reason: "Invalid User" });
        return;
    }
    const roomName = data.roomName.toLowerCase();
    if (roomName) {
        const room = io.sockets.adapter.rooms.get(roomName);
        if (room) {
            let users = [];
            room.forEach((eachUser) => {
                const eachSocket = io.sockets.sockets.get(eachUser);
                if (eachSocket === null || eachSocket === void 0 ? void 0 : eachSocket.handshake.query.userName) {
                    if (userName != (eachSocket === null || eachSocket === void 0 ? void 0 : eachSocket.handshake.query.userName))
                        users.push(eachSocket.handshake.query.userName.toString());
                }
            });
            socket.emit("membersDetails", {
                success: true,
                data: users,
                roomName: roomName,
            });
        }
        else {
            socket.emit("membersDetails", {
                success: false,
                reason: "Cannot find the Room",
            });
        }
    }
};
const endParticipantCall = (io, socket, data) => {
    var _a, _b;
    const userName = (_b = (_a = socket.handshake.query) === null || _a === void 0 ? void 0 : _a.userName) === null || _b === void 0 ? void 0 : _b.toString();
    if (!userName) {
        return;
    }
    const roomName = data.roomName.toLowerCase();
    if (roomName) {
        listOfUsers[userName].joinedRoom = null;
        socket.leave(roomName);
        io.to(roomName).emit("userLeft", { userName: userName });
        socket.emit("endCallResponse", { success: true });
    }
    else {
        socket.emit("endCallResponse", {
            success: false,
            reason: "Cannot find the room",
        });
    }
};
const endHostCall = (io, socket, data) => {
    var _a, _b;
    const userName = (_b = (_a = socket.handshake.query) === null || _a === void 0 ? void 0 : _a.userName) === null || _b === void 0 ? void 0 : _b.toString();
    if (!userName) {
        return;
    }
    const roomName = data.roomName.toLowerCase();
    if (roomName) {
        const roomMembers = io.sockets.adapter.rooms.get(roomName);
        roomMembers === null || roomMembers === void 0 ? void 0 : roomMembers.forEach((eachMember) => {
            const eachSocket = io.sockets.sockets.get(eachMember);
            if (eachSocket === null || eachSocket === void 0 ? void 0 : eachSocket.handshake.query.userName) {
                if (listOfUsers[userName]) {
                    io.to(eachSocket.id).emit("endCallResponse", { success: true });
                    listOfUsers[userName].joinedRoom = null;
                }
            }
        });
        io.in(roomName).socketsLeave(roomName);
        listOfUsers[userName].hostedRoom = null;
        socket.emit("endCallResponse", { success: true });
    }
    else {
        socket.emit("endCallResponse", {
            success: false,
            reason: "Cannot find the room",
        });
    }
};
const removeParticipant = (io, socket, data) => {
    var _a, _b;
    const userName = (_b = (_a = socket.handshake.query) === null || _a === void 0 ? void 0 : _a.userName) === null || _b === void 0 ? void 0 : _b.toString();
    if (!userName) {
        return;
    }
    const memberToRemove = data.userName;
    if (memberToRemove) {
        if (listOfUsers[memberToRemove]) {
            let socketid = listOfUsers[memberToRemove].socketid;
            if (socketid) {
                const userSocket = io.sockets.sockets.get(socketid);
                if (userSocket) {
                    endParticipantCall(io, userSocket, { roomName: userName });
                }
            }
        }
    }
};
const muteParticipant = (io, socket, data) => {
    var _a, _b;
    const userName = (_b = (_a = socket.handshake.query) === null || _a === void 0 ? void 0 : _a.userName) === null || _b === void 0 ? void 0 : _b.toString();
    if (!userName) {
        return;
    }
    const memberToMute = data.userName;
    if (listOfUsers[memberToMute]) {
        let socketid = listOfUsers[memberToMute].socketid;
        if (socketid) {
            const userSocket = io.sockets.sockets.get(socketid);
            if (userSocket) {
                userSocket.emit("setToMute");
            }
        }
    }
};
