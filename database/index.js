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
			await mongoose.connect(configService.database.connectionLink);
			console.log("Connected to DB successfully");
		} catch (err) {
			logError(err);
		}
	}
}

const dbService = new DatabaseService();

module.exports = dbService;
