import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Avatar,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Snackbar,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import ContentCopyRoundedIcon from "@mui/icons-material/ContentCopyRounded";
import MicRoundedIcon from "@mui/icons-material/MicRounded";
import MicOffRoundedIcon from "@mui/icons-material/MicOffRounded";
import VideocamRoundedIcon from "@mui/icons-material/VideocamRounded";
import VideocamOffRoundedIcon from "@mui/icons-material/VideocamOffRounded";
import CallEndRoundedIcon from "@mui/icons-material/CallEndRounded";
import PersonAddAlt1RoundedIcon from "@mui/icons-material/PersonAddAlt1Rounded";
import PersonRemoveRoundedIcon from "@mui/icons-material/PersonRemoveRounded";
import VolumeOffRoundedIcon from "@mui/icons-material/VolumeOffRounded";
import PanToolAltRoundedIcon from "@mui/icons-material/PanToolAltRounded";
import AccessTimeRoundedIcon from "@mui/icons-material/AccessTimeRounded";
import GroupsRoundedIcon from "@mui/icons-material/GroupsRounded";

/* eslint-disable react-hooks/exhaustive-deps */

const rtcConfiguration = {
  iceServers: [
    { urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] },
  ],
};

const defaultMediaState = {
  audioEnabled: true,
  videoEnabled: true,
  handRaised: false,
};

const playAlarmTone = () => {
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    const audioContext = new AudioContextClass();
    const now = audioContext.currentTime;

    [0, 0.3, 0.6].forEach((startOffset) => {
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      oscillator.type = "sine";
      oscillator.frequency.value = 880;
      gainNode.gain.setValueAtTime(0.0001, now + startOffset);
      gainNode.gain.exponentialRampToValueAtTime(0.3, now + startOffset + 0.02);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, now + startOffset + 0.2);
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      oscillator.start(now + startOffset);
      oscillator.stop(now + startOffset + 0.25);
    });

    setTimeout(() => audioContext.close(), 1200);
  } catch (error) {
    console.error("Failed to play alarm tone", error);
  }
};

function ParticipantTile({
  participant,
  isLocal = false,
  showManageActions = false,
  onMute,
  onRemove,
}) {
  const videoRef = useRef(null);

  useEffect(() => {
    if (videoRef.current && participant.stream) {
      videoRef.current.srcObject = participant.stream;
    }
  }, [participant.stream]);

  const initials = (participant.userName || "?").slice(0, 2).toUpperCase();
  const videoVisible =
    participant.mediaState?.videoEnabled && participant.stream;

  return (
    <Box className={`participant-tile${isLocal ? " local-tile" : ""}`}>
      <Box className="participant-overlay">
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
          <Chip
            label={
              isLocal ? `${participant.userName} (You)` : participant.userName
            }
            size="small"
            className="participant-chip"
          />
          {participant.isHost && (
            <Chip
              label="Host"
              size="small"
              className="participant-chip muted"
            />
          )}
          {participant.mediaState?.handRaised && (
            <Chip
              label="Hand raised"
              size="small"
              className="participant-chip attention"
            />
          )}
          {!participant.mediaState?.audioEnabled && (
            <Chip
              label="Muted"
              size="small"
              className="participant-chip muted"
            />
          )}
        </Stack>
        {showManageActions && (
          <Stack direction="row" spacing={1}>
            <Tooltip title="Mute participant">
              <IconButton
                size="small"
                className="tile-action-btn"
                onClick={onMute}
              >
                <VolumeOffRoundedIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Remove participant">
              <IconButton
                size="small"
                className="tile-action-btn danger"
                onClick={onRemove}
              >
                <PersonRemoveRoundedIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Stack>
        )}
      </Box>
      {videoVisible ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isLocal}
          className="participant-video"
        />
      ) : (
        <Box className="participant-placeholder">
          <Avatar className="participant-avatar">{initials}</Avatar>
          <Typography variant="body2" color="rgba(255,255,255,0.8)">
            {participant.mediaState?.videoEnabled
              ? "Waiting for video"
              : "Camera is off"}
          </Typography>
        </Box>
      )}
    </Box>
  );
}

