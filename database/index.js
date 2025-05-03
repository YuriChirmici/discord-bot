const mongoose = require("mongoose");
const fs = require("fs");
const path = require("path");
const configService = require("../services/config");

const Models = {};
const modelsPath = path.join(__dirname, "./models");
const modelFiles = fs.readdirSync(modelsPath).filter(file => file.endsWith(".js"));

for (const file of modelFiles) {
	const filePath = path.join(modelsPath, file);
	const filename = path.basename(filePath).split(".")[0];
	const model = require(filePath);
	Models[filename] = model;
}

class DatabaseService {
	constructor() {
		this.Models = Models;
	}

	async connect() {
		try {
			await mongoose.connect(process.env.MONGO_URI);

			const configDocument = await this.getDbConfig();
			configService.setConfig(configDocument.config);

			await this.watchConfigChanges();
			console.log("Connected to DB successfully");
		} catch (err) {
			logError(err);
		}
	}

	async watchConfigChanges() {
		const changeStream = Models.Config.watch();

		changeStream.on("change", async (change) => {
			if (change.operationType === "update" || change.operationType === "replace") {
				const configDocument = await this.getDbConfig();
				if (configDocument?.source !== "admin-gui") {
					return;
				}

				configService.setConfig(configDocument.config);
			}
		});
	}

	async getDbConfig() {
		const config = await Models.Config.findOne({ type: "app-config" }).lean();
		return config;
	}
}

const dbService = new DatabaseService();

module.exports = dbService;
