require("dotenv").config();
const bcrypt = require("bcrypt");
const pool = require("../config/database");

async function main() {
    const email = "storestaff1@moon.vn";
    const plain = "123456";
    const hash = await bcrypt.hash(plain, 10);

    await pool.query(`UPDATE "user" SET password=$1 WHERE email=$2`, [hash, email]);

    console.log("✅ Set password for", email, "password:", plain);
    process.exit(0);
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});

