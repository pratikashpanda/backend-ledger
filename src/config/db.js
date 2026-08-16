const mongoose = require("mongoose");

/**
 * Open the shared Mongoose connection using the `MONGO_URI` env var.
 *
 * Fire-and-forget: it returns before the connection is established, and
 * terminates the process with `exit(1)` if the connection fails. Mongoose
 * buffers queries issued in the meantime, so models are safe to use
 * immediately.
 *
 * @returns {void}
 */
function connectToDB() {
  mongoose
    .connect(process.env.MONGO_URI)
    .then(() => {
      console.log("server is connected to DB");
    })
    .catch((err) => {
      console.error("Error connecting to DB:");
      process.exit(1);
    });
}

module.exports = connectToDB;
