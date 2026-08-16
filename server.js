/**
 * Application entry point.
 *
 * Loads `.env`, opens the MongoDB connection, then starts listening. The
 * Express app itself is built in {@link module:src/app} and exported without
 * listening, so it stays importable from tests.
 *
 * Run with `npm run dev` (nodemon) or `npm start`.
 */

require("dotenv").config();

const app = require("./src/app");
const connectToDb = require("./src/config/db");

/**
 * Port to bind, from the `PORT` key in `.env`.
 * @type {string|number}
 */
const PORT = process.env.PORT || 3000;

connectToDb();

app.listen(PORT, () => {
  console.log(`server is running on port ${PORT}`);
});
