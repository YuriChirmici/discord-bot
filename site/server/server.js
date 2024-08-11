const express = require("express");
const ngrok = require("ngrok");
const next = require("next");
const path = require("path");
const configService = require("../../services/config");
const { app } = require("./app");
const { exec } = require("child_process");

const clientDir = path.join(__dirname, "../client");
app.use(express.static(path.join(clientDir, "public")));
app.use(express.json());

const startSiteServer = () => new Promise((resolve, reject) => {
	app.use("/config-api", require("./config-api"));

	const nextApp = next({ dev: configService.isDev, dir: clientDir });
	const nextHandle = nextApp.getRequestHandler();

	nextApp.prepare().then(() => {
		app.listen(configService.sitePort, (err) => {
			if (err) reject(err);
			console.log(`Website server started at port ${configService.sitePort}`);
			resolve();
		});

		app.get("*", (req, res) => {
			return nextHandle(req, res);
		});
	});
});

const startNgrok = async () => {
	await ngrok.authtoken(configService.ngrokToken);
	const url = await ngrok.connect(configService.sitePort);
	console.log(`Ngrok started at port ${configService.sitePort}: ${url}`);
	return url;
};

const buildProdSite = () => new Promise((resolve, reject) => {
	exec("npm run build:client", (error, stdout, stderr) => {
		const err = error || stderr;
		if (err) {
			reject(err);
			return;
		}

		console.log(stdout);
		resolve();
	});
});

module.exports.init = async ({ discordClient }) => {
	try {
		process.env.BASE_URL = `http://localhost:${configService.sitePort}`;

		if (!configService.isDev) {
			const ngrokUrl = await startNgrok();
			const channel = await discordClient.channels.fetch(configService.logsChannelId);
			await channel.send(`Сайт открыт по ссылке: ${ngrokUrl}`);

			process.env.BASE_URL = ngrokUrl;

			await buildProdSite();
		}

		await startSiteServer();
	} catch (err) {
		logError(err);
	}
};
