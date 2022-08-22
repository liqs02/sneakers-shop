const winston = require("winston");
const express = require("express");
const app = express();

require("./startup/routes")(app);
require("./startup/db")();
require("./startup/logging")();
require("./startup/config")();
require("./startup/validation")();
require("./startup/intervals")();

const port = process.env.PORT || 3000;
const server = app.listen(port, () => {
  winston.info(`Node environment: ${process.env.NODE_ENV}`);
  winston.info(`Listening on port ${port}...`);
});
module.exports = server;
