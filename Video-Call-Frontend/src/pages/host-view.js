import React from "react";
import ConferenceRoom from "./conference-room";

function HostView({ socket, userName, roomName, onLeaveRoom }) {
  return (
    <ConferenceRoom
      socket={socket}
      userName={userName}
      roomName={roomName}
      mode="host"
      onLeaveRoom={onLeaveRoom}
    />
  );
}

export default HostView;
