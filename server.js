const express = require('express');
const mysql = require('mysql2');
const path = require('path');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;

const app = express();
const PORT = process.env.PORT || 10000;

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

cloudinary.config({
  cloud_name: 'qayjuotr',
  api_key: '843371167692472',
  api_secret: 'PMRBy_15CWmnua52xFZMUsxEWkw'
});

const upload = multer({ storage: multer.memoryStorage() });

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

// مسار مسح المنتجات القديمة المكسورة
app.get('/api/clear-products', (req, res) => {
    db.query('TRUNCATE TABLE products', (err) => {
        if (err) return res.status(500).send('❌ خطأ: ' + err.message);
        res.send('<h1>✅ تم مسح جميع المنتجات القديمة بنجاح! افتح المتجر الآن وأضف منتج جديد.</h1>');
    });
});

// جلب المنتجات وتغذية كل مسميات الصور المحتملة في الواجهة
const handleGetProducts = (req, res) => {
    db.query('SELECT * FROM products ORDER BY id DESC', (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        const formatted = results.map(p => {
            const img = p.image_url || p.image || 'https://via.placeholder.com/300?text=No+Image';
            return {
                id: p.id,
                name: p.name || 'منتج',
                title: p.name || 'منتج',
                category: p.category || '',
                price: p.price || 0,
                old_price: p.old_price || 0,
                oldPrice: p.old_price || 0,
                image_url: img,
                image: img,
                imageUrl: img,
                src: img,
                badge: p.badge || '',
                description: p.description || ''
            };
        });
        res.json(formatted);
    });
};

app.get(['/api/products', '/api/admin/products'], handleGetProducts);

// إضافة المنتج مع رفع سحابي مباشر لمعالجة أي ملف أو نص Base64 قادم من الواجهة
const handleAddProduct = async (req, res) => {
    try {
        let name = req.body.name || req.body.title || 'منتج جديد';
        let category = req.body.category || 'عام';
        let price = req.body.price || 0;
        let old_price = req.body.old_price || req.body.oldPrice || 0;
        let badge = req.body.badge || '';
        let description = req.body.description || '';
        let image_url = req.body.image_url || req.body.image || req.body.imageUrl || '';

        if (req.file) {
            const result = await new Promise((resolve, reject) => {
                const stream = cloudinary.uploader.upload_stream(
                    { folder: 'nasrishop' },
                    (error, result) => { if (result) resolve(result); else reject(error); }
                );
                stream.end(req.file.buffer);
            });
            image_url = result.secure_url;
        } else if (image_url && image_url.startsWith('data:image')) {
            const uploaded = await cloudinary.uploader.upload(image_url, { folder: 'nasrishop' });
            image_url = uploaded.secure_url;
        }

        const sql = `INSERT INTO products (name, category, price, old_price, image_url, badge, description) VALUES (?, ?, ?, ?, ?, ?, ?)`;
        db.query(sql, [name, category, price, old_price, image_url, badge, description], (err, result) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true, message: 'تم حفظ المنتج بنجاح', id: result.insertId, image_url });
        });
    } catch (error) {
        res.status(500).json({ error: 'خطأ في رفع الصورة' });
    }
};

app.post(['/api/products', '/api/admin/products'], upload.any(), handleAddProduct);

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
        res.json(results || []);
    });
});

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
