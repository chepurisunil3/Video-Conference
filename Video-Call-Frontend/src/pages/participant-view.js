import React from "react";
import ConferenceRoom from "./conference-room";

function ParticipantView({ socket, userName, roomName, onLeaveRoom }) {
  return (
    <ConferenceRoom
      socket={socket}
      userName={userName}
      roomName={roomName}
      mode="participant"
      onLeaveRoom={onLeaveRoom}
    />
  );
}

export default ParticipantView;
