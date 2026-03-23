// Tạo file test_central.js
const io = require('socket.io-client');
const socket = io('http://localhost:8000');

socket.on('connect', () => {
    console.log('Connected');
    socket.emit('join', { role: 'central_kitchen', id: 2 }); // ID của central kitchen
});

socket.on('notification', (data) => {
    console.log('Central Kitchen notification:', JSON.stringify(data, null, 2));
});