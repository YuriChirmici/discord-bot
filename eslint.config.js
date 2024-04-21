const globals = require("globals");
const pluginJs = require("@eslint/js");
const eslintrc = require("./.eslintrc.json");

module.exports = [
	{ files: [ "**/*.js" ], languageOptions: { sourceType: "commonjs" } },
	{ languageOptions: {
		globals: {
			...globals.browser,
			...globals.node,
			...eslintrc.globals,
		},
	} },
	pluginJs.configs.recommended,
	{
		rules: {
			...eslintrc.rules,
		}
	}
];

