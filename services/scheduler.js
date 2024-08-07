const commandsService = require("./commands");
const formsService = require("./forms");
const memberCommandsService = require("./member-commands");
const { Models } = require("../database");

const INTERVAL = 3 * 60 * 1000;

const run = async (client) => {
	const tasks = await Models.Scheduler.find({ executionDate: { $lt: new Date } });

	for (let task of tasks) {
		const command = commandsService.getCommandByName(task.name);
		if (!command?.task) {
			logError(`Error executing ${task.name}, no command or task`);
			continue;
		}

		try {
			await command.task(task.data, client);
			console.log(`Executed "${task.name}" task`);
			await Models.Scheduler.deleteOne({ _id: task._id });
		} catch (err) {
			logError("Error executing scheduler task, " + JSON.stringify(task) + "\n" + err);
		}
	}

	await runCustomTasks(client);
};

const runCustomTasks = async (client) => {
	try {
		await formsService.clearOldForms(client);
		await memberCommandsService.runVacationStart(client);
		await memberCommandsService.runVacationEnd(client);
	} catch (err) {
		logError(err);
	}
};

module.exports = {
	start(client) {
		run(client);
		setInterval(() => run(client), INTERVAL);
	}
};
