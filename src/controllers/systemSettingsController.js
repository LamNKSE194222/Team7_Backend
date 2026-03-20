const fs = require('fs').promises;
const path = require('path');

const dataDir = path.join(__dirname, '..', 'data');
const settingsFile = path.join(dataDir, 'systemSettings.json');

const DEFAULT_SETTINGS = {
    company_name: 'Banh Trung Thu Viet Nam',
    timezone: 'Asia/Ho_Chi_Minh',
    currency: 'VND',
    notifications: {
        low_stock_alert: true,
        order_status_change_alert: true,
        expiry_alert: true
    },
    email_config: {
        smtp_host: 'smtp.example.com',
        smtp_port: 587,
        smtp_user: 'user@example.com',
        smtp_password: '',
        from_email: 'noreply@banhtrungthuvn.com'
    },
    security: {
        two_factor_auth: false,
        auto_logout: true,
        session_timeout_minutes: 60
    }
};

async function ensureSettingsFile() {
    try {
        await fs.mkdir(dataDir, { recursive: true });
        await fs.access(settingsFile);
    } catch (err) {
        if (err.code === 'ENOENT') {
            await fs.writeFile(settingsFile, JSON.stringify(DEFAULT_SETTINGS, null, 2));
        } else {
            throw err;
        }
    }
}

async function loadSettings() {
    await ensureSettingsFile();
    const json = await fs.readFile(settingsFile, 'utf8');
    try {
        const data = JSON.parse(json);
        return Object.assign({}, DEFAULT_SETTINGS, data);
    } catch (err) {
        return DEFAULT_SETTINGS;
    }
}

async function saveSettings(settings) {
    await ensureSettingsFile();
    const next = Object.assign({}, DEFAULT_SETTINGS, settings);
    await fs.writeFile(settingsFile, JSON.stringify(next, null, 2));
    return next;
}

async function getSystemSettings(req, res) {
    try {
        const settings = await loadSettings();
        return res.json({ success: true, data: settings, message: null });
    } catch (e) {
        console.error('SYSTEM SETTINGS LOAD ERROR:', e);
        return res.status(500).json({ success: false, data: null, message: 'Server/DB error' });
    }
}

async function updateSystemSettings(req, res) {
    try {
        const payload = req.body || {};
        const current = await loadSettings();
        const next = {
            ...current,
            ...payload,
            notifications: {
                ...current.notifications,
                ...((payload.notifications && typeof payload.notifications === 'object') ? payload.notifications : {})
            },
            email_config: {
                ...current.email_config,
                ...((payload.email_config && typeof payload.email_config === 'object') ? payload.email_config : {})
            },
            security: {
                ...current.security,
                ...((payload.security && typeof payload.security === 'object') ? payload.security : {})
            }
        };

        const persisted = await saveSettings(next);
        return res.json({ success: true, data: persisted, message: 'Cập nhật cài đặt hệ thống thành công' });
    } catch (e) {
        console.error('SYSTEM SETTINGS UPDATE ERROR:', e);
        return res.status(500).json({ success: false, data: null, message: 'Server/DB error' });
    }
}

module.exports = { getSystemSettings, updateSystemSettings };
