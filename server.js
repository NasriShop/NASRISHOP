const express = require('express');
const mysql = require('mysql2');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 10000;

// Middleware لتمرير البيانات كـ JSON ومعالجة Form Data
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// خدمة الملفات الثابتة من مجلد public
app.use(express.static(path.join(__dirname, 'public')));

// إعداد اتصال قاعدة البيانات MySQL المباشر بخادم Aiven مع دعم تشفير SSL
const db = mysql.createPool({
    host: 'nasri-mysql-zoubirimp2026-288b.b.aivencloud.com',
    port: 18434,
    user: 'avnadmin',
    password: process.env.DB_PASSWORD || 'AVNS_rfdqSTbrD91DIqSQtUZ',
    database: process.env.DB_NAME || 'nasrishop_db',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    ssl: {
        rejectUnauthorized: false
    }
});

// اختبار الاتصال بقاعدة البيانات عند بدء التشغيل
db.getConnection((err, connection) => {
    if (err) {
        console.error('❌ خطأ في الاتصال بقاعدة البيانات:', err.message);
    } else {
        console.log('✅ تم الاتصال بقاعدة البيانات بنجاح!');
        connection.release();
    }
});

// ==================== API Endpoints ====================

// 1. جلب جميع المنتجات
app.get('/api/products', (req, res) => {
    const sql = 'SELECT * FROM products ORDER BY id DESC';
    db.query(sql, (err, results) => {
        if (err) {
            console.error('خطأ في جلب المنتجات:', err);
            return res.status(500).json({ error: 'حدث خطأ أثناء جلب المنتجات' });
        }
        res.json(results);
    });
});

// 2. إضافة منتج جديد
app.post('/api/products', (req, res) => {
    const { name, category, price, old_price, image_url, badge, description } = req.body;
    const sql = `INSERT INTO products (name, category, price, old_price, image_url, badge, description) 
                 VALUES (?, ?, ?, ?, ?, ?, ?)`;
    
    db.query(sql, [name, category, price, old_price, image_url, badge, description], (err, result) => {
        if (err) {
            console.error('خطأ في إضافة المنتج:', err);
            return res.status(500).json({ error: err.message });
        }
        res.json({ success: true, message: 'تم حفظ المنتج بنجاح', id: result.insertId });
    });
});

// 3. جلب أسعار التوصيل حسب الولاية
app.get('/api/shipping', (req, res) => {
    const sql = 'SELECT * FROM shipping_rates';
    db.query(sql, (err, results) => {
        if (err) {
            console.error('خطأ في جلب أسعار التوصيل:', err);
            return res.status(500).json({ error: 'حدث خطأ أثناء جلب أسعار التوصيل' });
        }
        res.json(results);
    });
});

// 4. تحديث سعر التوصيل لولاية معينة
app.post('/api/shipping/update', (req, res) => {
    const { wilaya_id, home_price, desk_price } = req.body;
    const sql = `UPDATE shipping_rates SET home_price = ?, desk_price = ? WHERE wilaya_id = ?`;
    
    db.query(sql, [home_price, desk_price, wilaya_id], (err, result) => {
        if (err) {
            console.error('خطأ في تحديث أسعار التوصيل:', err);
            return res.status(500).json({ error: err.message });
        }
        res.json({ success: true, message: 'تم تحديث أسعار التوصيل بنجاح' });
    });
});

// 5. استقبال طلب جديد من الزبون
app.post('/api/orders', (req, res) => {
    const { customer_name, phone, wilaya, baladia, product_name, price, shipping_price, total_price, shipping_type } = req.body;
    const sql = `INSERT INTO orders (customer_name, phone, wilaya, baladia, product_name, price, shipping_price, total_price, shipping_type, created_at) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`;
    
    db.query(sql, [customer_name, phone, wilaya, baladia, product_name, price, shipping_price, total_price, shipping_type], (err, result) => {
        if (err) {
            console.error('خطأ في تسجيل الطلب:', err);
            return res.status(500).json({ error: err.message });
        }
        res.json({ success: true, message: 'تم تسجيل الطلب بنجاح', orderId: result.insertId });
    });
});

// 6. جلب قائمة الطلبات للوحة التحكم
app.get('/api/orders', (req, res) => {
    const sql = 'SELECT * FROM orders ORDER BY id DESC';
    db.query(sql, (err, results) => {
        if (err) {
            console.error('خطأ في جلب الطلبات:', err);
            return res.status(500).json({ error: 'حدث خطأ أثناء جلب الطلبات' });
        }
        res.json(results);
    });
});

// توجيه باقي المسارات إلى الصفحة الرئيسية index.html
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// تشغيل الخادم
app.listen(PORT, () => {
    console.log(`🚀 السيرفر يعمل بنجاح على المنفذ: ${PORT}`);
});
