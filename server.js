const { start: schedulerStart } = require("./services/scheduler");
const { login, client } = require("./client");
const { connect: dbConnect } = require("./database");
const { updateApp } = require("./shell-commands");

const update = async () => {
	try {
		await updateApp(true);
	} catch (err) {
		console.log(err);
	}
}

(async () => {
	try {
		await update();
		await login();
		await dbConnect();
		schedulerStart(client);
	} catch (err) {
		console.log(err);
	}
})();