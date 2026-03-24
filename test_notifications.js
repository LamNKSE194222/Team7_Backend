const axios = require('axios');
const io = require('socket.io-client');

async function testNotifications() {
    try {
        // 1. Login as franchise staff
        console.log('Logging in as franchise staff...');
        const loginResponse = await axios.post('http://localhost:8000/api/auth/login', {
            email: 'storestaff1@moon.vn',
            password: '123456'
        });

        const token = loginResponse.data.data.token;
        console.log('Login successful, token:', token.substring(0, 20) + '...');

        // 2. Connect socket for franchise
        const socketFranchise = io('http://localhost:8000');
        socketFranchise.on('connect', () => {
            console.log('Franchise socket connected');
            // Join franchise room (assuming franchise_store_id = 1)
            socketFranchise.emit('join', { role: 'franchise', id: 1 });
        });

        socketFranchise.on('notification', (data) => {
            console.log('Franchise received notification:', data);
        });

        // 3. Connect socket for central kitchen
        const socketCentral = io('http://localhost:8000');
        socketCentral.on('connect', () => {
            console.log('Central Kitchen socket connected');
            // Join central kitchen room (assuming central_kitchen_id = 2)
            socketCentral.emit('join', { role: 'central_kitchen', id: 2 });
        });

        socketCentral.on('notification', (data) => {
            console.log('Central Kitchen received notification:', data);
        });

        // Wait for connections
        await new Promise(resolve => setTimeout(resolve, 2000));

        // 4. Create order
        console.log('Creating order...');
        const orderResponse = await axios.post('http://localhost:8000/api/orders', {
            desired_date: '2026-03-25',
            note: 'Test order for notifications',
            items: [
                { product_id: 1, qty: 2 },
                { product_id: 2, qty: 1 }
            ]
        }, {
            headers: { Authorization: `Bearer ${token}` }
        });

        console.log('Order created:', orderResponse.data.data.order_code);

        // Wait for notification
        await new Promise(resolve => setTimeout(resolve, 3000));

        // 5. Login as kitchen staff and complete order
        console.log('Logging in as kitchen staff...');
        const kitchenLoginResponse = await axios.post('http://localhost:8000/api/auth/login', {
            email: 'kitchen1@moon.vn',
            password: '123456'
        });

        const kitchenToken = kitchenLoginResponse.data.data.token;
        console.log('Kitchen login successful');

        // Get orders for kitchen
        const ordersResponse = await axios.get('http://localhost:8000/api/centralKitchen/View_orders', {
            headers: { Authorization: `Bearer ${kitchenToken}` }
        });

        const pendingOrders = ordersResponse.data.data.filter(order => order.status === 'processing');
        if (pendingOrders.length > 0) {
            const orderToComplete = pendingOrders[0];
            console.log('Completing order:', orderToComplete.order_code);

            await axios.post(`http://localhost:8000/api/centralKitchen/orders/${orderToComplete.order_id}/ready-to-deliver`, {}, {
                headers: { Authorization: `Bearer ${kitchenToken}` }
            });

            console.log('Order completed');
        } else {
            console.log('No processing orders found');
        }

        // Wait for notification
        await new Promise(resolve => setTimeout(resolve, 3000));

    } catch (error) {
        console.error('Test error:', error.response?.data || error.message);
    }
}

testNotifications();