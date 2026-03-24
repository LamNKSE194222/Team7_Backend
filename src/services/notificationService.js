const pool = require('../config/database');

class NotificationService {
    constructor(io) {
        this.io = io;
    }

    // Thông báo cho Central Kitchen khi có đơn hàng mới
    async notifyNewOrder(orderId) {
        try {
            // Lấy thông tin đơn hàng
            const orderRs = await pool.query(
                `
                SELECT
                    o.order_id,
                    o.order_code,
                    o.created_at,
                    o.desired_date,
                    fs.name AS franchise_store_name,
                    fs.franchise_store_id,
                    ck.central_kitchen_id,
                    COUNT(oi.product_id) AS total_items,
                    SUM(oi.qty) AS total_qty
                FROM orders o
                JOIN franchise_store fs ON fs.franchise_store_id = o.franchise_store_id
                JOIN central_kitchen ck ON ck.central_kitchen_id = o.central_kitchen_id
                LEFT JOIN order_item oi ON oi.order_id = o.order_id
                WHERE o.order_id = $1
                GROUP BY o.order_id, fs.name, fs.franchise_store_id, ck.central_kitchen_id
                `,
                [orderId]
            );

            if (orderRs.rows.length === 0) return;

            const order = orderRs.rows[0];

            const notification = {
                type: 'new_order',
                message: `Đơn hàng mới từ ${order.franchise_store_name}`,
                data: {
                    order_id: order.order_id,
                    order_code: order.order_code,
                    franchise_store_name: order.franchise_store_name,
                    total_items: parseInt(order.total_items),
                    total_qty: parseInt(order.total_qty),
                    created_at: order.created_at,
                    desired_date: order.desired_date
                },
                timestamp: new Date()
            };

            // Gửi đến tất cả staff của central kitchen
            this.io.to(`central_kitchen_${order.central_kitchen_id}`).emit('notification', notification);

        } catch (error) {
            console.error('Error sending new order notification:', error);
        }
    }

    // Thông báo cho Franchise khi đơn hàng đã hoàn thành
    async notifyOrderCompleted(orderId) {
        try {
            // Lấy thông tin đơn hàng
            const orderRs = await pool.query(
                `
                SELECT
                    o.order_id,
                    o.order_code,
                    o.fulfilled_at,
                    fs.franchise_store_id,
                    fs.name AS franchise_store_name,
                    ck.name AS central_kitchen_name
                FROM orders o
                JOIN franchise_store fs ON fs.franchise_store_id = o.franchise_store_id
                JOIN central_kitchen ck ON ck.central_kitchen_id = o.central_kitchen_id
                WHERE o.order_id = $1
                `,
                [orderId]
            );

            if (orderRs.rows.length === 0) return;

            const order = orderRs.rows[0];

            const notification = {
                type: 'order_completed',
                message: `Đơn hàng ${order.order_code} đã sẵn sàng giao`,
                data: {
                    order_id: order.order_id,
                    order_code: order.order_code,
                    central_kitchen_name: order.central_kitchen_name,
                    fulfilled_at: order.fulfilled_at
                },
                timestamp: new Date()
            };

            // Gửi đến franchise store
            this.io.to(`franchise_${order.franchise_store_id}`).emit('notification', notification);

        } catch (error) {
            console.error('Error sending order completed notification:', error);
        }
    }
}

module.exports = NotificationService;