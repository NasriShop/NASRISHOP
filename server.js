const express = require('express');
const mysql = require('mysql2');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 10000;

// تحديد حجم البيانات بـ 10MB فقط لمنع البطء
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

const db = mysql.createPool({
    host: 'nasri-mysql-zoubirimp2026-288b.b.aivencloud.com',
    port: 18434,
    user: 'avnadmin',
    password: process.env.DB_PASSWORD || 'AVNS_rfdqSTbrD91DIqSQtUZ',
    database: process.env.DB_NAME || 'nasrishop_db',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    ssl: { rejectUnauthorized: false }
});

// جلب المنتجات بشكل خفيف وسريع
const handleGetProducts = (req, res) => {
    db.query('SELECT id, name, category, price, old_price, image_url, badge, description FROM products ORDER BY id DESC', (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        
        const formatted = results.map(p => ({
            id: p.id,
            name: p.name || 'منتج',
            title: p.name || 'منتج',
            category: p.category || '',
            price: p.price || 0,
            old_price: p.old_price || 0,
            oldPrice: p.old_price || 0,
            image_url: p.image_url || '',
            image: p.image_url || '',
            badge: p.badge || '',
            description: p.description || ''
        }));
        
        res.json(formatted);
    });
};

const handleAddProduct = (req, res) => {
    const name = req.body.name || req.body.title || req.body.product_name || 'منتج جديد';
    const category = req.body.category || 'عام';
    const price = req.body.price || 0;
    const old_price = req.body.old_price || req.body.oldPrice || 0;
    let image_url = req.body.image_url || req.body.image || req.body.imageUrl || '';
    const badge = req.body.badge || '';
    const description = req.body.description || '';

    const sql = `INSERT INTO products (name, category, price, old_price, image_url, badge, description) VALUES (?, ?, ?, ?, ?, ?, ?)`;
    db.query(sql, [name, category, price, old_price, image_url, badge, description], (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true, message: 'تم حفظ المنتج بنجاح', id: result.insertId });
    });
};

app.get('/api/products', handleGetProducts);
app.get('/api/admin/products', handleGetProducts);

app.post('/api/products', handleAddProduct);
app.post('/api/admin/products', handleAddProduct);

// معالجة الطلبات بشكل سريع
app.post('/api/orders', (req, res) => {
    const { customer_name, phone, wilaya, baladia, product_name, price, shipping_price, total_price, shipping_type } = req.body;
    const sql = `INSERT INTO orders (customer_name, phone, wilaya, baladia, product_name, price, shipping_price, total_price, shipping_type) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;
    
    db.query(sql, [customer_name, phone, wilaya, baladia, product_name, price, shipping_price, total_price, shipping_type], (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true, message: 'تم تسجيل الطلب بنجاح', orderId: result.insertId });
    });
});

app.get('/api/orders', (req, res) => {
    db.query('SELECT * FROM orders ORDER BY id DESC', (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`🚀 السيرفر يعمل بنجاح على المنفذ: ${PORT}`);
});
