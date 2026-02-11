require("dotenv").config();
const bcrypt = require("bcrypt");
const pool = require("../config/database");

async function setPassword(email, password) {
    const hash = await bcrypt.hash(password, 10);

    await pool.query(
        `UPDATE "user" SET password=$1 WHERE email=$2`,
        [hash, email]
    );

    console.log(`✅ Password updated for ${email}`);
}

async function main() {
    await setPassword("storestaff1@moon.vn", "123456");
    await setPassword("kitchen1@moon.vn", "123456");

    process.exit(0);
}

main().catch(console.error);
