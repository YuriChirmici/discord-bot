const { start: schedulerStart } = require("./services/scheduler");
const { login, client } = require("./client");

(async () => {
	try {
		await login();
		schedulerStart(client);
	} catch (err) {
		console.log(err);
	}
})();