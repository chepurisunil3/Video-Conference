import { createStore } from "redux";
import reducers from "./reducers";
const configureStore = (state = { users: [], isTimerRunning: false }) => {
	return createStore(reducers, state);
};
export default configureStore;
