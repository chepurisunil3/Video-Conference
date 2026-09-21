import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  Snackbar,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import AddIcCallRoundedIcon from "@mui/icons-material/AddIcCallRounded";
import VideoCallRoundedIcon from "@mui/icons-material/VideoCallRounded";
import MeetingRoomRoundedIcon from "@mui/icons-material/MeetingRoomRounded";
import io from "socket.io-client";
import HostView from "./host-view";
import ParticipantView from "./participant-view";
import { BACKEND_URL } from "../config";

function VideoCall({ userName }) {
  const [socket, setSocket] = useState(null);
  const [roomName, setRoomName] = useState("");
  const [joinRoomName, setJoinRoomName] = useState("");
  const [activeMode, setActiveMode] = useState(null);
  const [joinDialogOpen, setJoinDialogOpen] = useState(false);
  const [joinRequest, setJoinRequest] = useState(null);
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: "",
    severity: "info",
  });

  const showMessage = (message, severity = "info") => {
    setSnackbar({ open: true, message, severity });
  };

  useEffect(() => {
    const nextSocket = io(BACKEND_URL, {
      query: { userName },
      transports: ["websocket", "polling"],
    });
    setSocket(nextSocket);

    return () => {
      nextSocket.disconnect();
    };
  }, [userName]);

  useEffect(() => {
    if (!socket) {
      return undefined;
    }

    const handleHostingResponse = (response) => {
      if (!response.success) {
        showMessage(response.reason || "Unable to host a call.", "warning");
        return;
      }
      setRoomName(response.roomName);
      setActiveMode("host");
    };

    const handleJoiningResponse = (response) => {
      if (!response.success) {
        showMessage(response.reason || "Unable to join the room.", "warning");
        return;
      }
      setRoomName(response.roomName);
      setJoinRoomName(response.roomName);
      setActiveMode("participant");
      setJoinDialogOpen(false);
      setJoinRequest(null);
    };

    const handleDefaultPoll = (response) => {
      if (response.hostedRoom) {
        setRoomName(response.hostedRoom);
        setActiveMode("host");
        return;
      }
      if (response.joinedRoom) {
        setRoomName(response.joinedRoom);
        setJoinRoomName(response.joinedRoom);
        setActiveMode("participant");
      }
    };

    const handleJoinRequest = (response) => {
      setJoinRequest(response);
    };

    const handleInviteResponse = (response) => {
      if (!response.success) {
        showMessage(response.reason || "Unable to send the invite.", "warning");
        return;
      }
      showMessage("Invite sent.");
    };

    socket.on("hostingResponse", handleHostingResponse);
    socket.on("joiningResponse", handleJoiningResponse);
    socket.on("defaultPoll", handleDefaultPoll);
    socket.on("requestToJoin", handleJoinRequest);
    socket.on("requestJoiningResponse", handleInviteResponse);

    return () => {
      socket.off("hostingResponse", handleHostingResponse);
      socket.off("joiningResponse", handleJoiningResponse);
      socket.off("defaultPoll", handleDefaultPoll);
      socket.off("requestToJoin", handleJoinRequest);
      socket.off("requestJoiningResponse", handleInviteResponse);
    };
  }, [socket]);

  const stats = useMemo(
    () => [
      { label: "One-click hosting", value: "Instant rooms" },
      { label: "Live media", value: "Audio + video" },
      { label: "Host control", value: "Mute, remove, timer" },
    ],
    [],
  );

  const hostMeeting = () => {
    socket?.emit("hostCall");
  };

  const joinMeeting = () => {
    if (!joinRoomName.trim()) {
      showMessage("Enter a room code to join.", "warning");
      return;
    }
    socket?.emit("joinCall", { roomToJoin: joinRoomName.trim() });
  };

  const leaveRoomState = (reason) => {
    setActiveMode(null);
    setRoomName("");
    setJoinRoomName("");
    if (reason) {
      showMessage(reason);
    }
  };

  if (socket && activeMode === "host" && roomName) {
    return (
      <HostView
        socket={socket}
        userName={userName}
        roomName={roomName}
        onLeaveRoom={leaveRoomState}
      />
    );
  }

  if (socket && activeMode === "participant" && roomName) {
    return (
      <ParticipantView
        socket={socket}
        userName={userName}
        roomName={roomName}
        onLeaveRoom={leaveRoomState}
      />
    );
  }

  return (
    <>
      <Box className="lobby-shell">
        <Box className="lobby-main-card">
          <Grid container spacing={3} alignItems="stretch">
            <Grid item xs={12} lg={7}>
              <Box className="lobby-hero-panel">
                <Chip
                  label="Modern meeting workspace"
                  className="floating-chip"
                />
                <Typography variant="h2" className="hero-title">
                  Run a polished video conference from your browser.
                </Typography>
                <Typography className="hero-copy">
                  Host a room, invite teammates, and collaborate with live
                  audio, live video, hand raise, meeting timer, mute controls,
                  and a cleaner multi-user layout.
                </Typography>
                <Grid container spacing={2} mt={1}>
                  {stats.map((stat) => (
                    <Grid item xs={12} sm={4} key={stat.label}>
                      <Box className="feature-card">
                        <Typography className="feature-card-title">
                          {stat.label}
                        </Typography>
                        <Typography className="feature-card-copy">
                          {stat.value}
                        </Typography>
                      </Box>
                    </Grid>
                  ))}
                </Grid>
              </Box>
            </Grid>

            <Grid item xs={12} lg={5}>
              <Box className="lobby-actions-panel">
                <Typography className="meeting-kicker">
                  Ready to collaborate
                </Typography>
                <Typography variant="h4" className="meeting-title dark-text">
                  Welcome, {userName}
                </Typography>
                <Typography className="meeting-subtitle dark-subtitle">
                  Create a room for your team or join a live room with the code
                  from a host.
                </Typography>

                <Stack spacing={1.25} mt={4}>
                  <Button
                    variant="contained"
                    className="primary-action-btn"
                    startIcon={<VideoCallRoundedIcon />}
                    onClick={hostMeeting}
                  >
                    Host a new meeting
                  </Button>
                  <Button
                    variant="outlined"
                    className="secondary-action-btn"
                    startIcon={<MeetingRoomRoundedIcon />}
                    onClick={() => setJoinDialogOpen(true)}
                  >
                    Join with room code
                  </Button>
                </Stack>

                <Box className="meeting-info-card">
                  <Stack direction="row" spacing={1.5} alignItems="center">
                    <AddIcCallRoundedIcon className="accent-icon" />
                    <Box>
                      <Typography className="meeting-info-title">
                        Best experience
                      </Typography>
                      <Typography className="meeting-info-copy">
                        Allow camera and microphone access when the browser
                        asks.
                      </Typography>
                    </Box>
                  </Stack>
                </Box>
              </Box>
            </Grid>
          </Grid>
        </Box>
      </Box>

      <Dialog
        open={joinDialogOpen}
        onClose={() => setJoinDialogOpen(false)}
        PaperProps={{ className: "modern-dialog" }}
      >
        <DialogTitle>Join a live room</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Room code"
            fullWidth
            value={joinRoomName}
            onChange={(event) => setJoinRoomName(event.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setJoinDialogOpen(false)}>Cancel</Button>
          <Button className="dialog-primary-btn" onClick={joinMeeting}>
            Join meeting
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={Boolean(joinRequest)}
        onClose={() => setJoinRequest(null)}
        PaperProps={{ className: "modern-dialog" }}
      >
        <DialogTitle>Meeting invitation</DialogTitle>
        <DialogContent>
          <Typography>
            {joinRequest?.requestedBy || joinRequest?.roomName} invited you to
            join room {joinRequest?.roomName}.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setJoinRequest(null)}>Decline</Button>
          <Button
            className="dialog-primary-btn"
            onClick={() => {
              setJoinRoomName(joinRequest?.roomName || "");
              setJoinRequest(null);
              socket?.emit("joinCall", {
                roomToJoin: joinRequest?.roomName || "",
              });
            }}
          >
            Accept
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
          severity={snackbar.severity}
          variant="filled"
          onClose={() =>
            setSnackbar((currentSnackbar) => ({
              ...currentSnackbar,
              open: false,
            }))
          }
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </>
  );
}

export default VideoCall;
