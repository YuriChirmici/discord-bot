const { start: schedulerStart } = require("./services/scheduler");
const { login, client } = require("./client");
const { connect: dbConnect } = require("./database");

(async () => {
	try {
		await login();
		await dbConnect();
		schedulerStart(client);
	} catch (err) {
		console.log(err);
	}
})();