export const setUsers = (usersList) => {
	return {
		type: "SET_USERS",
		payload: usersList,
	};
};
export const addUser = (user) => {
	return {
		type: "ADD_USER",
		payload: user,
	};
};

export const removeUser = (user) => {
	return {
		type: "REMOVE_USER",
		payload: user,
	};
};
export const setIsTimerRunning = (timerRunning) => {
	return {
		type: "IS_TIMER_RUNNING",
		payload: timerRunning,
	};
};
