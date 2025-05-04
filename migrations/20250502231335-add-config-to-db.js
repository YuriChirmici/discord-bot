const configService = require("../services/config");

const appConfigType = "app-config"; // TODO: move to consts?

module.exports = {
	async up(db) {
		const configToInsert = {
			type: appConfigType,
			config: configService.config,
		};

		const existing = await db.collection("configs").findOne({ type: configToInsert.type });
		if (!existing) {
			await db.collection("configs").insertOne(configToInsert);
		} else {
			console.log("Config with this type already exists, skipping.");
		}
	},

	async down(db) {
		await db.collection("configs").deleteOne({ type: appConfigType });
		console.log("Config removed");
	}
};
