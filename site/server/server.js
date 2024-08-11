const express = require("express");
const ngrok = require("ngrok");
const next = require("next");
const path = require("path");
const configService = require("../../services/config");
const { app } = require("./app");

const clientDir = path.join(__dirname, "../client");
app.use(express.static(path.join(clientDir, "public")));

const port = 3000;

const startSiteServer = () => new Promise((resolve, reject) => {
	app.use("/config-api", require("./config-api"));

	const nextApp = next({ dev: configService.isDev, dir: clientDir });
	const nextHandle = nextApp.getRequestHandler();

	nextApp.prepare().then(() => {
		app.listen(port, (err) => {
			if (err) reject(err);
			console.log(`Website server started at port ${port}`);
			resolve();
		});

		app.get("*", (req, res) => {
			return nextHandle(req, res);
		});
	});
});

const startNgrok = async () => {
	await ngrok.authtoken(configService.ngrokToken);
	const url = await ngrok.connect(port);
	console.log(`Ngrok started at port ${port}`);
	return url;
};

module.exports.init = async ({ discordClient }) => {
	try {
		await startSiteServer();

		if (!configService.isDev) {
			const ngrokUrl = await startNgrok();
			const channel = await discordClient.channels.fetch(configService.logsChannelId);
			await channel.send(`Сайт открыт по ссылке: ${ngrokUrl}`);
		}
	} catch (err) {
		logError(err);
	}
};
