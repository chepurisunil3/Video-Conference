import React, { useEffect, useState } from "react";
import { Provider } from "react-redux";
import configureStore from "./redux/callers-details/store";
import {
	Button,
	Card,
	CardContent,
	Grid,
	TextField,
	Typography,
} from "@mui/material";
import "./App.css";
import VideoCall from "./pages/video-call";

const store = configureStore();
function App() {
	const [isLoggedIn, setIsLoggedIn] = useState(false);
	const [userName, setUserName] = useState("");
	const logoOut = (e) => {
		localStorage.removeItem("userName");
		setIsLoggedIn(false);
		setUserName("");
	};
	const loginUser = async (event) => {
		if (userName != "") {
			const resp = await fetch(
				"http://localhost:3001/checkUserName?userName=" + userName
			);
			const response = await resp.json();
			if (response.success) {
				localStorage.setItem("userName", userName);
				setIsLoggedIn(true);
			} else {
				alert("Name is already taken");
			}
		}
	};
	useEffect(() => {
		if (localStorage.getItem("userName")) {
			setUserName(localStorage.getItem("userName"));
			setIsLoggedIn(true);
		}
	}, []);

	return (
		<Provider store={store}>
			<div className="App">
				<header className="app-header">
					<Typography style={{ float: "left" }} align="center" variant="h6">
						Online Video Calling
					</Typography>
					{isLoggedIn && (
						<Button onClick={logoOut} style={{ float: "right" }}>
							Logout
						</Button>
					)}
				</header>
				{isLoggedIn && userName != "" ? (
					<VideoCall userName={userName} />
				) : (
					<Grid
						style={{ width: "100%", height: "100%" }}
						container
						justifyContent={"center"}
						alignContent="center"
						justifyItems={"center"}
						alignItems="center"
					>
						<Card sx={{ minWidth: 400 }}>
							<CardContent>
								<Typography sx={{ fontSize: "18px", textAlign: "left" }}>
									Enter you name
								</Typography>
								<TextField
									onChange={(e) => {
										setUserName(e.target.value);
									}}
									value={userName}
									style={{ marginTop: 20, fontSize: "12px" }}
									fullWidth={true}
									size="small"
									label="Your Name"
								></TextField>
								<Button
									onClick={loginUser}
									variant="contained"
									style={{ marginTop: 20 }}
								>
									Login
								</Button>
							</CardContent>
						</Card>
					</Grid>
				)}
			</div>
		</Provider>
	);
}

export default App;
