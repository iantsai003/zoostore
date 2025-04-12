const express = require('express');
const bodyParser = require('body-parser');
const multer = require('multer');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(bodyParser.json());
app.use(cors());

// 文件存儲路徑
const uploadsPath = path.join(__dirname, 'uploads');
const usersFilePath = path.join(__dirname, 'users.json');
const transactionsFilePath = path.join(__dirname, 'transactions.json');
const cartFilePath = path.join(__dirname, 'cart.json');
const productsFilePath = path.join(__dirname, 'products.json');

// 檢查並初始化資料夾
if (!fs.existsSync(uploadsPath)) {
    fs.mkdirSync(uploadsPath);
}
app.use('/uploads', express.static(uploadsPath));

// 初始化資料
let users = [];
let transactions = [];
let cart = {};
let products = [];

// 從文件載入資料
if (fs.existsSync(usersFilePath)) {
    users = JSON.parse(fs.readFileSync(usersFilePath, 'utf-8'));
}
if (fs.existsSync(transactionsFilePath)) {
    transactions = JSON.parse(fs.readFileSync(transactionsFilePath, 'utf-8'));
}
if (fs.existsSync(cartFilePath)) {
    cart = JSON.parse(fs.readFileSync(cartFilePath, 'utf-8'));
}
if (fs.existsSync(productsFilePath)) {
    products = JSON.parse(fs.readFileSync(productsFilePath, 'utf-8'));
}

let nextUserId = users.length > 0 ? Math.max(...users.map(u => u.id)) + 1 : 1;

// 設定圖片存儲邏輯
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadsPath),
    filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage });

// **用戶相關 API**
app.post('/generate-user', (req, res) => {
    const newUser = { id: nextUserId, name: `客戶${nextUserId}`, balance: 50000 };
    users.push(newUser);
    nextUserId++;

    fs.writeFileSync(usersFilePath, JSON.stringify(users, null, 2));
    res.json(newUser);
    console.log(`新用戶已生成: ${JSON.stringify(newUser)}`);
});

app.get('/balance/:userId', (req, res) => {
    const userId = parseInt(req.params.userId);
    const user = users.find(u => u.id === userId);

    if (!user) {
        return res.status(404).json({ message: '用戶不存在' });
    }

    res.json(user);
});

// **商品相關 API**
app.get('/products', (req, res) => res.json(products));

app.post('/products', upload.single('image'), (req, res) => {
    const { name, price } = req.body;
    const imageUrl = req.file ? `/uploads/${req.file.filename}` : null;

    if (!name || !price || !imageUrl) {
        return res.status(400).json({ message: '請提供完整的商品資訊（名字、價格、圖片）。' });
    }

    const newProduct = { id: products.length + 1, name, price: Number(price), imageUrl };
    products.push(newProduct);
    fs.writeFileSync(productsFilePath, JSON.stringify(products, null, 2));
    res.json({ message: '商品已新增', product: newProduct });
    console.log(`商品已新增: ${JSON.stringify(newProduct)}`);
});

app.delete('/products/:id', (req, res) => {
    const productId = parseInt(req.params.id);
    const productIndex = products.findIndex(product => product.id === productId);

    if (productIndex === -1) {
        return res.status(404).json({ message: '商品不存在，無法刪除。' });
    }

    const deletedProduct = products.splice(productIndex, 1);
    fs.writeFileSync(productsFilePath, JSON.stringify(products, null, 2));

    // 刪除商品圖片
    const imagePath = path.join(__dirname, deletedProduct[0].imageUrl);
    if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath);
    }

    res.json({ message: '商品已成功刪除', product: deletedProduct[0] });
    console.log(`刪除商品: ${JSON.stringify(deletedProduct[0])}`);
});

