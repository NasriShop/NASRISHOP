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

// مسار تفريغ المنتجات القديمة المكسورة
app.get('/api/clear-products', (req, res) => {
    db.query('TRUNCATE TABLE products', (err) => {
        if (err) return res.status(500).send('❌ خطأ: ' + err.message);
        res.send('<h1>✅ تم مسح جميع المنتجات القديمة بنجاح!</h1>');
    });
});

// جلب المنتجات مع مطابقة كافة حقول الصور
app.get(['/api/products', '/api/admin/products'], (req, res) => {
    db.query('SELECT * FROM products ORDER BY id DESC', (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        const formatted = results.map(p => ({
            id: p.id,
            name: p.name || 'منتج',
            title: p.name || 'منتج',
            category: p.category || '',
            price: p.price || 0,
            old_price: p.old_price || 0,
            image_url: p.image_url || 'https://via.placeholder.com/300',
            image: p.image_url || 'https://via.placeholder.com/300',
            badge: p.badge || '',
            description: p.description || ''
        }));
        res.json(formatted);
    });
});

// إضافة منتج مع رفع سحابي مباشر
app.post(['/api/products', '/api/admin/products'], upload.any(), async (req, res) => {
    try {
        let name = req.body.name || req.body.title || 'منتج جديد';
        let category = req.body.category || 'عام';
        let price = req.body.price || 0;
        let old_price = req.body.old_price || req.body.oldPrice || 0;
        let badge = req.body.badge || '';
        let description = req.body.description || '';
        let image_url = req.body.image_url || req.body.image || '';

        // إذا تم إرسال ملف من الواجهة
        if (req.files && req.files.length > 0) {
            const file = req.files[0];
            const result = await new Promise((resolve, reject) => {
                const stream = cloudinary.uploader.upload_stream(
                    { folder: 'nasrishop' },
                    (error, result) => { if (result) resolve(result); else reject(error); }
                );
                stream.end(file.buffer);
            });
            image_url = result.secure_url;
        } 
        // إذا أُرْسِلَت الصورة كـ Base64
        else if (image_url && image_url.startsWith('data:image')) {
            const uploaded = await cloudinary.uploader.upload(image_url, { folder: 'nasrishop' });
            image_url = uploaded.secure_url;
        }

        const sql = `INSERT INTO products (name, category, price, old_price, image_url, badge, description) VALUES (?, ?, ?, ?, ?, ?, ?)`;
        db.query(sql, [name, category, price, old_price, image_url, badge, description], (err, result) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true, message: 'تم حفظ المنتج بنجاح', id: result.insertId, image_url });
        });
    } catch (error) {
        res.status(500).json({ error: 'خطأ أثناء رفع الصورة' });
    }
});

// خاصية تعديل منتج (UPDATE)
app.put(['/api/products/:id', '/api/admin/products/:id'], upload.any(), async (req, res) => {
    try {
        const id = req.params.id;
        const name = req.body.name || req.body.title;
        const price = req.body.price;
        const old_price = req.body.old_price;
        const category = req.body.category;
        let image_url = req.body.image_url || req.body.image;

        if (req.files && req.files.length > 0) {
            const file = req.files[0];
            const result = await new Promise((resolve, reject) => {
                const stream = cloudinary.uploader.upload_stream(
                    { folder: 'nasrishop' },
                    (error, result) => { if (result) resolve(result); else reject(error); }
                );
                stream.end(file.buffer);
            });
            image_url = result.secure_url;
        }

        const sql = `UPDATE products SET name=?, price=?, old_price=?, category=?, image_url=COALESCE(NULLIF(?, ''), image_url) WHERE id=?`;
        db.query(sql, [name, price, old_price, category, image_url, id], (err) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true, message: 'تم التعديل بنجاح' });
        });
    } catch (error) {
        res.status(500).json({ error: 'خطأ في التعديل' });
    }
});

// خاصية حذف منتج (DELETE)
app.delete(['/api/products/:id', '/api/admin/products/:id'], (req, res) => {
    const id = req.params.id;
    db.query('DELETE FROM products WHERE id = ?', [id], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true, message: 'تم الحذف بنجاح' });
    });
});

// إدارة الطلبات
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

app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

app.listen(PORT, () => console.log(`🚀 Server on port ${PORT}`));
