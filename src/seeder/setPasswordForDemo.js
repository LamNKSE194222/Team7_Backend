require("dotenv").config();
const bcrypt = require("bcrypt");
const pool = require("../config/database");

async function setPassword(email, password) {
    const hash = await bcrypt.hash(password, 10);

    const rs = await pool.query(
        `UPDATE "user" SET password=$1 WHERE email=$2`,
        [hash, email]
    );

    console.log(`✅ ${email}: updated ${rs.rowCount} row(s)`);

    const check = await pool.query(
        `SELECT user_id, email, password FROM "user" WHERE email=$1`,
        [email]
    );
    console.log("CHECK:", check.rows[0]);
}

async function main() {
    await setPassword("storestaff1@moon.vn", "123456");
    await setPassword("kitchen1@moon.vn", "123456");
    await setPassword("admin@moon.vn", "123456");
    await setPassword("manager1@moon.vn", "123456");
    process.exit(0);
}

main().catch(console.error);
