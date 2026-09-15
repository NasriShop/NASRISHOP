const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();

app.use(cors());
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ limit: '100mb', extended: true }));
app.use(express.static('public'));

const uploadDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const db = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'nasrishop_db',
    port: process.env.DB_PORT || 3306,
    waitForConnections: true,
    connectionLimit: 10
});

app.get('/api/products', (req, res) => {
    db.query('SELECT * FROM products ORDER BY id DESC', (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});

app.get('/api/admin/orders', (req, res) => {
    const password = req.headers['x-admin-password'];
    if (password !== 'NABILAhammam1988') {
        return res.status(401).json({ error: 'كلمة المرور غير صحيحة' });
    }

    const { startDate, endDate, filterType } = req.query;
    let query = 'SELECT * FROM orders';
    let queryParams = [];

    if (filterType === 'today') {
        query += ' WHERE DATE(created_at) = CURDATE()';
    } else if (filterType === 'range' && startDate && endDate) {
        query += ' WHERE DATE(created_at) BETWEEN ? AND ?';
        queryParams = [startDate, endDate];
    }

    query += ' ORDER BY id DESC';

    db.query(query, queryParams, (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});

app.get('/api/shipping', (req, res) => {
    db.query('SELECT * FROM shipping_rates', (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});

app.post('/api/admin/shipping', (req, res) => {
    const { wilayaName, homePrice, deskPrice, password } = req.body;
    if (password !== 'NABILAhammam1988') {
        return res.status(401).json({ error: 'كلمة المرور غير صحيحة' });
    }

    const query = `INSERT INTO shipping_rates (wilaya_name, home_price, desk_price) 
                   VALUES (?, ?, ?) 
                   ON DUPLICATE KEY UPDATE home_price=?, desk_price=?`;
    db.query(query, [wilayaName, homePrice, deskPrice, homePrice, deskPrice], (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

app.post('/api/admin/products', (req, res) => {
    const { title, category, price, oldPrice, img, badge, htmlDesc, password } = req.body;
    if (password !== 'NABILAhammam1988') {
        return res.status(401).json({ error: 'كلمة المرور غير صحيحة' });
    }

    let imagePath = img;
    if (img && img.startsWith('data:image')) {
        const matches = img.match(/^data:image\/([a-zA-Z]+);base64,(.+)$/);
        if (matches) {
            const ext = matches[1] === 'jpeg' ? 'jpg' : matches[1];
            const filename = `prod_${Date.now()}.${ext}`;
            fs.writeFileSync(path.join(uploadDir, filename), matches[2], 'base64');
            imagePath = `/uploads/${filename}`;
        }
    }

    const query = `INSERT INTO products (title, category, price, old_price, image_url, badge, html_desc) VALUES (?, ?, ?, ?, ?, ?, ?)`;
    db.query(query, [title, category, price, oldPrice || null, imagePath, badge, htmlDesc], (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true, id: result.insertId });
    });
});

app.post('/api/orders', (req, res) => {
    const { name, phone, wilaya, commune, shipType, totalPrice } = req.body;
    const query = `INSERT INTO orders (customer_name, phone, wilaya, commune, ship_type, total_price) VALUES (?, ?, ?, ?, ?, ?)`;
    db.query(query, [name, phone, wilaya, commune, shipType, totalPrice], (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true, orderId: result.insertId });
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 السيرفر يعمل بنجاح على المنفذ: ${PORT}`));