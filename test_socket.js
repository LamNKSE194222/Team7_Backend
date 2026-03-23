const io = require('socket.io-client');

// Test client cho Central Kitchen
const socketCentral = io('http://localhost:8001');

// Test client cho Franchise
const socketFranchise = io('http://localhost:8001');

socketCentral.on('connect', () => {
    console.log('Central Kitchen connected:', socketCentral.id);
    // Join room central_kitchen_2 (giả sử central_kitchen_id = 2)
    socketCentral.emit('join', { role: 'central_kitchen', id: 2 });
});

socketFranchise.on('connect', () => {
    console.log('Franchise connected:', socketFranchise.id);
    // Join room franchise_1 (giả sử franchise_store_id = 1)
    socketFranchise.emit('join', { role: 'franchise', id: 1 });
});

socketCentral.on('notification', (data) => {
    console.log('Central Kitchen received notification:', data);
});

socketFranchise.on('notification', (data) => {
    console.log('Franchise received notification:', data);
});

socketCentral.on('disconnect', () => {
    console.log('Central Kitchen disconnected');
});

socketFranchise.on('disconnect', () => {
    console.log('Franchise disconnected');
});

// Giữ connection
setInterval(() => {
    console.log('Connections active...');
}, 10000);