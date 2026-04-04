import { Server, Socket } from "socket.io";

interface MediaState {
  audioEnabled: boolean;
  videoEnabled: boolean;
  handRaised: boolean;
}

interface UserCallData {
  socketId: string | null;
  joinedRoom: string | null;
  hostedRoom: string | null;
  isTimerRunning: boolean;
  timerCount: number;
  mediaState: MediaState;
  timerHandle: NodeJS.Timeout | null;
}

interface UserSummary {
  userName: string;
  isHost: boolean;
  mediaState: MediaState;
}

interface UsersMap {
  [key: string]: UserCallData;
}

interface SignalPayload {
  targetUserName?: string;
  sdp?: Record<string, unknown>;
  candidate?: Record<string, unknown>;
}

const listOfUsers: UsersMap = {};

const createDefaultMediaState = (): MediaState => ({
  audioEnabled: true,
  videoEnabled: true,
  handRaised: false,
});

const createDefaultUserState = (): UserCallData => ({
  socketId: null,
  joinedRoom: null,
  hostedRoom: null,
  isTimerRunning: false,
  timerCount: 0,
  mediaState: createDefaultMediaState(),
  timerHandle: null,
});

const normalizeUserName = (userName: string) => userName.trim().toLowerCase();

const findUserNameKey = (userName: string): string | null => {
  const normalized = normalizeUserName(userName);
  for (const currentUserName of Object.keys(listOfUsers)) {
    if (normalizeUserName(currentUserName) === normalized) {
      return currentUserName;
    }
  }
  return null;
};

const getOrCreateUserState = (userName: string): UserCallData => {
  const existingKey = findUserNameKey(userName);
  const keyToUse = existingKey ?? userName.trim();
  if (!listOfUsers[keyToUse]) {
    listOfUsers[keyToUse] = createDefaultUserState();
  }
  return listOfUsers[keyToUse];
};

const getSocketUserName = (socket: Socket): string | null => {
  const userNameFromQuery = socket.handshake.query?.userName;
  if (typeof userNameFromQuery === "string" && userNameFromQuery.trim()) {
    return userNameFromQuery.trim();
  }
  if (Array.isArray(userNameFromQuery) && userNameFromQuery[0]?.trim()) {
    return userNameFromQuery[0].trim();
  }
  return null;
};

const getRoomName = (roomName?: string | null) =>
  roomName?.trim().toLowerCase() ?? "";

const clearTimerForUser = (userName: string) => {
  const userState = getOrCreateUserState(userName);
  if (userState.timerHandle) {
    clearInterval(userState.timerHandle);
    userState.timerHandle = null;
  }
  userState.isTimerRunning = false;
  userState.timerCount = 0;
};

