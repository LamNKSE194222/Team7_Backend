require("dotenv").config();
const express = require("express");
const cors = require("cors");
const pool = require("./config/database");

const apiRoutes = require("./routes/api");


const app = express();
app.use(cors());
app.use(express.json())

app.use("/api", apiRoutes)


const port = process.env.PORT || 8000;
app.listen(port, () => console.log("API running on", port));