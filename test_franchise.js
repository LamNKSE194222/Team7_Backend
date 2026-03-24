// Tạo file test_franchise.js  
const io = require('socket.io-client');
const socket = io('http://localhost:8000');

socket.on('connect', () => {
    console.log('Connected');
    socket.emit('join', { role: 'franchise', id: 1 }); // ID của franchise store
});

socket.on('notification', (data) => {
    console.log('Franchise notification:', JSON.stringify(data, null, 2));
});