const fs = require("fs");
const path = require("path");
require("./services/globals");
const { start: schedulerStart } = require("./services/scheduler");
const { login, client } = require("./client");
const { connect: dbConnect } = require("./database");
const { updateApp } = require("./shell-commands");

const srcPath = path.join(__dirname, "./src");
if (!fs.existsSync(srcPath)) {
	fs.mkdirSync(srcPath);
}

const update = async () => {
	try {
		await updateApp(true);
	} catch (err) {
		logError(err);
	}
};

(async () => {
	try {
		await update();
		await login();
		await dbConnect();
		schedulerStart(client);
	} catch (err) {
		logError(err);
	}
})();
