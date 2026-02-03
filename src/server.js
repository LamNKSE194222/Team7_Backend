require("dotenv").config();
const express = require("express");
const cors = require("cors");
const pool = require("./config/database");
const swaggerJSDoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');
const path = require("path");


const apiRoutes = require("./routes/api");

const options = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'API for Franchise store project',
            version: '1.0.0'
        },
        servers: [
            {
                url: 'https://franchisemooncake.onrender.com'
            }
        ]
    },
    apis: [path.join(__dirname, "./routes/*.js")]
}

const app = express();

const swaggerSpec = swaggerJSDoc(options)
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec))


app.use(cors());
app.use(express.json())

app.use("/api", apiRoutes)


const port = process.env.PORT || 8001;
app.listen(port, () => console.log("API running on", port));