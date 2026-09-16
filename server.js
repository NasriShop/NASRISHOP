const express = require('express');
const mysql = require('mysql2');
const path = require('path');
const multer = require('multer');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 10000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// إنشاء مجلد حفظ الصور إذا لم يكن موجوداً
const uploadDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// إعداد نظام رفع الصور المباشر والسريع
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname.replace(/\s+/g, '_'))
});
const upload = multer({ storage: storage });

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

// ================= API Endpoints =================

// 1. جلب المنتجات
app.get(['/api/products', '/api/admin/products'], (req, res) => {
    db.query('SELECT * FROM products ORDER BY id DESC', (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(results);
    });
});

// 2. إضافة منتج مع رفع صورة من الجهاز مباشرة وبسرعة فايقة
app.post(['/api/products', '/api/admin/products'], upload.single('image_file'), (req, res) => {
    const name = req.body.name || req.body.title || 'منتج جديد';
    const category = req.body.category || 'عام';
    const price = req.body.price || 0;
    const old_price = req.body.old_price || 0;
    const badge = req.body.badge || '';
    const description = req.body.description || '';
    
    // إذا تم رفع ملف صورة نأخذ مسارها، وإلا نأخذ الرابط النصي
    let image_url = req.body.image_url || '';
    if (req.file) {
        image_url = `/uploads/${req.file.filename}`;
    }

    const sql = `INSERT INTO products (name, category, price, old_price, image_url, badge, description) VALUES (?, ?, ?, ?, ?, ?, ?)`;
    db.query(sql, [name, category, price, old_price, image_url, badge, description], (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true, message: 'تم حفظ المنتج بنجاح', id: result.insertId });
    });
});

// 3. استقبال الطلبات
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

app.listen(PORT, () => console.log(`🚀 السيرفر يعمل بنجاح على المنفذ: ${PORT}`));
