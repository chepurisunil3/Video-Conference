import {
	Button,
	Card,
	Dialog,
	DialogActions,
	DialogContent,
	DialogContentText,
	DialogTitle,
	Grid,
	IconButton,
	TextField,
	Typography,
} from "@mui/material";
import { Box } from "@mui/system";
import Peer from "peerjs";
import React, { useEffect, useRef, useState } from "react";
import PersonIcon from "@mui/icons-material/Person";
import VideocamOffIcon from "@mui/icons-material/VideocamOff";
import CallEndIcon from "@mui/icons-material/CallEnd";
import PersonRemoveIcon from "@mui/icons-material/PersonRemove";
import MicOffIcon from "@mui/icons-material/MicOff";
import AddIcon from "@mui/icons-material/Add";
import { useDispatch, useSelector } from "react-redux";
import {
	addUser,
	removeUser,
	setIsTimerRunning,
	setUsers,
} from "../redux/callers-details/actions";

function HostView({ socket, setIsHostingACall }) {
	const currentUsers = useSelector((state) => state.users);
	const isTimerRunning = useSelector((state) => state.isTimerRunning);
	let peer = null;
	const dispatch = useDispatch();
	const yourVideo = useRef();
	const theirVideo = useRef();
	const roomName = localStorage.getItem("userName");
	const [membertsToDisplay, setMembersToDisplay] = useState([]);
	const [showJoinCall, setShowJoinCall] = useState(false);

	const [requestUser, setRequestUser] = useState("");
	const [timer, setTimer] = useState(-1);

	const handleClose = () => {
		setShowJoinCall(false);
	};

	useEffect(() => {
		peer = new Peer(roomName, {
			host: "localhost",
			port: 9000,
		});
		peer.on("open", (id) => {
			console.log(id);
			navigator.getUserMedia({ video: true, audio: false }, (stream) => {
				if (stream) {
					if (yourVideo != null) {
						yourVideo.current.srcObject = stream;
					}
					setPeerListeners(stream);
					newUserConnection(stream);
				}
			});
		});

		return () => {
			peer.disconnect();
		};
	}, []);

	const initializePeerConnection = () => {
		return new Peer("", {
			host: "localhost",
			port: 9000,
			path: "/peerjs",
		});
	};

	const setPeerListeners = (stream) => {
		console.log("Setting peers");
		peer.on("call", (call) => {
			console.log(call);
			call.answer(stream);
			call.on("stream", (userStreamVideo) => {
				if (theirVideo != null) {
					theirVideo.current.srcObject = userStreamVideo;
				}
			});
		});
	};

	const newUserConnection = (stream) => {
		socket.on("userJoined", (data) => {
			if (data.userName) {
				dispatch(addUser(data.userName));
				//connectToNewUser(data.userName, stream);
			}
		});
	};

	const connectToNewUser = (userName, stream) => {
		console.log(userName);
		const call = peer.call(1234, stream);
		console.log(call);
	};

	// useEffect(() => {
	// 	if (peer != null) {
	// 		peer.on("connect", () => {
	// 			console.log("Connected");
	// 		});
	// 		peer.on("connection", (conn) => {
	// 			console.log("Got Connection");
	// 			conn.on("data", (data) => {
	// 				console.log("Received data", data);
	// 			});
	// 		});
	// 		peer.on("open", (id) => {
	// 			console.log("Peer opened for " + id);
	// 			navigator.getUserMedia({ video: true, audio: false }).then((stream) => {
	// 				if (stream) {
	// 					setPeerListeners(stream);
	// 					newUserConnection(stream);
	// 				}
	// 			});
	// 		});
	// 	} else {
	// 		setPeer(initializePeerConnection());
	// 	}
	// }, [peer]);

	const endCall = () => {
		socket.emit("endHostCall", { roomName: roomName });
	};
	const removeParticipant = (member) => {
		socket.emit("removeParticipant", { userName: member });
	};
	const muteParticipant = (member) => {
		socket.emit("muteParticipant", { userName: member });
	};

	const startTimer = (seconds) => {
		if (!isTimerRunning) socket.emit("setTimer", { seconds: seconds });
		else {
			alert("Timer is already running on participants screen");
		}
	};

	useEffect(() => {
		if (currentUsers.length > 4) {
			setMembersToDisplay([...currentUsers.splice(0, 4)]);
		} else {
			setMembersToDisplay([...currentUsers]);
		}
	}, [currentUsers]);

	const requestUserToJoin = () => {
		setShowJoinCall(false);
		if (requestUser != "") {
			socket.emit("requestToJoin", { userName: requestUser });
		}
	};
	useEffect(() => {
		if (socket) {
			socket.emit("membersDetails", { roomName });

			socket.on("userLeft", (data) => {
				if (data.userName) {
					dispatch(removeUser(data.userName));
				}
			});

			socket.on("endCallResponse", (data) => {
				if (data.success) {
					setIsHostingACall(false);
				}
			});

			socket.on("membersDetails", (data) => {
				if (data.success && data.data.length > 0) {
					dispatch(setUsers(data.data));
				}
			});

			socket.on("timerStopped", () => {
				dispatch(setIsTimerRunning(false));
				dispatch(setTimer(-1));
			});

			socket.on("startedTimer", (data) => {
				if (data.success) {
					dispatch(setIsTimerRunning(true));
				}
			});

			socket.on("timerUpdate", (data) => {
				if (data.count) {
					setTimer(data.count);
				} else {
					const audio = new Audio(
						"https://www.fesliyanstudios.com/play-mp3/4383"
					);
					audio.play();
					setTimer(-1);
				}
			});
		}
	}, [socket]);
	return (
		<Box marginTop={"10vh"} width={"100vw"} height="90vh" position={"relative"}>
			<Grid container style={{ width: "100%", height: "100%" }}>
				{membertsToDisplay.length > 0 ? (
					membertsToDisplay.map((eachMember, index) => {
						return (
							<Card
								style={{
									width: "max-content",
									height: "max-content",
									minWidth: "50%",
									maxWidth: "100%",
									minHeight: "50%",
									maxHeight: "50%",
									background: "transparent",
									border: "1px solid black",
									position: "relative",
									display: "flex",
									justifyContent: "center",
									alignItems: "center",
								}}
								key={index}
							>
								<Typography
									style={{
										position: "absolute",
										top: 10,
										left: 0,
										background: "transparent",
										width: "100%",
										color: "white",
									}}
									variant="h6"
								>
									{eachMember}
								</Typography>
								<video width={"100%"} height="auto" ref={theirVideo} autoPlay />
								<PersonRemoveIcon
									onClick={() => {
										removeParticipant(eachMember);
									}}
									style={{
										position: "absolute",
										color: "red",
										bottom: 10,
										right: 10,
										zIndex: 10,
										cursor: "pointer",
									}}
								/>
								<MicOffIcon
									onClick={() => {
										muteParticipant(eachMember);
									}}
									style={{
										position: "absolute",
										color: "white",
										bottom: 10,
										right: 40,
										zIndex: 10,
										cursor: "pointer",
									}}
								/>
							</Card>
						);
					})
				) : (
					<Typography variant="h3" style={{ width: "100%", color: "white" }}>
						No one else is here
					</Typography>
				)}
			</Grid>
			<Grid
				container
				style={{
					background: "transparent",
					position: "absolute",
					bottom: 10,
					left: "0",
				}}
				justifyContent="center"
			>
				<VideocamOffIcon
					style={{
						width: "26px",
						height: "26px",
						borderRadius: "13px",
						margin: "5px 10px",
						background: "white",
						cursor: "pointer",
						padding: "5px",
					}}
				/>
				<MicOffIcon
					style={{
						width: "26px",
						height: "26px",
						borderRadius: "13px",
						margin: "5px 10px",
						background: "white",
						cursor: "pointer",
						padding: "5px",
					}}
				/>
				<AddIcon
					onClick={(e) => {
						setShowJoinCall(true);
					}}
					style={{
						width: "26px",
						height: "26px",
						borderRadius: "13px",
						margin: "5px 10px",
						background: "white",
						cursor: "pointer",
						padding: "5px",
					}}
				/>
				<CallEndIcon
					onClick={endCall}
					style={{
						width: "26px",
						height: "26px",
						borderRadius: "13px",
						margin: "5px 10px",
						background: "white",
						cursor: "pointer",
						padding: "5px",
					}}
				/>
				<IconButton
					onClick={() => {
						startTimer(15);
					}}
					style={{
						width: "26px",
						height: "26px",
						margin: "5px 10px",
						fontSize: "10px",
						background: "white",
						fontWeight: "bold",
						cursor: "pointer",
					}}
				>
					15s
				</IconButton>
				<IconButton
					onClick={() => {
						startTimer(30);
					}}
					style={{
						width: "26px",
						height: "26px",
						margin: "5px 10px",
						fontSize: "10px",
						background: "white",
						fontWeight: "bold",
						cursor: "pointer",
					}}
				>
					30s
				</IconButton>
				<IconButton
					onClick={() => {
						startTimer(45);
					}}
					style={{
						width: "26px",
						height: "26px",
						margin: "5px 10px",
						fontSize: "10px",
						background: "white",
						fontWeight: "bold",
						cursor: "pointer",
					}}
				>
					45s
				</IconButton>
				{timer >= 0 && <Button>Timer: {timer}</Button>}
			</Grid>
			<Card
				style={{
					width: "150px",
					height: "150px",
					background: "transparent",
					border: "1px solid black",
					position: "absolute",
					bottom: 10,
					right: 10,
					display: "flex",
					justifyContent: "center",
					alignItems: "center",
				}}
			>
				<Typography
					style={{
						position: "absolute",
						top: 0,
						left: 0,
						background: "transparent",
						width: "100%",
						color: "white",
						zIndex: "10",
					}}
					variant="h6"
				>
					{localStorage.getItem("userName")}
				</Typography>
				<video width={"100%"} height="auto" ref={yourVideo} autoPlay />
			</Card>
			<Dialog open={showJoinCall} onClose={handleClose}>
				<DialogTitle>Request people to join</DialogTitle>
				<DialogContent>
					<DialogContentText>Enter user name</DialogContentText>
					<TextField
						value={requestUser}
						onChange={(e) => setRequestUser(e.target.value)}
						autoFocus
						margin="dense"
						id="participantUserName"
						label="User Name"
						type="text"
						fullWidth
						variant="standard"
					/>
				</DialogContent>
				<DialogActions>
					<Button onClick={handleClose}>Cancel</Button>
					<Button onClick={requestUserToJoin}>Request</Button>
				</DialogActions>
			</Dialog>
		</Box>
	);
}
export default HostView;
