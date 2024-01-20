const { getCommandByName } = require("./commands");
const fs = require("fs");
const path = require("path");

const INTERVAL = 60 * 1000;

const run = async (client) => {
	console.log("Run scheduler")
	const schedulerPath = path.join(__dirname, "../data/scheduler.json");
	const scheduler = JSON.parse(fs.readFileSync(schedulerPath), "utf8");
	
	for (let task of scheduler.tasks) {
		const command = getCommandByName(task.name);
		if (!command?.task) {
			console.log(`Error executing ${task.name}, no command or task`);
			task.toRemove = true;
			continue;
		}

		if (task.executionDate > Date.now()) continue;

		try {
			await command.task(task.data, client);
			console.log(`Executed ${task.name} task`);
			task.toRemove = true;
		} catch (err) {
			console.log("Error executing scheduler task", JSON.stringify(task), err);
		}
	}

	scheduler.tasks = scheduler.tasks.filter(({ toRemove }) => !toRemove);
	fs.writeFileSync(schedulerPath, JSON.stringify(scheduler, null, "\t"));
}

module.exports = {
	start(client) {
		run(client);
		setInterval(() => run(client), INTERVAL);
	}
}