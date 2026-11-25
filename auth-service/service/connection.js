/** Packages */
const mongoose = require("mongoose");
/** Config */
import config from "../config";

export const connect = () => {
    // Connecting to the database
    mongoose.set('strictQuery', false)

    mongoose
        .connect(config?.MONGOURI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        })
        .then(() => {
            // BS-INFRA-008 fix: never log the connection string — it embeds
            // the DB credentials.
            console.log("Successfully connected to database");
        })
        .catch((error) => {
            console.log("database connection failed. exiting now...");
            console.error(error);
            // BS-INFRA-009 fix: fail closed — a service with no database
            // must not keep running silently.
            process.exit(1);
        });
};