function ConferenceRoom({ socket, userName, roomName, mode, onLeaveRoom }) {
  const localStreamRef = useRef(null);
  const localMediaRef = useRef(defaultMediaState);
  const peerConnectionsRef = useRef({});
  const pendingCandidatesRef = useRef({});
  const pendingOffersRef = useRef([]);
  const pendingOffersToCreateRef = useRef(new Set());
  const [localStream, setLocalStream] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [localMediaState, setLocalMediaState] = useState(defaultMediaState);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteUserName, setInviteUserName] = useState("");
  const [timer, setTimer] = useState(-1);
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: "",
    severity: "info",
  });

  const showMessage = (message, severity = "info") => {
    setSnackbar({ open: true, message, severity });
  };

  const setParticipant = (nextParticipant) => {
    setParticipants((currentParticipants) => {
      const existingIndex = currentParticipants.findIndex(
        (participant) => participant.userName === nextParticipant.userName,
      );
      if (existingIndex === -1) {
        return [
          ...currentParticipants,
          {
            mediaState: defaultMediaState,
            isHost: false,
            stream: null,
            ...nextParticipant,
          },
        ];
      }

      const updatedParticipants = [...currentParticipants];
      updatedParticipants[existingIndex] = {
        ...updatedParticipants[existingIndex],
        ...nextParticipant,
        mediaState: {
          ...updatedParticipants[existingIndex].mediaState,
          ...(nextParticipant.mediaState || {}),
        },
      };
      return updatedParticipants;
    });
  };

  const removeParticipant = (participantUserName) => {
    setParticipants((currentParticipants) =>
      currentParticipants.filter(
        (participant) => participant.userName !== participantUserName,
      ),
    );
  };

  const syncParticipants = (nextParticipants) => {
    setParticipants((currentParticipants) => {
      const currentMap = new Map(
        currentParticipants.map((participant) => [
          participant.userName,
          participant,
        ]),
      );
      return nextParticipants.map((participant) => {
        const currentParticipant = currentMap.get(participant.userName) || {};
        return {
          ...currentParticipant,
          ...participant,
          stream: currentParticipant.stream || null,
          mediaState: {
            ...defaultMediaState,
            ...(currentParticipant.mediaState || {}),
            ...(participant.mediaState || {}),
          },
        };
      });
    });
  };

  const closePeerConnection = (targetUserName) => {
    const existingConnection = peerConnectionsRef.current[targetUserName];
    if (existingConnection) {
      existingConnection.ontrack = null;
      existingConnection.onicecandidate = null;
      existingConnection.onconnectionstatechange = null;
      existingConnection.close();
      delete peerConnectionsRef.current[targetUserName];
    }
    delete pendingCandidatesRef.current[targetUserName];
  };

  const flushPendingCandidates = async (targetUserName, connection) => {
    const queuedCandidates = pendingCandidatesRef.current[targetUserName] || [];
    for (const candidate of queuedCandidates) {
      try {
        await connection.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (error) {
        console.error("Failed to add queued ICE candidate", error);
      }
    }
    pendingCandidatesRef.current[targetUserName] = [];
  };

  const createPeerConnection = (targetUserName) => {
    if (peerConnectionsRef.current[targetUserName]) {
      return peerConnectionsRef.current[targetUserName];
    }

    const connection = new RTCPeerConnection(rtcConfiguration);
    peerConnectionsRef.current[targetUserName] = connection;

    const localStream = localStreamRef.current;
    if (localStream) {
      localStream.getTracks().forEach((track) => {
        connection.addTrack(track, localStream);
      });
    }

    connection.onicecandidate = (event) => {
      if (!event.candidate) {
        return;
      }
      socket.emit("webrtc:ice-candidate", {
        targetUserName,
        candidate: event.candidate.toJSON(),
      });
    };

    connection.ontrack = (event) => {
      setParticipant({
        userName: targetUserName,
        stream: event.streams[0],
      });
    };

    connection.onconnectionstatechange = () => {
      if (["failed", "closed"].includes(connection.connectionState)) {
        closePeerConnection(targetUserName);
      }
    };

    return connection;
  };

  const emitLocalMediaState = (nextMediaState) => {
    localMediaRef.current = nextMediaState;
    setLocalMediaState(nextMediaState);
    socket.emit("mediaStateChanged", {
      roomName,
      mediaState: nextMediaState,
    });
  };

  const flushPendingOffersToCreate = async () => {
    const usersToCall = Array.from(pendingOffersToCreateRef.current);
    pendingOffersToCreateRef.current.clear();
    for (const targetUserName of usersToCall) {
      try {
        const connection = createPeerConnection(targetUserName);
        if (connection.signalingState !== "stable") {
          continue;
        }
        const offer = await connection.createOffer({
          offerToReceiveAudio: true,
          offerToReceiveVideo: true,
        });
        await connection.setLocalDescription(offer);
        socket.emit("webrtc:offer", {
          targetUserName,
          sdp: offer,
        });
      } catch (error) {
        console.error("Failed to create offer", error);
      }
    }
  };

  const flushPendingOffers = async () => {
    const offers = [...pendingOffersRef.current];
    pendingOffersRef.current = [];
    for (const offer of offers) {
      const { fromUserName, sdp } = offer;
      if (!fromUserName || !sdp) {
        continue;
      }
      try {
        const connection = createPeerConnection(fromUserName);
        if (connection.signalingState === "have-local-offer") {
          await connection.setLocalDescription({ type: "rollback" });
        }
        await connection.setRemoteDescription(new RTCSessionDescription(sdp));
        await flushPendingCandidates(fromUserName, connection);
        const answer = await connection.createAnswer();
        await connection.setLocalDescription(answer);
        socket.emit("webrtc:answer", {
          targetUserName: fromUserName,
          sdp: answer,
        });
      } catch (error) {
        console.error("Failed to answer offer", error);
      }
    }
  };

  const initialiseLocalMedia = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      localStreamRef.current = stream;
      setLocalStream(stream);
      emitLocalMediaState(localMediaRef.current);
      await flushPendingOffers();
      await flushPendingOffersToCreate();
    } catch (error) {
      console.error(error);
      showMessage(
        "Camera or microphone access was denied. You can still join, but media streaming will stay disabled.",
        "warning",
      );
      emitLocalMediaState({
        ...localMediaRef.current,
        audioEnabled: false,
        videoEnabled: false,
      });
    }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    initialiseLocalMedia();

    return () => {
      Object.keys(peerConnectionsRef.current).forEach((targetUserName) => {
        closePeerConnection(targetUserName);
      });
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => track.stop());
        localStreamRef.current = null;
      }
      setLocalStream(null);
    };
  }, []);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const handleMembersDetails = (payload) => {
      if (!payload.success) {
        if (payload.reason) {
          showMessage(payload.reason, "warning");
        }
        return;
      }

      syncParticipants(payload.data || []);
      if (mode === "host") {
        (payload.data || []).forEach((participant) => {
          if (participant.userName !== userName) {
            pendingOffersToCreateRef.current.add(participant.userName);
          }
        });
        flushPendingOffersToCreate();
      }
    };

    const handleUserJoined = (payload) => {
      if (!payload.userName) {
        return;
      }
      setParticipant({
        userName: payload.userName,
        isHost: Boolean(payload.isHost),
        mediaState: payload.mediaState || defaultMediaState,
      });
      pendingOffersToCreateRef.current.add(payload.userName);
      flushPendingOffersToCreate();
    };

    const handleUserLeft = (payload) => {
      if (!payload.userName) {
        return;
      }
      closePeerConnection(payload.userName);
      removeParticipant(payload.userName);
    };

    const handleOffer = async (payload) => {
      if (!payload.fromUserName || !payload.sdp) {
        return;
      }
      setParticipant({ userName: payload.fromUserName });
      if (!localStreamRef.current) {
        pendingOffersRef.current.push(payload);
        return;
      }
      pendingOffersRef.current.push(payload);
      await flushPendingOffers();
    };

    const handleAnswer = async (payload) => {
      if (!payload.fromUserName || !payload.sdp) {
        return;
      }
      try {
        const connection = createPeerConnection(payload.fromUserName);
        await connection.setRemoteDescription(
          new RTCSessionDescription(payload.sdp),
        );
        await flushPendingCandidates(payload.fromUserName, connection);
      } catch (error) {
        console.error("Failed to handle answer", error);
      }
    };

    const handleIceCandidate = async (payload) => {
      if (!payload.fromUserName || !payload.candidate) {
        return;
      }
      const connection = peerConnectionsRef.current[payload.fromUserName];
      if (!connection || !connection.remoteDescription) {
        const queuedCandidates =
          pendingCandidatesRef.current[payload.fromUserName] || [];
        queuedCandidates.push(payload.candidate);
        pendingCandidatesRef.current[payload.fromUserName] = queuedCandidates;
        return;
      }
      try {
        await connection.addIceCandidate(
          new RTCIceCandidate(payload.candidate),
        );
      } catch (error) {
        console.error("Failed to add ICE candidate", error);
      }
    };

    const handleParticipantMediaStateChanged = (payload) => {
      if (!payload.userName) {
        return;
      }
      setParticipant({
        userName: payload.userName,
        mediaState: payload.mediaState || defaultMediaState,
      });
    };

    const handleSetToMute = () => {
      if (localStreamRef.current) {
        localStreamRef.current.getAudioTracks().forEach((track) => {
          track.enabled = false;
        });
      }
      const nextState = {
        ...localMediaRef.current,
        audioEnabled: false,
      };
      emitLocalMediaState(nextState);
      showMessage("The host muted your microphone.", "warning");
    };

    const handleStartedTimer = (payload) => {
      setTimer(typeof payload.count === "number" ? payload.count : 0);
    };

    const handleTimerUpdate = (payload) => {
      if (typeof payload.count === "number") {
        setTimer(payload.count);
      }
    };

    const handleTimerStopped = () => {
      playAlarmTone();
      setTimer(-1);
    };

    const handleEndCallResponse = (payload) => {
      if (!payload.success) {
        return;
      }
      showMessage(
        payload.reason ||
          (mode === "host" ? "Meeting ended" : "You left the meeting"),
      );
      onLeaveRoom(payload.reason || null);
    };

    const handleInviteResponse = (payload) => {
      if (!payload.success) {
        showMessage(payload.reason || "Unable to send the invite.", "warning");
        return;
      }
      showMessage("Invite sent.");
    };

    socket.on("membersDetails", handleMembersDetails);
    socket.on("userJoined", handleUserJoined);
    socket.on("userLeft", handleUserLeft);
    socket.on("webrtc:offer", handleOffer);
    socket.on("webrtc:answer", handleAnswer);
    socket.on("webrtc:ice-candidate", handleIceCandidate);
    socket.on(
      "participantMediaStateChanged",
      handleParticipantMediaStateChanged,
    );
    socket.on("setToMute", handleSetToMute);
    socket.on("startedTimer", handleStartedTimer);
    socket.on("timerUpdate", handleTimerUpdate);
    socket.on("timerStopped", handleTimerStopped);
    socket.on("endCallResponse", handleEndCallResponse);
    socket.on("requestJoiningResponse", handleInviteResponse);
    socket.emit("membersDetails", { roomName });

    return () => {
      socket.off("membersDetails", handleMembersDetails);
      socket.off("userJoined", handleUserJoined);
      socket.off("userLeft", handleUserLeft);
      socket.off("webrtc:offer", handleOffer);
      socket.off("webrtc:answer", handleAnswer);
      socket.off("webrtc:ice-candidate", handleIceCandidate);
      socket.off(
        "participantMediaStateChanged",
        handleParticipantMediaStateChanged,
      );
      socket.off("setToMute", handleSetToMute);
      socket.off("startedTimer", handleStartedTimer);
      socket.off("timerUpdate", handleTimerUpdate);
      socket.off("timerStopped", handleTimerStopped);
      socket.off("endCallResponse", handleEndCallResponse);
      socket.off("requestJoiningResponse", handleInviteResponse);
    };
  }, [mode, onLeaveRoom, roomName, socket, userName]);

  const toggleMediaTrack = (trackType) => {
    const stream = localStreamRef.current;
    const currentState = localMediaRef.current;
    const isAudioTrack = trackType === "audioEnabled";
    const nextValue = !currentState[trackType];

    if (stream) {
      const tracks = isAudioTrack
        ? stream.getAudioTracks()
        : stream.getVideoTracks();
      tracks.forEach((track) => {
        track.enabled = nextValue;
      });
    }

    emitLocalMediaState({
      ...currentState,
      [trackType]: nextValue,
    });
  };

  const toggleHandRaise = () => {
    emitLocalMediaState({
      ...localMediaRef.current,
      handRaised: !localMediaRef.current.handRaised,
    });
  };

  const handleInviteUser = () => {
    if (!inviteUserName.trim()) {
      showMessage("Enter a participant name to send an invite.", "warning");
      return;
    }
    socket.emit("requestToJoin", { userName: inviteUserName.trim() });
    setInviteUserName("");
    setInviteOpen(false);
  };

  const startTimer = (seconds) => {
    socket.emit("setTimer", { seconds });
  };

  const handleLeaveMeeting = () => {
    if (mode === "host") {
      socket.emit("endHostCall", { roomName });
      return;
    }
    socket.emit("endParticipantCall", { roomName });
  };

  const copyRoomName = async () => {
    try {
      await navigator.clipboard.writeText(roomName);
      showMessage("Room code copied.");
    } catch (error) {
      showMessage("Unable to copy room code.", "warning");
    }
  };

  const participantCount = participants.length + 1;
  const orderedParticipants = useMemo(() => {
    const nextParticipants = [...participants];
    nextParticipants.sort((firstParticipant, secondParticipant) => {
      if (firstParticipant.isHost) {
        return -1;
      }
      if (secondParticipant.isHost) {
        return 1;
      }
      return firstParticipant.userName.localeCompare(
        secondParticipant.userName,
      );
    });
    return nextParticipants;
  }, [participants]);

  return (
    <>
      <Box className="meeting-shell">
        <Box className="meeting-main-panel">
          <Box className="meeting-header-row">
            <Box>
              <Typography className="meeting-kicker">
                {mode === "host" ? "Live room control" : "Connected meeting"}
              </Typography>
              <Typography variant="h4" className="meeting-title">
                {mode === "host"
                  ? "You are hosting the conference"
                  : "You are in the conference"}
              </Typography>
              <Typography className="meeting-subtitle">
                Room {roomName} • real-time audio, video, hand raise, meeting
                timer, invites and host controls.
              </Typography>
            </Box>
            <Stack direction={{ xs: "column", md: "row" }} spacing={1.5}>
              <Button
                className="ghost-chip-btn"
                startIcon={<GroupsRoundedIcon />}
              >
                {participantCount} online
              </Button>
              <Button
                className="ghost-chip-btn"
                startIcon={<AccessTimeRoundedIcon />}
              >
                {timer >= 0 ? `Timer ${timer}s` : "No timer"}
              </Button>
            </Stack>
          </Box>

          <Box className="meeting-grid">
            <Box className="stage-section">
              <Box className="video-grid">
                <ParticipantTile
                  participant={{
                    userName,
                    stream: localStream,
                    isHost: mode === "host",
                    mediaState: localMediaState,
                  }}
                  isLocal
                />
                {orderedParticipants.map((participant) => (
                  <ParticipantTile
                    key={participant.userName}
                    participant={participant}
                    showManageActions={mode === "host" && !participant.isHost}
                    onMute={() =>
                      socket.emit("muteParticipant", {
                        userName: participant.userName,
                      })
                    }
                    onRemove={() =>
                      socket.emit("removeParticipant", {
                        userName: participant.userName,
                      })
                    }
                  />
                ))}
              </Box>

              <Box className="meeting-controls-bar">
                <Tooltip
                  title={
                    localMediaState.audioEnabled
                      ? "Mute microphone"
                      : "Unmute microphone"
                  }
                >
                  <IconButton
                    className={`control-button ${!localMediaState.audioEnabled ? "muted" : ""}`}
                    onClick={() => toggleMediaTrack("audioEnabled")}
                  >
                    {localMediaState.audioEnabled ? (
                      <MicRoundedIcon />
                    ) : (
                      <MicOffRoundedIcon />
                    )}
                  </IconButton>
                </Tooltip>
                <Tooltip
                  title={
                    localMediaState.videoEnabled
                      ? "Turn camera off"
                      : "Turn camera on"
                  }
                >
                  <IconButton
                    className={`control-button ${!localMediaState.videoEnabled ? "muted" : ""}`}
                    onClick={() => toggleMediaTrack("videoEnabled")}
                  >
                    {localMediaState.videoEnabled ? (
                      <VideocamRoundedIcon />
                    ) : (
                      <VideocamOffRoundedIcon />
                    )}
                  </IconButton>
                </Tooltip>
                <Tooltip
                  title={
                    localMediaState.handRaised ? "Lower hand" : "Raise hand"
                  }
                >
                  <IconButton
                    className={`control-button ${localMediaState.handRaised ? "active" : ""}`}
                    onClick={toggleHandRaise}
                  >
                    <PanToolAltRoundedIcon />
                  </IconButton>
                </Tooltip>
                <Tooltip
                  title={
                    mode === "host"
                      ? "End meeting for everyone"
                      : "Leave meeting"
                  }
                >
                  <IconButton
                    className="control-button end-call"
                    onClick={handleLeaveMeeting}
                  >
                    <CallEndRoundedIcon />
                  </IconButton>
                </Tooltip>
              </Box>
            </Box>

            <Box className="meeting-side-panel">
              <Stack spacing={2.5}>
                <Box className="side-card gradient-card">
                  <Typography className="side-card-label">
                    Meeting code
                  </Typography>
                  <Stack
                    direction="row"
                    spacing={1}
                    alignItems="center"
                    justifyContent="space-between"
                  >
                    <Typography variant="h6" className="room-code-text">
                      {roomName}
                    </Typography>
                    <IconButton className="copy-btn" onClick={copyRoomName}>
                      <ContentCopyRoundedIcon fontSize="small" />
                    </IconButton>
                  </Stack>
                  <Typography className="side-card-copy">
                    Share the room code or invite a teammate directly.
                  </Typography>
                </Box>

                <Box className="side-card">
                  <Typography className="side-card-title">
                    Participants
                  </Typography>
                  <Divider className="soft-divider" />
                  <List className="participant-list">
                    <ListItem disableGutters>
                      <ListItemAvatar>
                        <Avatar className="list-avatar">
                          {userName.slice(0, 2).toUpperCase()}
                        </Avatar>
                      </ListItemAvatar>
                      <ListItemText
                        primary={`${userName} (You)`}
                        secondary={
                          mode === "host" ? "Hosting this room" : "Participant"
                        }
                      />
                    </ListItem>
                    {orderedParticipants.map((participant) => (
                      <ListItem key={participant.userName} disableGutters>
                        <ListItemAvatar>
                          <Avatar className="list-avatar">
                            {participant.userName.slice(0, 2).toUpperCase()}
                          </Avatar>
                        </ListItemAvatar>
                        <ListItemText
                          primary={participant.userName}
                          secondary={
                            participant.isHost
                              ? "Host"
                              : !participant.mediaState.audioEnabled
                                ? "Muted"
                                : participant.mediaState.handRaised
                                  ? "Hand raised"
                                  : "Connected"
                          }
                        />
                      </ListItem>
                    ))}
                  </List>
                </Box>

                {mode === "host" && (
                  <Box className="side-card">
                    <Typography className="side-card-title">
                      Host tools
                    </Typography>
                    <Stack spacing={1.25} mt={2}>
                      <Button
                        variant="contained"
                        className="primary-action-btn"
                        startIcon={<PersonAddAlt1RoundedIcon />}
                        onClick={() => setInviteOpen(true)}
                      >
                        Invite participant
                      </Button>
                      <Stack direction="row" spacing={1}>
                        <Button
                          className="timer-btn"
                          onClick={() => startTimer(15)}
                        >
                          15s
                        </Button>
                        <Button
                          className="timer-btn"
                          onClick={() => startTimer(30)}
                        >
                          30s
                        </Button>
                        <Button
                          className="timer-btn"
                          onClick={() => startTimer(45)}
                        >
                          45s
                        </Button>
                      </Stack>
                    </Stack>
                  </Box>
                )}
              </Stack>
            </Box>
          </Box>
        </Box>
      </Box>

      <Dialog
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        PaperProps={{ className: "modern-dialog" }}
      >
        <DialogTitle>Invite someone to join</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            margin="dense"
            label="Participant name"
            value={inviteUserName}
            onChange={(event) => setInviteUserName(event.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setInviteOpen(false)}>Cancel</Button>
          <Button className="dialog-primary-btn" onClick={handleInviteUser}>
            Send invite
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={3200}
        onClose={() =>
          setSnackbar((currentSnackbar) => ({
            ...currentSnackbar,
            open: false,
          }))
        }
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert
          onClose={() =>
            setSnackbar((currentSnackbar) => ({
              ...currentSnackbar,
              open: false,
            }))
          }
          severity={snackbar.severity}
          variant="filled"
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </>
  );
}

export default ConferenceRoom;
