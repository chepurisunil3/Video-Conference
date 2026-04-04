"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkIfUserExists = exports.newSocketConnection = void 0;
const listOfUsers = {};
const createDefaultMediaState = () => ({
    audioEnabled: true,
    videoEnabled: true,
    handRaised: false,
});
const createDefaultUserState = () => ({
    socketId: null,
    joinedRoom: null,
    hostedRoom: null,
    isTimerRunning: false,
    timerCount: 0,
    mediaState: createDefaultMediaState(),
    timerHandle: null,
});
const normalizeUserName = (userName) => userName.trim().toLowerCase();
const findUserNameKey = (userName) => {
    const normalized = normalizeUserName(userName);
    for (const currentUserName of Object.keys(listOfUsers)) {
        if (normalizeUserName(currentUserName) === normalized) {
            return currentUserName;
        }
    }
    return null;
};
const getOrCreateUserState = (userName) => {
    const existingKey = findUserNameKey(userName);
    const keyToUse = existingKey !== null && existingKey !== void 0 ? existingKey : userName.trim();
    if (!listOfUsers[keyToUse]) {
        listOfUsers[keyToUse] = createDefaultUserState();
    }
    return listOfUsers[keyToUse];
};
const getSocketUserName = (socket) => {
    var _a, _b;
    const userNameFromQuery = (_a = socket.handshake.query) === null || _a === void 0 ? void 0 : _a.userName;
    if (typeof userNameFromQuery === "string" && userNameFromQuery.trim()) {
        return userNameFromQuery.trim();
    }
    if (Array.isArray(userNameFromQuery) && ((_b = userNameFromQuery[0]) === null || _b === void 0 ? void 0 : _b.trim())) {
        return userNameFromQuery[0].trim();
    }
    return null;
};
const getRoomName = (roomName) => { var _a; return (_a = roomName === null || roomName === void 0 ? void 0 : roomName.trim().toLowerCase()) !== null && _a !== void 0 ? _a : ""; };
const clearTimerForUser = (userName) => {
    const userState = getOrCreateUserState(userName);
    if (userState.timerHandle) {
        clearInterval(userState.timerHandle);
        userState.timerHandle = null;
    }
    userState.isTimerRunning = false;
    userState.timerCount = 0;
};
const getRoomMembers = (io, roomName, requestingUserName) => {
    const room = io.sockets.adapter.rooms.get(roomName);
    if (!room) {
        return [];
    }
    const members = [];
    room.forEach((socketId) => {
        const memberSocket = io.sockets.sockets.get(socketId);
        if (!memberSocket) {
            return;
        }
        const memberUserName = getSocketUserName(memberSocket);
        if (!memberUserName || memberUserName === requestingUserName) {
            return;
        }
        const userState = getOrCreateUserState(memberUserName);
        members.push({
            userName: memberUserName,
            isHost: userState.hostedRoom === roomName,
            mediaState: userState.mediaState,
        });
    });
    return members;
};
const emitRoomMembers = (io, roomName) => {
    const members = getRoomMembers(io, roomName);
    members.forEach((member) => {
        const socketId = getOrCreateUserState(member.userName).socketId;
        if (!socketId) {
            return;
        }
        io.to(socketId).emit("membersDetails", {
            success: true,
            data: getRoomMembers(io, roomName, member.userName),
            roomName,
        });
    });
};
const emitSignalToTarget = (io, targetUserName, eventName, payload) => {
    const targetKey = findUserNameKey(targetUserName);
    if (!targetKey) {
        return;
    }
    const targetSocketId = getOrCreateUserState(targetKey).socketId;
    if (!targetSocketId) {
        return;
    }
    io.to(targetSocketId).emit(eventName, payload);
};
const leaveJoinedRoom = (io, userName, roomName, shouldNotifyCurrentSocket, reason) => {
    const normalizedRoomName = getRoomName(roomName);
    if (!normalizedRoomName) {
        return;
    }
    const userState = getOrCreateUserState(userName);
    const socketId = userState.socketId;
    const currentSocket = socketId ? io.sockets.sockets.get(socketId) : undefined;
    userState.joinedRoom = null;
    if (currentSocket === null || currentSocket === void 0 ? void 0 : currentSocket.rooms.has(normalizedRoomName)) {
        currentSocket.leave(normalizedRoomName);
    }
    io.to(normalizedRoomName).emit("userLeft", { userName });
    emitRoomMembers(io, normalizedRoomName);
    if (shouldNotifyCurrentSocket && currentSocket) {
        currentSocket.emit("endCallResponse", {
            success: true,
            reason: reason !== null && reason !== void 0 ? reason : null,
        });
    }
};
const closeHostedRoom = (io, userName, roomName, shouldNotifyCurrentSocket, reason = "Host ended the call") => {
    var _a;
    const normalizedRoomName = getRoomName(roomName);
    if (!normalizedRoomName) {
        return;
    }
    const roomMembers = Array.from((_a = io.sockets.adapter.rooms.get(normalizedRoomName)) !== null && _a !== void 0 ? _a : []);
    const hostState = getOrCreateUserState(userName);
    clearTimerForUser(userName);
    roomMembers.forEach((socketId) => {
        const memberSocket = io.sockets.sockets.get(socketId);
        if (!memberSocket) {
            return;
        }
        const memberUserName = getSocketUserName(memberSocket);
        if (!memberUserName) {
            return;
        }
        if (memberUserName !== userName) {
            getOrCreateUserState(memberUserName).joinedRoom = null;
            memberSocket.emit("endCallResponse", { success: true, reason });
        }
    });
    io.in(normalizedRoomName).socketsLeave(normalizedRoomName);
    hostState.hostedRoom = null;
    if (shouldNotifyCurrentSocket && hostState.socketId) {
        io.to(hostState.socketId).emit("endCallResponse", {
            success: true,
            reason: null,
        });
    }
};
const newSocketConnection = (io, socket) => {
    const userName = getSocketUserName(socket);
    if (!userName) {
        socket.disconnect(true);
        return;
    }
    sendDefaultPollData(socket);
    socket.on("setTimer", (data) => startTimer(io, socket, data));
    socket.on("hostCall", () => hostNewCall(io, socket));
    socket.on("joinCall", (data) => joinExistingCall(io, socket, data));
    socket.on("membersDetails", (data) => sendExistingCallUsers(io, socket, data));
    socket.on("requestToJoin", (data) => requestToJoin(io, socket, data));
    socket.on("endParticipantCall", (data) => endParticipantCall(io, socket, data));
    socket.on("endHostCall", (data) => endHostCall(io, socket, data));
    socket.on("removeParticipant", (data) => removeParticipant(io, socket, data));
    socket.on("muteParticipant", (data) => muteParticipant(io, socket, data));
    socket.on("mediaStateChanged", (data) => updateMediaState(io, socket, data));
    socket.on("webrtc:offer", (data) => relayOffer(io, socket, data));
    socket.on("webrtc:answer", (data) => relayAnswer(io, socket, data));
    socket.on("webrtc:ice-candidate", (data) => relayIceCandidate(io, socket, data));
    socket.on("disconnect", () => handleDisconnect(io, socket));
};
exports.newSocketConnection = newSocketConnection;
const checkIfUserExists = (userName) => {
    const trimmedUserName = userName.trim();
    if (!trimmedUserName) {
        return false;
    }
    const existingUserKey = findUserNameKey(trimmedUserName);
    if (existingUserKey && getOrCreateUserState(existingUserKey).socketId) {
        return true;
    }
    getOrCreateUserState(trimmedUserName);
    return false;
};
exports.checkIfUserExists = checkIfUserExists;
const sendDefaultPollData = (socket) => {
    const userName = getSocketUserName(socket);
    if (!userName) {
        return;
    }
    const userState = getOrCreateUserState(userName);
    userState.socketId = socket.id;
    if (userState.hostedRoom) {
        socket.join(userState.hostedRoom);
    }
    if (userState.joinedRoom) {
        socket.join(userState.joinedRoom);
    }
    socket.emit("defaultPoll", {
        joinedRoom: userState.joinedRoom,
        hostedRoom: userState.hostedRoom,
        isTimerRunning: userState.isTimerRunning,
        timerCount: userState.timerCount,
        mediaState: userState.mediaState,
    });
};
const startTimer = (io, socket, data) => {
    var _a, _b;
    const userName = getSocketUserName(socket);
    if (!userName) {
        return;
    }
    const userState = getOrCreateUserState(userName);
    const roomName = (_a = userState.hostedRoom) !== null && _a !== void 0 ? _a : getRoomName(userState.joinedRoom);
    const seconds = Math.max(0, Number((_b = data.seconds) !== null && _b !== void 0 ? _b : 0));
    if (!roomName) {
        socket.emit("startedTimer", {
            success: false,
            reason: "No active room found",
        });
        return;
    }
    clearTimerForUser(userName);
    userState.isTimerRunning = true;
    userState.timerCount = seconds;
    io.to(roomName).emit("startedTimer", { success: true, count: seconds });
    io.to(roomName).emit("timerUpdate", { count: seconds });
    userState.timerHandle = setInterval(() => {
        userState.timerCount -= 1;
        io.to(roomName).emit("timerUpdate", {
            count: Math.max(userState.timerCount, 0),
        });
        if (userState.timerCount <= 0) {
            clearTimerForUser(userName);
            io.to(roomName).emit("timerStopped", {});
        }
    }, 1000);
};
const hostNewCall = (io, socket) => {
    const userName = getSocketUserName(socket);
    if (!userName) {
        socket.emit("hostingResponse", {
            success: false,
            reason: "User not authenticated",
        });
        return;
    }
    const userState = getOrCreateUserState(userName);
    const roomName = normalizeUserName(userName);
    const room = io.sockets.adapter.rooms.get(roomName);
    if (room && userState.hostedRoom === roomName) {
        socket.emit("hostingResponse", { success: true, roomName });
        return;
    }
    if (room) {
        socket.emit("hostingResponse", {
            success: false,
            reason: "This room is already active",
        });
        return;
    }
    if (userState.joinedRoom) {
        leaveJoinedRoom(io, userName, userState.joinedRoom, false);
    }
    socket.join(roomName);
    userState.hostedRoom = roomName;
    socket.emit("hostingResponse", { success: true, roomName });
};
const joinExistingCall = (io, socket, data) => {
    const userName = getSocketUserName(socket);
    if (!userName) {
        socket.emit("joiningResponse", {
            success: false,
            reason: "User not found",
        });
        return;
    }
    const userState = getOrCreateUserState(userName);
    const roomName = getRoomName(data.roomToJoin);
    if (!roomName) {
        socket.emit("joiningResponse", {
            success: false,
            reason: "Room name not specified",
        });
        return;
    }
    if (userState.hostedRoom) {
        socket.emit("joiningResponse", {
            success: false,
            reason: "End your hosted call before joining another one",
        });
        return;
    }
    if (!io.sockets.adapter.rooms.get(roomName)) {
        socket.emit("joiningResponse", {
            success: false,
            reason: "Call not found",
        });
        return;
    }
    if (userState.joinedRoom === roomName && socket.rooms.has(roomName)) {
        socket.emit("joiningResponse", {
            success: false,
            reason: "Already in the call",
        });
        return;
    }
    if (userState.joinedRoom) {
        leaveJoinedRoom(io, userName, userState.joinedRoom, false);
    }
    socket.join(roomName);
    userState.joinedRoom = roomName;
    socket.to(roomName).emit("userJoined", {
        userName,
        isHost: false,
        mediaState: userState.mediaState,
    });
    emitRoomMembers(io, roomName);
    socket.emit("joiningResponse", {
        success: true,
        reason: null,
        roomName,
    });
};
const requestToJoin = (io, socket, data) => {
    var _a;
    const userName = getSocketUserName(socket);
    if (!userName) {
        socket.emit("requestJoiningResponse", {
            success: false,
            reason: "Authentication failed",
        });
        return;
    }
    if (!((_a = data.userName) === null || _a === void 0 ? void 0 : _a.trim())) {
        socket.emit("requestJoiningResponse", {
            success: false,
            reason: "Username is required",
        });
        return;
    }
    const requestedUserKey = findUserNameKey(data.userName);
    if (!requestedUserKey) {
        socket.emit("requestJoiningResponse", {
            success: false,
            reason: "User is not registered",
        });
        return;
    }
    const requestedUserSocketId = getOrCreateUserState(requestedUserKey).socketId;
    if (!requestedUserSocketId) {
        socket.emit("requestJoiningResponse", {
            success: false,
            reason: "User is not connected",
        });
        return;
    }
    io.to(requestedUserSocketId).emit("requestToJoin", {
        roomName: normalizeUserName(userName),
        requestedBy: userName,
    });
    socket.emit("requestJoiningResponse", {
        success: true,
        reason: null,
    });
};
const sendExistingCallUsers = (io, socket, data) => {
    const userName = getSocketUserName(socket);
    if (!userName) {
        socket.emit("membersDetails", { success: false, reason: "Invalid user" });
        return;
    }
    const roomName = getRoomName(data.roomName);
    if (!roomName) {
        socket.emit("membersDetails", {
            success: false,
            reason: "Cannot find the room",
        });
        return;
    }
    const room = io.sockets.adapter.rooms.get(roomName);
    if (!room) {
        socket.emit("membersDetails", {
            success: false,
            reason: "Cannot find the room",
        });
        return;
    }
    socket.emit("membersDetails", {
        success: true,
        data: getRoomMembers(io, roomName, userName),
        roomName,
    });
};
const endParticipantCall = (io, socket, data) => {
    var _a;
    const userName = getSocketUserName(socket);
    if (!userName) {
        return;
    }
    const userState = getOrCreateUserState(userName);
    const roomName = getRoomName((_a = data.roomName) !== null && _a !== void 0 ? _a : userState.joinedRoom);
    if (!roomName) {
        socket.emit("endCallResponse", {
            success: false,
            reason: "Cannot find the room",
        });
        return;
    }
    leaveJoinedRoom(io, userName, roomName, true);
};
const endHostCall = (io, socket, data) => {
    var _a;
    const userName = getSocketUserName(socket);
    if (!userName) {
        return;
    }
    const userState = getOrCreateUserState(userName);
    const roomName = getRoomName((_a = data.roomName) !== null && _a !== void 0 ? _a : userState.hostedRoom);
    if (!roomName) {
        socket.emit("endCallResponse", {
            success: false,
            reason: "Cannot find the room",
        });
        return;
    }
    closeHostedRoom(io, userName, roomName, true);
};
const removeParticipant = (io, socket, data) => {
    var _a;
    const userName = getSocketUserName(socket);
    if (!userName || !((_a = data.userName) === null || _a === void 0 ? void 0 : _a.trim())) {
        return;
    }
    const memberToRemove = findUserNameKey(data.userName);
    if (!memberToRemove) {
        return;
    }
    const memberState = getOrCreateUserState(memberToRemove);
    if (memberState.joinedRoom !== normalizeUserName(userName)) {
        return;
    }
    leaveJoinedRoom(io, memberToRemove, memberState.joinedRoom, true, "You were removed by the host");
};
const muteParticipant = (io, socket, data) => {
    var _a;
    const userName = getSocketUserName(socket);
    if (!userName || !((_a = data.userName) === null || _a === void 0 ? void 0 : _a.trim())) {
        return;
    }
    const memberToMute = findUserNameKey(data.userName);
    if (!memberToMute) {
        return;
    }
    const memberState = getOrCreateUserState(memberToMute);
    if (!memberState.socketId) {
        return;
    }
    memberState.mediaState = Object.assign(Object.assign({}, memberState.mediaState), { audioEnabled: false });
    io.to(memberState.socketId).emit("setToMute", { by: userName });
    if (memberState.joinedRoom) {
        io.to(memberState.joinedRoom).emit("participantMediaStateChanged", {
            userName: memberToMute,
            mediaState: memberState.mediaState,
        });
    }
};
const updateMediaState = (io, socket, data) => {
    var _a, _b;
    const userName = getSocketUserName(socket);
    if (!userName || !data.mediaState) {
        return;
    }
    const userState = getOrCreateUserState(userName);
    userState.mediaState = Object.assign(Object.assign({}, userState.mediaState), data.mediaState);
    const roomName = getRoomName((_b = (_a = data.roomName) !== null && _a !== void 0 ? _a : userState.joinedRoom) !== null && _b !== void 0 ? _b : userState.hostedRoom);
    if (!roomName) {
        return;
    }
    socket.to(roomName).emit("participantMediaStateChanged", {
        userName,
        mediaState: userState.mediaState,
    });
    emitRoomMembers(io, roomName);
};
const relayOffer = (io, socket, data) => {
    const userName = getSocketUserName(socket);
    if (!userName || !data.targetUserName || !data.sdp) {
        return;
    }
    emitSignalToTarget(io, data.targetUserName, "webrtc:offer", {
        fromUserName: userName,
        sdp: data.sdp,
    });
};
const relayAnswer = (io, socket, data) => {
    const userName = getSocketUserName(socket);
    if (!userName || !data.targetUserName || !data.sdp) {
        return;
    }
    emitSignalToTarget(io, data.targetUserName, "webrtc:answer", {
        fromUserName: userName,
        sdp: data.sdp,
    });
};
const relayIceCandidate = (io, socket, data) => {
    const userName = getSocketUserName(socket);
    if (!userName || !data.targetUserName || !data.candidate) {
        return;
    }
    emitSignalToTarget(io, data.targetUserName, "webrtc:ice-candidate", {
        fromUserName: userName,
        candidate: data.candidate,
    });
};
const handleDisconnect = (io, socket) => {
    const userName = getSocketUserName(socket);
    if (!userName) {
        return;
    }
    const userState = getOrCreateUserState(userName);
    if (userState.hostedRoom) {
        closeHostedRoom(io, userName, userState.hostedRoom, false, "Host disconnected");
    }
    if (userState.joinedRoom) {
        leaveJoinedRoom(io, userName, userState.joinedRoom, false);
    }
    clearTimerForUser(userName);
    userState.socketId = null;
    userState.mediaState = createDefaultMediaState();
};
