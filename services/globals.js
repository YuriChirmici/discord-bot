const path = require("path");
require("./errors");

global.getCommandName = (filename) => {
	return path.basename(filename).split(".")[0];
};
