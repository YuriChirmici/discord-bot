const mongoose = require("mongoose");
const fs = require("fs");
const path = require("path");
const { database } = require("../config.json");

const Models = {};
const modelsPath = path.join(__dirname, "./models");
const modelFiles = fs.readdirSync(modelsPath).filter(file => file.endsWith(".js"));

for (const file of modelFiles) {
	const filePath = path.join(modelsPath, file);
	const filename = path.basename(filePath).split(".")[0];
	const model = require(filePath);
	Models[filename] = model;
}

module.exports = {
	connect: async() => {
		try {
			await mongoose.connect(
				`mongodb+srv://${database.username}:${database.password}@` +
				`${database.cluster}.mongodb.net/${database.name}?retryWrites=true&w=majority`
			);
			console.log("Connected to DB successfully");
		} catch (err) {
			console.log(err);
		}
	},
	Models
};