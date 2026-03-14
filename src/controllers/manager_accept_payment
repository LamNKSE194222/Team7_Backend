const pool = require("../config/database");

async function confirmPaymentOrder(req, res) {
    try {
        const { orderId } = req.params;

        if (!orderId || isNaN(orderId)) {
            return res.status(400).json({
                success: false,
                message: "orderId không hợp lệ"
            });
        }

        const rs = await pool.query(
            `
            UPDATE orders
            SET
                payment_status = 'paid',
                paid_at = NOW()
            WHERE order_id = $1
              AND status = 'confirmed'
              AND COALESCE(payment_status, 'unpaid') = 'unpaid'
            RETURNING
                order_id,
                order_code,
                status,
                payment_status,
                paid_at,
                created_at
            `,
            [orderId]
        );

        if (rs.rows.length === 0) {
            return res.status(400).json({
                success: false,
                message: "Chỉ có thể xác nhận thanh toán cho đơn thuộc cửa hàng của bạn, đang ở trạng thái approved và chưa thanh toán"
            });
        }

        return res.json({
            success: true,
            message: "Xác nhận thanh toán thành công",
            data: rs.rows[0]
        });

    } catch (e) {
        console.error("CONFIRM PAYMENT ERROR:", e);
        return res.status(500).json({
            success: false,
            message: "Server error"
        });
    }
}

module.exports = { confirmPaymentOrder };