import React, { useEffect, useState } from "react";
import { Button, Grid, TextField } from "@mui/material";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogTitle from "@mui/material/DialogTitle";
import io from "socket.io-client";
import HostView from "./host-view";
import ParticipantView from "./participant-view";
function VideoCall({ userName }) {
	const [socket, setSocket] = useState(null);
	const [showJoinCall, setShowJoinCall] = useState(false);
	const [showJoinRequest, setShowJoinRequest] = useState(false);
	const [isHostingACall, setIsHostingACall] = useState(false);
	const [didJoinedInCall, setDidJoinedInCall] = useState(false);
	const [roomName, setRoomName] = useState("");

	const handleClose = () => {
		setShowJoinCall(false);
		setShowJoinRequest(false);
	};

	const joinRoom = () => {
		socket.emit("joinCall", { roomToJoin: roomName });
	};

	const hostCall = (e) => {
		socket.emit("hostCall");
	};

	useEffect(() => {
		if (socket) {
			const hostingResponse = (response) => {
				if (response.success) {
					setRoomName(response.roomName);
					setDidJoinedInCall(false);
					setIsHostingACall(true);
				}
			};

			socket.on("hostingResponse", hostingResponse);
			socket.on("requestToJoin", (data) => {
				setRoomName(data.roomName);
				setShowJoinRequest(true);
			});
			socket.on("defaultPoll", (data) => {
				if (data.joinedRoom) {
					setDidJoinedInCall(true);
					setRoomName(data.joinedRoom);
				}
				if (data.hostedRoom) setIsHostingACall(true);
			});
			socket.on("joiningResponse", (response) => {
				if (response.success) {
					setRoomName(response.roomName);
					setIsHostingACall(false);
					setDidJoinedInCall(true);
					setShowJoinCall(false);
					setShowJoinRequest(false);
				}
			});
		}
	}, [socket]);

	const joinExistingCall = (e) => {
		setShowJoinCall(true);
	};

	useEffect(() => {
		const newSocket = io(`http://${window.location.hostname}:3001`, {
			query: { userName },
		});
		setSocket(newSocket);
		return () => newSocket.close();
	}, [setSocket]);

	return (
		<>
			{!isHostingACall && !didJoinedInCall && (
				<Grid
					container
					height={"100vh"}
					justifyContent="center"
					alignContent={"center"}
					direction="column"
				>
					<Button
						onClick={hostCall}
						style={{ width: "200px", fontSize: "12px" }}
						variant="contained"
					>
						Host a new call
					</Button>
					<Button
						onClick={joinExistingCall}
						style={{ width: "200px", fontSize: "12px", marginTop: "10px" }}
						variant="contained"
					>
						Join a call
					</Button>
				</Grid>
			)}
			{isHostingACall && socket && (
				<HostView socket={socket} setIsHostingACall={setIsHostingACall} />
			)}
			{didJoinedInCall && socket && (
				<ParticipantView
					socket={socket}
					roomName={roomName}
					setDidJoinedInCall={setDidJoinedInCall}
				/>
			)}
			<Dialog open={showJoinCall} onClose={handleClose}>
				<DialogTitle>Join a Call</DialogTitle>
				<DialogContent>
					<DialogContentText>
						Please enter the room name to join
					</DialogContentText>
					<TextField
						value={roomName}
						onChange={(e) => setRoomName(e.target.value)}
						autoFocus
						margin="dense"
						id="room"
						label="Room Name"
						type="text"
						fullWidth
						variant="standard"
					/>
				</DialogContent>
				<DialogActions>
					<Button onClick={handleClose}>Cancel</Button>
					<Button onClick={joinRoom}>Join</Button>
				</DialogActions>
			</Dialog>
			<Dialog open={showJoinRequest} onClose={handleClose}>
				<DialogTitle>Request to join</DialogTitle>
				<DialogContent>
					<DialogContentText>
						{roomName} requested you to join!
					</DialogContentText>
				</DialogContent>
				<DialogActions>
					<Button onClick={handleClose}>Decline</Button>
					<Button onClick={joinRoom}>Accept</Button>
				</DialogActions>
			</Dialog>
		</>
	);
}
export default VideoCall;
