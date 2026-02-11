const { Pool } = require("pg");
const connectionString = process.env.DATABASE_URL;
// const pool = new Pool({
//   host: process.env.DB_HOST,
//   port: Number(process.env.DB_PORT || 5432),
//   user: process.env.DB_USER,
//   password: process.env.DB_PASSWORD,
//   database: process.env.DB_NAME,
// });

const useSSL =
  process.env.NODE_ENV === "production" ||
  process.env.PGSSLMODE === "require";

const pool = new Pool({
  connectionString,
  ssl: useSSL ? { rejectUnauthorized: false } : false,
});

pool.on("error", (err) => {
  console.error("Unexpected PG pool error:", err);
});

module.exports = pool;