const getRoomMembers = (
  io: Server,
  roomName: string,
  requestingUserName?: string,
): UserSummary[] => {
  const room = io.sockets.adapter.rooms.get(roomName);
  if (!room) {
    return [];
  }

  const members: UserSummary[] = [];
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

const emitRoomMembers = (io: Server, roomName: string) => {
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

const emitSignalToTarget = (
  io: Server,
  targetUserName: string,
  eventName: string,
  payload: Record<string, unknown>,
) => {
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

const leaveJoinedRoom = (
  io: Server,
  userName: string,
  roomName: string,
  shouldNotifyCurrentSocket: boolean,
  reason?: string,
) => {
  const normalizedRoomName = getRoomName(roomName);
  if (!normalizedRoomName) {
    return;
  }

  const userState = getOrCreateUserState(userName);
  const socketId = userState.socketId;
  const currentSocket = socketId ? io.sockets.sockets.get(socketId) : undefined;

  userState.joinedRoom = null;
  if (currentSocket?.rooms.has(normalizedRoomName)) {
    currentSocket.leave(normalizedRoomName);
  }

  io.to(normalizedRoomName).emit("userLeft", { userName });
  emitRoomMembers(io, normalizedRoomName);

  if (shouldNotifyCurrentSocket && currentSocket) {
    currentSocket.emit("endCallResponse", {
      success: true,
      reason: reason ?? null,
    });
  }
};

const closeHostedRoom = (
  io: Server,
  userName: string,
  roomName: string,
  shouldNotifyCurrentSocket: boolean,
  reason = "Host ended the call",
) => {
  const normalizedRoomName = getRoomName(roomName);
  if (!normalizedRoomName) {
    return;
  }

  const roomMembers = Array.from(
    io.sockets.adapter.rooms.get(normalizedRoomName) ?? [],
  );
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

export const newSocketConnection = (io: Server, socket: Socket) => {
  const userName = getSocketUserName(socket);
  if (!userName) {
    socket.disconnect(true);
    return;
  }

  sendDefaultPollData(socket);

  socket.on("setTimer", (data: { seconds?: number }) =>
    startTimer(io, socket, data),
  );
  socket.on("hostCall", () => hostNewCall(io, socket));
  socket.on("joinCall", (data: { roomToJoin?: string }) =>
    joinExistingCall(io, socket, data),
  );
  socket.on("membersDetails", (data: { roomName?: string }) =>
    sendExistingCallUsers(io, socket, data),
  );
  socket.on("requestToJoin", (data: { userName?: string }) =>
    requestToJoin(io, socket, data),
  );
  socket.on("endParticipantCall", (data: { roomName?: string }) =>
    endParticipantCall(io, socket, data),
  );
  socket.on("endHostCall", (data: { roomName?: string }) =>
    endHostCall(io, socket, data),
  );
  socket.on("removeParticipant", (data: { userName?: string }) =>
    removeParticipant(io, socket, data),
  );
  socket.on("muteParticipant", (data: { userName?: string }) =>
    muteParticipant(io, socket, data),
  );
  socket.on(
    "mediaStateChanged",
    (data: { roomName?: string; mediaState?: Partial<MediaState> }) =>
      updateMediaState(io, socket, data),
  );
  socket.on("webrtc:offer", (data: SignalPayload) =>
    relayOffer(io, socket, data),
  );
  socket.on("webrtc:answer", (data: SignalPayload) =>
    relayAnswer(io, socket, data),
  );
  socket.on("webrtc:ice-candidate", (data: SignalPayload) =>
    relayIceCandidate(io, socket, data),
  );
  socket.on("disconnect", () => handleDisconnect(io, socket));
};

export const checkIfUserExists = (userName: string) => {
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

const sendDefaultPollData = (socket: Socket) => {
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

const startTimer = (io: Server, socket: Socket, data: { seconds?: number }) => {
  const userName = getSocketUserName(socket);
  if (!userName) {
    return;
  }

  const userState = getOrCreateUserState(userName);
  const roomName = userState.hostedRoom ?? getRoomName(userState.joinedRoom);
  const seconds = Math.max(0, Number(data.seconds ?? 0));

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

const hostNewCall = (io: Server, socket: Socket) => {
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

const joinExistingCall = (
  io: Server,
  socket: Socket,
  data: { roomToJoin?: string },
) => {
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

const requestToJoin = (
  io: Server,
  socket: Socket,
  data: { userName?: string },
) => {
  const userName = getSocketUserName(socket);
  if (!userName) {
    socket.emit("requestJoiningResponse", {
      success: false,
      reason: "Authentication failed",
    });
    return;
  }

  if (!data.userName?.trim()) {
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

const sendExistingCallUsers = (
  io: Server,
  socket: Socket,
  data: { roomName?: string },
) => {
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

const endParticipantCall = (
  io: Server,
  socket: Socket,
  data: { roomName?: string },
) => {
  const userName = getSocketUserName(socket);
  if (!userName) {
    return;
  }

  const userState = getOrCreateUserState(userName);
  const roomName = getRoomName(data.roomName ?? userState.joinedRoom);
  if (!roomName) {
    socket.emit("endCallResponse", {
      success: false,
      reason: "Cannot find the room",
    });
    return;
  }

  leaveJoinedRoom(io, userName, roomName, true);
};

const endHostCall = (
  io: Server,
  socket: Socket,
  data: { roomName?: string },
) => {
  const userName = getSocketUserName(socket);
  if (!userName) {
    return;
  }

  const userState = getOrCreateUserState(userName);
  const roomName = getRoomName(data.roomName ?? userState.hostedRoom);
  if (!roomName) {
    socket.emit("endCallResponse", {
      success: false,
      reason: "Cannot find the room",
    });
    return;
  }

  closeHostedRoom(io, userName, roomName, true);
};

const removeParticipant = (
  io: Server,
  socket: Socket,
  data: { userName?: string },
) => {
  const userName = getSocketUserName(socket);
  if (!userName || !data.userName?.trim()) {
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

  leaveJoinedRoom(
    io,
    memberToRemove,
    memberState.joinedRoom,
    true,
    "You were removed by the host",
  );
};

const muteParticipant = (
  io: Server,
  socket: Socket,
  data: { userName?: string },
) => {
  const userName = getSocketUserName(socket);
  if (!userName || !data.userName?.trim()) {
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

  memberState.mediaState = {
    ...memberState.mediaState,
    audioEnabled: false,
  };

  io.to(memberState.socketId).emit("setToMute", { by: userName });
  if (memberState.joinedRoom) {
    io.to(memberState.joinedRoom).emit("participantMediaStateChanged", {
      userName: memberToMute,
      mediaState: memberState.mediaState,
    });
  }
};

const updateMediaState = (
  io: Server,
  socket: Socket,
  data: { roomName?: string; mediaState?: Partial<MediaState> },
) => {
  const userName = getSocketUserName(socket);
  if (!userName || !data.mediaState) {
    return;
  }

  const userState = getOrCreateUserState(userName);
  userState.mediaState = {
    ...userState.mediaState,
    ...data.mediaState,
  };

  const roomName = getRoomName(
    data.roomName ?? userState.joinedRoom ?? userState.hostedRoom,
  );
  if (!roomName) {
    return;
  }

  socket.to(roomName).emit("participantMediaStateChanged", {
    userName,
    mediaState: userState.mediaState,
  });
  emitRoomMembers(io, roomName);
};

const relayOffer = (io: Server, socket: Socket, data: SignalPayload) => {
  const userName = getSocketUserName(socket);
  if (!userName || !data.targetUserName || !data.sdp) {
    return;
  }

  emitSignalToTarget(io, data.targetUserName, "webrtc:offer", {
    fromUserName: userName,
    sdp: data.sdp,
  });
};

const relayAnswer = (io: Server, socket: Socket, data: SignalPayload) => {
  const userName = getSocketUserName(socket);
  if (!userName || !data.targetUserName || !data.sdp) {
    return;
  }

  emitSignalToTarget(io, data.targetUserName, "webrtc:answer", {
    fromUserName: userName,
    sdp: data.sdp,
  });
};

const relayIceCandidate = (io: Server, socket: Socket, data: SignalPayload) => {
  const userName = getSocketUserName(socket);
  if (!userName || !data.targetUserName || !data.candidate) {
    return;
  }

  emitSignalToTarget(io, data.targetUserName, "webrtc:ice-candidate", {
    fromUserName: userName,
    candidate: data.candidate,
  });
};

const handleDisconnect = (io: Server, socket: Socket) => {
  const userName = getSocketUserName(socket);
  if (!userName) {
    return;
  }

  const userState = getOrCreateUserState(userName);
  if (userState.hostedRoom) {
    closeHostedRoom(
      io,
      userName,
      userState.hostedRoom,
      false,
      "Host disconnected",
    );
  }
  if (userState.joinedRoom) {
    leaveJoinedRoom(io, userName, userState.joinedRoom, false);
  }

  clearTimerForUser(userName);
  userState.socketId = null;
  userState.mediaState = createDefaultMediaState();
};
