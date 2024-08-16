const express = require("express");
const router = express.Router();
const configService = require("../../services/config");

router.get("/ping", (req, res) => {
	res.send({ result: "Pong" });
});

router.get("/get-config", (req, res) => {
	res.send({ config: configService.getPublicConfig() });
});

module.exports = router;
