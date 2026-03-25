let ioInstance = null;

function initSocket(io) {
    ioInstance = io;

    io.on("connection", (socket) => {
        socket.on("join", ({ user_id }) => {
            if (user_id) {
                socket.join(`user_${user_id}`);
            }
        });
    });
}

function getIO() {
    if (!ioInstance) {
        throw new Error("Socket.io chưa được khởi tạo");
    }
    return ioInstance;
}

module.exports = { initSocket, getIO };