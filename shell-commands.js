const { exec } = require("child_process");

const runCommand = (command) => new Promise((resolve, reject) => {
	exec(command, (err, stdout, stderr) => {
		if (err) {
			reject(`error: ${err}`);
			return;
		}

		resolve(stdout || stderr);
	});
});

const fetchGitChanges = async () => {
	const result = await runCommand("git pull");
	return !result.includes("Already up to date.");
};

const deployCommands = async () => {
	await runCommand("npm run deploy-commands");
};

const updateApp = async (full) => {
	const hasUpdates = await fetchGitChanges();

	if (full) {
		deployCommands();
	}

	return hasUpdates;
};

module.exports = {
	runCommand,
	deployCommands,
	updateApp
};
