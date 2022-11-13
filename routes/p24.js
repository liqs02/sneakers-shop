const express = require("express");
const router = express.Router();
const { getPaymentMethods } = require("../utils/p24");

router.get("/", async (req, res) => {
  const result = await getPaymentMethods("pl");
  res.status(200).send(result);
});

router.get("/:lang", async (req, res) => {
  const result = await getPaymentMethods(req.params.lang);
  res.status(200).send(result);
});

module.exports = router;
