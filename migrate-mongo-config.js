const configService = require("./services/config");

// npx migrate-mongo create add-some-field
// npx migrate-mongo up

const config = {
	mongodb: {
		url: configService.database.connectionLink,
	},

	migrationsDir: "migrations",
	changelogCollectionName: "changelog",
	lockCollectionName: "changelog_lock",
	lockTtl: 0,
	migrationFileExtension: ".js",
	useFileHash: false,
	moduleSystem: "commonjs",
};

module.exports = config;