// **購物車 API**
app.post('/cart/add', (req, res) => {
    const { userId, productId, quantity } = req.body;

    if (!userId || !productId || quantity < 1) {
        return res.status(400).json({ message: '請提供有效的用戶 ID、商品 ID 和數量！' });
    }

    const user = users.find(u => u.id === userId);
    const product = products.find(p => p.id === productId);

    if (!user) {
        return res.status(404).json({ message: '用戶不存在！' });
    }
    if (!product) {
        return res.status(404).json({ message: `商品 ID ${productId} 不存在！` });
    }

    if (!cart[userId]) {
        cart[userId] = [];
    }

    const existingItem = cart[userId].find(item => item.productId === productId);
    if (existingItem) {
        existingItem.quantity += quantity;
    } else {
        cart[userId].push({ productId, quantity });
    }

    fs.writeFileSync(cartFilePath, JSON.stringify(cart, null, 2));
    res.json({ message: '商品已成功加入購物車', cart: cart[userId] });
});
app.delete('/products', (req, res) => {
    const { productIds } = req.body; // 從請求中獲取商品 ID 陣列

    if (!Array.isArray(productIds) || productIds.length === 0) {
        return res.status(400).json({ message: '請提供有效的商品 ID 陣列' });
    }

    // 遍歷 productIds，刪除對應的商品
    const deletedProducts = [];
    for (const productId of productIds) {
        const index = products.findIndex(product => product.id === productId);
        if (index !== -1) {
            deletedProducts.push(products[index]);
            products.splice(index, 1); // 刪除商品
        }
    }

    // 更新文件
    try {
        fs.writeFileSync(productsFilePath, JSON.stringify(products, null, 2));
        res.json({
            message: `成功刪除 ${deletedProducts.length} 個商品`,
            deletedProducts,
        });
        console.log(`已刪除商品: ${JSON.stringify(deletedProducts)}`);
    } catch (error) {
        console.error('刪除商品時發生錯誤:', error.message);
        res.status(500).json({ message: '無法刪除商品，請稍後再試！' });
    }
});
app.get('/cart/:userId', (req, res) => {
    const userId = parseInt(req.params.userId);
    const userCart = cart[userId] || [];

    const cartDetails = userCart.map(item => {
        const product = products.find(p => p.id === item.productId);
        return {
            productId: item.productId,
            name: product?.name || '未知商品',
            price: product?.price || 0,
            quantity: item.quantity,
            totalPrice: product ? product.price * item.quantity : 0
        };
    });

    const totalAmount = cartDetails.reduce((sum, item) => sum + item.totalPrice, 0);
    res.json({ cart: cartDetails, totalAmount });
});

app.delete('/cart/:userId', (req, res) => {
    const userId = parseInt(req.params.userId);
    cart[userId] = [];
    fs.writeFileSync(cartFilePath, JSON.stringify(cart, null, 2));
    res.json({ message: '購物車已清空！' });
});

// **結帳 API**
app.post('/checkout', (req, res) => {
    const { userId } = req.body;
    const user = users.find(u => u.id === userId);
    const userCart = cart[userId];

    if (!user) {
        return res.status(400).json({ message: '用戶不存在' });
    }
    if (!userCart || userCart.length === 0) {
        return res.status(400).json({ message: '購物車為空，無法結帳' });
    }

    let totalPrice = 0;
    const purchasedProducts = [];

    for (const item of userCart) {
        const product = products.find(p => p.id === item.productId);
        if (!product) {
            return res.status(400).json({ message: `商品 ID ${item.productId} 不存在！` });
        }
        const itemTotalPrice = product.price * item.quantity;
        totalPrice += itemTotalPrice;
        purchasedProducts.push({ ...product, quantity: item.quantity, itemTotalPrice });
    }

    if (user.balance >= totalPrice) {
        user.balance -= totalPrice;
        cart[userId] = [];
        const transaction = { userId, products: purchasedProducts, totalPrice, date: new Date() };
        transactions.push(transaction);

        fs.writeFileSync(usersFilePath, JSON.stringify(users, null, 2));
        fs.writeFileSync(transactionsFilePath, JSON.stringify(transactions, null, 2));
        fs.writeFileSync(cartFilePath, JSON.stringify(cart, null, 2));

        res.json({ message: '交易成功', balance: user.balance, purchasedProducts });
    } else {
        res.status(400).json({ message: '餘額不足，無法完成交易' });
    }
});

// **交易記錄 API**
app.get('/transactions/:userId', (req, res) => {
    const userId = parseInt(req.params.userId);
    const userTransactions = transactions.filter(transaction => transaction.userId === userId);
    res.json(userTransactions);
});

// 啟動伺服器
app.listen(3000, () => console.log('伺服器運行於 http://localhost:3000'));
