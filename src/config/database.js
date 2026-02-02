const { Pool } = require("pg");

// const pool = new Pool({
//   host: process.env.DB_HOST,
//   port: Number(process.env.DB_PORT || 5432),
//   user: process.env.DB_USER,
//   password: process.env.DB_PASSWORD,
//   database: process.env.DB_NAME,
// });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production"
    ? { rejectUnauthorized: false }
    : false,
});

pool.on("error", (err) => {
  console.error("Unexpected PG pool error:", err);
});

module.exports = pool;