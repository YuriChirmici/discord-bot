const commandsService = require("./commands");
const formsService = require("./forms");
const memberCommandsService = require("./member-commands");
const gameAccountsService = require("./game-accounts");
const { getNextIntervalDate } = require("./helpers");
const { Models } = require("../database");

const INTERVAL = 3 * 60 * 1000;

const run = async (client, isFirstRun) => {
	try {
		if (isFirstRun) {
			await gameAccountsService.updateListAutoCheckTask();
		}

		const tasks = await Models.Scheduler.find({ executionDate: { $lt: new Date } });
		for (let task of tasks) {
			await processTask(task, client);
		}

		await runCustomTasks(client);
	} catch (err) {
		logError(err);
	}
};

const processTask = async (task, client) => {
	let execute;
	if (task.name === gameAccountsService.checkMembersListTaskName) {
		execute = () => gameAccountsService.runListCheckTask(client);
	} else {
		const command = commandsService.getCommandByName(task.name);
		if (command?.task) {
			execute = (data) => command.task(data, client);
		}
	}

	if (!execute) {
		logError(`Error executing ${task.name}, no command or task`);
		return;
	}

	try {
		await execute(task.data);
		console.log(`Executed "${task.name}" task`);
		if (task.period) {
			await Models.Scheduler.updateOne({ _id: task._id }, {
				executionDate: getNextIntervalDate(task.period)
			});
		} else {
			await Models.Scheduler.deleteOne({ _id: task._id });
		}
	} catch (err) {
		logError("Error executing scheduler task, " + JSON.stringify(task) + "\n" + err);
	}
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
		run(client, true);
		setInterval(() => run(client), INTERVAL);
	}
};
