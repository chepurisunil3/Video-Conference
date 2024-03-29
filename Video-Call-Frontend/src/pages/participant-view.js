import { Button, Card, Grid, Typography } from "@mui/material";
import { Box } from "@mui/system";
import React, { useEffect, useRef, useState } from "react";
import { Peer } from "peerjs";
import { useDispatch, useSelector } from "react-redux";
import {
	addUser,
	removeUser,
	setUsers,
} from "../redux/callers-details/actions";
import VideocamOffIcon from "@mui/icons-material/VideocamOff";
import CallEndIcon from "@mui/icons-material/CallEnd";
import MicOffIcon from "@mui/icons-material/MicOff";
import PersonIcon from "@mui/icons-material/Person";

function ParticipantView({ socket, roomName, setDidJoinedInCall }) {
	const currentUsers = useSelector((state) => state.users);
	let peer = null;
	const dispatch = useDispatch();
	const currentUser = localStorage.getItem("userName");
	const yourVideo = useRef();
	const hostVideo = useRef();
	const [membersToDisplay, setMembersToDisplay] = useState([]);
	const [timer, setTimer] = useState(-1);

	const endCall = () => {
		socket.emit("endParticipantCall", { roomName: roomName });
	};

	const connectToNewUser = async (userName, stream) => {
		console.log(stream);
		const call = peer.call("Sunil", stream);
		console.log(call);
		call.on("stream", (userVideoStream) => {
			if (hostVideo != null) {
				hostVideo.current.srcObject = userVideoStream;
			}
		});
	};

	const newUserConnection = (stream) => {
		console.log("New User Connection");
		connectToNewUser("Sunil", stream);
	};

	const setPeerListeners = (stream) => {
		peer.on("call", (call) => {
			console.log(call);
			call.answer(stream);
			call.on("stream", (userStreamVideo) => {});
		});
	};

	useEffect(() => {
		peer = new Peer(currentUser, {
			host: "localhost",
			port: 9000,
		});
		peer.on("open", (id) => {
			navigator.getUserMedia({ video: true, audio: false }, (stream) => {
				if (stream) {
					setPeerListeners(stream);
					newUserConnection(stream);
				}
			});
		});
		peer.on("error", (err) => {
			peer.reconnect();
		});

		return () => {
			peer.disconnect();
		};
	}, []);

	useEffect(() => {
		if (currentUsers.length > 7) {
			setMembersToDisplay([...currentUsers.splice(0, 7)]);
		} else {
			setMembersToDisplay([...currentUsers]);
		}
	}, [currentUsers]);

	useEffect(() => {
		navigator.getUserMedia(
			{ video: true, audio: false },
			function (stream) {
				if (yourVideo != null) {
					yourVideo.current.srcObject = stream;
				} else {
					console.log("null");
				}
			},
			function (error) {
				console.log(error);
			}
		);
	}, []);

	useEffect(() => {
		if (socket) {
			socket.emit("membersDetails", { roomName });

			socket.on("setToMute", () => {
				alert("Host has muted you!");
			});

			socket.on("userLeft", (data) => {
				if (data.userName) {
					dispatch(removeUser(data.userName));
				}
			});

			socket.on("endCallResponse", (data) => {
				if (data.success) {
					setDidJoinedInCall(false);
				}
			});

			socket.on("timerUpdate", (data) => {
				if (data.count > 0) {
					setTimer(data.count);
				} else {
					const audio = new Audio(
						"https://www.fesliyanstudios.com/play-mp3/4383"
					);
					audio.play();
					setTimer(-1);
				}
			});

			socket.on("membersDetails", (data) => {
				if (data.success && data.data.length > 0) {
					dispatch(setUsers(data.data));
				}
			});

			socket.on("userJoined", (data) => {
				if (data.userName) {
					dispatch(addUser(data.userName));
				}
			});
		}
	}, [socket]);
	return (
		<Box
			marginTop={"10vh"}
			width={"100vw"}
			height="90vh"
			position={"relative"}
			flexDirection="row"
		>
			<Grid
				container
				width={"20vw"}
				height={"100%"}
				style={{ overflowY: "auto", float: "left" }}
			>
				{membersToDisplay.map((eachMember, index) => {
					if (eachMember.toLowerCase() != roomName) {
						return (
							<Card
								style={{
									width: "100%",
									height: "min-content",
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
								<PersonIcon
									style={{ width: "150px", height: "150px", marginTop: "25px" }}
								/>
							</Card>
						);
					} else {
						return <></>;
					}
				})}
			</Grid>
			<Grid
				container
				style={{
					background: "transparent",
					position: "absolute",
					zIndex: 10,
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
				{timer >= 0 && <Button>Timer: {timer}</Button>}
			</Grid>
			<Grid container width={"80vw"} height={"100%"}>
				<Card
					style={{
						width: "100%",
						height: "100%",
						background: "transparent",
						border: "1px solid black",
						position: "relative",
						display: "flex",
						justifyContent: "center",
						alignItems: "center",
					}}
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
						{roomName}
					</Typography>
					<video width={"100%"} height="auto" ref={hostVideo} autoPlay />
				</Card>
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
						top: 10,
						left: 0,
						background: "transparent",
						width: "100%",
						color: "white",
					}}
					variant="h6"
				>
					{localStorage.getItem("userName")}
				</Typography>
				<video width={"100%"} height="auto" ref={yourVideo} autoPlay />
			</Card>
		</Box>
	);
}
export default ParticipantView;
