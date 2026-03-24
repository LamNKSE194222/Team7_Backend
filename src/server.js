require("dotenv").config();
const express = require("express");
const cors = require("cors");
const swaggerJSDoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');
const path = require("path");
const http = require("http");
const socketIo = require("socket.io");

const apiRoutes = require("./routes/api");
const NotificationService = require("./services/notificationService");

const port = process.env.PORT || 8001;

const options = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'API for Franchise store project',
            version: '1.0.0'
        },
        servers: [
            { url: 'https://franchisemooncake.onrender.com' },
            { url: `http://localhost:${port}` },
        ]
    },
    apis: [path.join(__dirname, "./routes/*.js")]
}

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*", // Cho phép tất cả origins, có thể cấu hình cụ thể hơn
        methods: ["GET", "POST"]
    }
});

const swaggerSpec = swaggerJSDoc(options)
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec))


app.use(cors());
app.use(express.json())
app.use("/api", apiRoutes)
app.use("/", apiRoutes)

// Lưu io instance để sử dụng trong controllers
app.set('io', io);
app.set('notificationService', new NotificationService(io));

// Socket.io connection
io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    // Join room dựa trên role và id
    socket.on('join', (data) => {
        const { role, id } = data;
        if (role && id) {
            socket.join(`${role}_${id}`);
            console.log(`User joined room: ${role}_${id}`);
        }
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
    });
});

server.listen(port, () => console.log("API running on", port));