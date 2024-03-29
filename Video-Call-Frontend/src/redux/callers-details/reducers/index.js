export default (state, action) => {
	switch (action.type) {
		case "SET_USERS":
			return {
				...state,
				users: [...action.payload],
			};
		case "ADD_USER":
			let currentUsers = state.users;
			if (currentUsers.indexOf(action.payload) == -1) {
				currentUsers.push(action.payload);
			}
			return {
				...state,
				users: [...currentUsers],
			};
		case "REMOVE_USER":
			let allUsers = state.users;
			allUsers = allUsers.filter((eachUser) => eachUser != action.payload);
			return {
				...state,
				users: allUsers,
			};
		case "IS_TIMER_RUNNING":
			return {
				...state,
				isTimerRunning: action.payload,
			};
		default:
			return state;
	}
};
