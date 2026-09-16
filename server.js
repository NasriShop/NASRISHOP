const express = require('express');
const mysql = require('mysql2');
const path = require('path');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;

const app = express();
const PORT = process.env.PORT || 10000;

// زيادة السعة وزيادة الأمان
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// إعداد Cloudinary بالمفاتيح الخاصة بك
cloudinary.config({
  cloud_name: 'qayjuotr',
  api_key: '843371167692472',
  api_secret: 'PMRBy_15CWmnua52xFZMUsxEWkw'
});

const upload = multer({ 
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 } // limit 10MB per file
});

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

// التأكد من وجود الجداول لتفادي خطأ 500
const initDB = () => {
    const createProductsTable = `
        CREATE TABLE IF NOT EXISTS products (
            id INT AUTO_INCREMENT PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            category VARCHAR(100),
            price DECIMAL(10, 2) NOT NULL,
            old_price DECIMAL(10, 2) DEFAULT 0,
            image_url LONGTEXT,
            badge VARCHAR(50),
            description TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );`;

    const createOrdersTable = `
        CREATE TABLE IF NOT EXISTS orders (
            id INT AUTO_INCREMENT PRIMARY KEY,
            customer_name VARCHAR(255) NOT NULL,
            phone VARCHAR(50) NOT NULL,
            wilaya VARCHAR(100) NOT NULL,
            baladia VARCHAR(100) NOT NULL,
            product_name VARCHAR(255) NOT NULL,
            price DECIMAL(10, 2) DEFAULT 0,
            shipping_price DECIMAL(10, 2) DEFAULT 0,
            total_price DECIMAL(10, 2) DEFAULT 0,
            shipping_type VARCHAR(50),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );`;

    db.query(createProductsTable, (err) => {
        if (err) console.error('❌ Products Table Error:', err.message);
        else console.log('✅ Products Table Ready');
    });

    db.query(createOrdersTable, (err) => {
        if (err) console.error('❌ Orders Table Error:', err.message);
        else console.log('✅ Orders Table Ready');
    });
};

db.getConnection((err, connection) => {
    if (!err) {
        connection.release();
        initDB();
    }
});

// ================= API ENDPOINTS =================

// 1. جلب المنتجات مع معالجة حقول الصورة والاسم
const handleGetProducts = (req, res) => {
    db.query('SELECT * FROM products ORDER BY id DESC', (err, results) => {
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

app.get('/api/products', handleGetProducts);
app.get('/api/admin/products', handleGetProducts);

// 2. إضافة منتج مع دعم الرفع السحابي والمباشر معاً
const handleAddProduct = async (req, res) => {
    try {
        let name = req.body.name || req.body.title || req.body.product_name || 'منتج جديد';
        let category = req.body.category || 'عام';
        let price = req.body.price || 0;
        let old_price = req.body.old_price || req.body.oldPrice || 0;
        let badge = req.body.badge || '';
        let description = req.body.description || '';
        let image_url = req.body.image_url || req.body.image || '';

        // إذا تم رفع ملف صورة من الجهاز
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
        // إذا أُرسلت الصورة كـ Base64 ضخمة من الواجهة
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
        console.error('Error adding product:', error);
        res.status(500).json({ error: 'حدث خطأ أثناء حفظ المنتج أو رفع الصورة' });
    }
};

app.post('/api/products', upload.single('image_file'), handleAddProduct);
app.post('/api/admin/products', upload.single('image_file'), handleAddProduct);

// 3. إدارة الطلبات
app.post('/api/orders', (req, res) => {
    const customer_name = req.body.customer_name || req.body.name || 'زبون';
    const phone = req.body.phone || '';
    const wilaya = req.body.wilaya || '';
    const baladia = req.body.baladia || '';
    const product_name = req.body.product_name || req.body.product || 'منتج';
    const price = req.body.price || 0;
    const shipping_price = req.body.shipping_price || 0;
    const total_price = req.body.total_price || req.body.total || 0;
    const shipping_type = req.body.shipping_type || 'home';

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
// مسار مؤقت لمسح المنتجات القديمة الثقيلة
app.get('/api/clear-products', (req, res) => {
    db.query('TRUNCATE TABLE products', (err) => {
        if (err) return res.status(500).send('❌ خطأ: ' + err.message);
        res.send('✅ تم مسح جميع المنتجات القديمة بنجاح! يمكنك الآن إضافة منتجات جديدة.');
    });
});
app.listen(PORT, () => console.log(`🚀 NasriShop Server Running on Port ${PORT}`));
