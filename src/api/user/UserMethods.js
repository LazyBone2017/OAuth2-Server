const bcrypt = require("bcrypt");
const DBInterface = require("../../DBInterface");
const { respond, requireValues } = require("../utils");
const ConfigReader = require("../../ConfigReader");
const { validateAccessToken } = require("../token/TokenMethods");
const dbInterface = new DBInterface();
const configReader = new ConfigReader();

const uuidRegEx = /\b[0-9a-f]{8}\b-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-\b[0-9a-f]{12}\b/;
const emailRegEx = /^\S+@\S+\.\S+$/;

async function get(req, res) {

}

async function post(req, res) {
    if (!requireValues(res, req.body.email, req.body.username, req.body.password)) return;

    try {
        respond(res, 201, {user_id: await createUser(req.body.email, req.body.username, req.body.password)});
    } catch(e) {
        if (typeof e === "number")
            respond(res, e);
        else
            respond(res, 409);
    }
}

async function put(req, res) {
    if (!req.header("Authorization") || !(req.body.username || req.body.password || req.body.email)) {
        respond(res, 400);
        return;
    }

    try {
        let { user_id } = await validateAccessToken(req.header("Authorization"), await dbInterface.getDashboardId());
        if (!user_id) {
            respond(res, 403);
        } else {
            if (req.body.username) await changeUsername(user_id, req.body.username);
            if (req.body.password) await changePassword(user_id, req.body.password);
            if (req.body.email) await changeEmail(user_id, req.body.email);
            respond(res, 200);
        }
    } catch (e) {
        if (typeof e === "number")
            respond(res, e);
        else
            respond(res, 500);
    }
}

async function del(req, res) {
    if (!requireValues(res, req.body.user_id, req.body.password)) return;

    try {
        let results = await dbInterface.query(`SELECT password_hash FROM user WHERE user_id = '${req.body.user_id}'`);
        if (results.length === 0) {
            respond(res, 404);
            return;
        }
        let valid = await bcrypt.compare(req.body.password, results[0].password_hash);
        if (!valid) {
            respond(res, 403);
            return;
        }

        await deleteUser(req.body.user_id);
        respond(res, 200);
    } catch (e) {
        respond(res, 500);
        console.log(e);
    }
}

/**
 * Create a new user
 * @param {string} email 
 * @param {string} username 
 * @param {string} password 
 * @returns {string} user_id
 */
async function createUser(email, username, password) {
    //Is email really an email adress?
    if (!emailRegEx.test(email)) throw 400;
    if (!(!configReader.emailDomain() || !email.endsWith(configReader.emailDomain()))) throw 400;

    //Create password hash
    let password_hash = await bcrypt.hash(password, 12);

    //Create user
    await dbInterface.query(`INSERT INTO user (user_id, email, username, password_hash) VALUES (uuid(), '${email}', '${username}', '${password_hash}')`);
    let user_id = (await dbInterface.query(`SELECT user_id FROM user WHERE email = '${email}'`))[0].user_id;
    return user_id;
}

async function deleteUser(user_id) {
    await dbInterface.query(`DELETE FROM authorization_code WHERE user_id = '${user_id}'`);
    await dbInterface.query(`DELETE FROM access_token WHERE user_id = '${user_id}'`);
    await dbInterface.query(`DELETE FROM refresh_token WHERE user_id = '${user_id}'`);
    await dbInterface.query(`DELETE FROM user WHERE user_id = '${user_id}'`);
}

async function changeUsername(user_id, username) {
    await dbInterface.query(`UPDATE user SET username = '${username}' WHERE user_id = '${user_id}'`);
}

async function changePassword(user_id, password) {
    let password_hash = await bcrypt.hash(password, 12);
    await dbInterface.query(`UPDATE user SET password_hash = '${password_hash}' WHERE user_id = '${user_id}'`);
}

async function changeEmail(user_id, email) {
    await dbInterface.query(`UPDATE user SET email = '${email}' WHERE user_id = '${user_id}'`);
}

async function getUserInfo() {

}

/**
 * Checks if user exists and returns it's user_id
 * @param {string} login - user_id, email or username
 * @param {string} password
 * @returns {string} user_id or empty string
 */
async function validateUser(login, password) {
    let query;
    if (uuidRegEx.test(login))
        query = `SELECT password_hash, user_id FROM user WHERE user_id = '${login}'`;
    else if (emailRegEx.test(login))
        query = `SELECT password_hash, user_id FROM user WHERE email = '${login}'`;
    else
        query = `SELECT password_hash, user_id FROM user WHERE username = '${login}'`;
    
    try {
        let { password_hash, user_id } = (await dbInterface.query(query))[0];
        if (await bcrypt.compare(password, password_hash))
            return user_id;
        else
            return "";
    } catch (e) {
        return "";
    }
}

module.exports = { post, put, del, validateUser, createUser, deleteUser, changeUsername, changePassword, changeEmail };