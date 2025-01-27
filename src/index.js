const ConfigReader = require("./ConfigReader");
const DBInterface = require("./DBInterface");
const configReader = new ConfigReader("../config");
const dbInterface = new DBInterface(configReader.mysqlConfig());
const express = require("express");
const authRouter = require("./api/authorization/AuthRouter");
const tokenRouter = require("./api/token/TokenRouter");
const tokenInfoRouter = require("./api/token/TokenInfoRouter");
const userRouter = require("./api/user/UserRouter");
const clientRouter = require("./api/client/ClientRouter");
const permissionRouter = require("./api/permission/PermissionRouter");
const { currentUnixTime } = require("./api/utils");
const adminConsole = require("./adminConsole/adminConsole");
const path = require("path");
var app = express();

async function main() {
    //create tables if they don't exist
    if (!(await dbInterface.checkDatabase())) {
        await dbInterface.initDatabase("ce48c1b6-2ca6-47f6-ad19-53a7a5d78b08", "rrpYu87YvznA", "http://example.com"); //TODO Prompt for dashboard client creation
        console.log("Tables created");
    }

    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));

    //Frontend
    app.use("/authorize", express.static(__dirname + "/../websites/authorization"));
    app.use("/register", express.static(__dirname + "/../websites/register"));
    app.use("/dashboard", express.static(__dirname + "/../websites/dashboard"));

    //Backend
    app.use("/api/authorize", authRouter);
    app.use("/api/token", tokenRouter);
    app.use("/api/token_info", tokenInfoRouter);
    app.use("/api/user", userRouter);
    app.use("/api/client", clientRouter);
    app.use("/api/permission", permissionRouter);

    //404
    app.use((req, res) => {
        res.status(404);
        if (req.accepts('html'))
            res.sendFile(path.resolve(__dirname + "/../websites/404.html"));
        else
            res.send({ status: 404 });
    })

    //delete old access tokens, run once every day
    setInterval(() => {
        dbInterface.query(`DELETE FROM access_token WHERE expires < ${currentUnixTime()}`);
    }, 86400000);

    app.listen(configReader.port());

    //start console
    adminConsole.start();
}

main().catch(e => console.error(e));