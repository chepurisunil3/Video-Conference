import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  Snackbar,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import LogoutRoundedIcon from "@mui/icons-material/LogoutRounded";
import VideoCall from "./pages/video-call";
import { BACKEND_URL } from "./config";
import "./App.css";

const initialFormState = {
  userName: "",
};

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [formState, setFormState] = useState(initialFormState);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: "",
    severity: "info",
  });

  const currentUserName = useMemo(
    () => formState.userName.trim(),
    [formState.userName],
  );

  const showMessage = (message, severity = "info") => {
    setSnackbar({ open: true, message, severity });
  };

  const logoutUser = () => {
    localStorage.removeItem("userName");
    setFormState(initialFormState);
    setIsLoggedIn(false);
  };

  const handleAuth = async () => {
    if (!currentUserName) {
      showMessage("Enter a display name to continue.", "warning");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch(
        `${BACKEND_URL}/checkUserName?userName=${encodeURIComponent(currentUserName)}`,
      );
      const result = await response.json();
      if (!result.success) {
        showMessage(result.reason || "That name is already in use.", "warning");
        return;
      }

      localStorage.setItem("userName", currentUserName);
      setFormState({ userName: currentUserName });
      setIsLoggedIn(true);
    } catch (error) {
      showMessage("Unable to connect to the backend right now.", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    const savedUserName = localStorage.getItem("userName");
    if (savedUserName) {
      setFormState({ userName: savedUserName });
      setIsLoggedIn(true);
    }
  }, []);

  if (isLoggedIn && currentUserName) {
    return (
      <div className="app-shell">
        <header className="top-app-bar">
          <Box>
            <Typography className="meeting-kicker">
              Video conference workspace
            </Typography>
            <Typography variant="h5" className="app-brand-title">
              Instant Meet
            </Typography>
          </Box>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Chip label={currentUserName} className="header-chip" />
            <Button
              className="logout-btn"
              startIcon={<LogoutRoundedIcon />}
              onClick={logoutUser}
            >
              Logout
            </Button>
          </Stack>
        </header>
        <VideoCall userName={currentUserName} />
      </div>
    );
  }

  return (
    <>
      <div className="app-shell auth-shell">
        <div className="auth-card-shell">
          <div className="auth-hero-panel">
            <Chip label="Modern wallet workspace" className="floating-chip" />
            <Typography variant="h2" className="hero-title">
              Enter your display name and join instantly.
            </Typography>
            <Typography className="hero-copy">
              Use one simple entry flow for every meeting. If a display name is
              already active, the app will let you know and you can choose
              another one.
            </Typography>
            <div className="feature-row">
              <div className="feature-card">
                <Typography className="feature-card-title">
                  Smart overview
                </Typography>
                <Typography className="feature-card-copy">
                  Quick launch hosting, room code copy, and a clearer meeting
                  dashboard.
                </Typography>
              </div>
              <div className="feature-card">
                <Typography className="feature-card-title">
                  Interactive controls
                </Typography>
                <Typography className="feature-card-copy">
                  Mute, timers, hand raise, and participant management in one
                  place.
                </Typography>
              </div>
            </div>
          </div>

          <div className="auth-form-panel">
            <Typography className="meeting-kicker dark-text">
              Get started
            </Typography>
            <Typography variant="h4" className="meeting-title dark-text">
              Join with your display name
            </Typography>
            <Typography className="meeting-subtitle dark-subtitle">
              Pick any available display name. If the name is already taken, you
              will see a message.
            </Typography>

            <Box mt={3}>
              <Typography className="input-label">Display name</Typography>
              <TextField
                fullWidth
                placeholder="Enter your name"
                value={formState.userName}
                onChange={(event) =>
                  setFormState({
                    userName: event.target.value,
                  })
                }
                InputProps={{ className: "modern-input" }}
              />
            </Box>

            <Button
              fullWidth
              variant="contained"
              className="primary-action-btn submit-auth-btn"
              onClick={handleAuth}
              disabled={isSubmitting}
            >
              {isSubmitting ? "Please wait..." : "Continue to dashboard"}
            </Button>
          </div>
        </div>
      </div>

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

export default App;
