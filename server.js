const express = require('express');
const mysql = require('mysql2');
const path = require('path');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;

const app = express();
const PORT = process.env.PORT || 10000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// إعداد Cloudinary بالمفاتيح الخاصة بك
cloudinary.config({
  cloud_name: 'qayjuotr',
  api_key: '843371167692472',
  api_secret: 'PMRBy_15CWmnua52xFZMUsxEWkw'
});

const upload = multer({ storage: multer.memoryStorage() });

// الاتصال بقاعدة البيانات Aiven
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

// 1. جلب المنتجات
app.get(['/api/products', '/api/admin/products'], (req, res) => {
    db.query('SELECT * FROM products ORDER BY id DESC', (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});

// 2. رفع الصورة سحابياً بلمح البصر وحفظ الرابط القصير فقط
app.post(['/api/products', '/api/admin/products'], upload.single('image_file'), async (req, res) => {
    try {
        const name = req.body.name || req.body.title || 'منتج جديد';
        const category = req.body.category || 'عام';
        const price = req.body.price || 0;
        const old_price = req.body.old_price || 0;
        const badge = req.body.badge || '';
        const description = req.body.description || '';
        let image_url = req.body.image_url || '';

        if (req.file) {
            const result = await new Promise((resolve, reject) => {
                const stream = cloudinary.uploader.upload_stream(
                    { folder: 'nasrishop' },
                    (error, result) => { if (result) resolve(result); else reject(error); }
                );
                stream.end(req.file.buffer);
            });
            image_url = result.secure_url;
        }

        const sql = `INSERT INTO products (name, category, price, old_price, image_url, badge, description) VALUES (?, ?, ?, ?, ?, ?, ?)`;
        db.query(sql, [name, category, price, old_price, image_url, badge, description], (err, result) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true, message: 'تم حفظ المنتج بنجاح', id: result.insertId });
        });
    } catch (error) {
        console.error('خطأ في رفع الصورة:', error);
        res.status(500).json({ error: 'فشل في رفع الصورة' });
    }
});

// 3. استقبال وتسجيل الطلبات
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

app.listen(PORT, () => console.log(`🚀 السيرفر يعمل على المنفذ: ${PORT}`));
