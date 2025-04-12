
const API_URL = 'http://localhost:3000';
let currentUser = { id: 1 }; // 假設固定用戶 ID

async function loadProducts() {
    try {
        const response = await fetch(`${API_URL}/products`);
        if (!response.ok) {
            throw new Error(`商品加載失敗：HTTP 狀態 ${response.status}`);
        }
        const products = await response.json();
        const productList = document.getElementById('product-list');

        if (!products || products.length === 0) {
            productList.innerHTML = '<p>目前無商品可用</p>';
            return;
        }

        productList.innerHTML = products.map(product => `
            <div>
                <h3>${product.name} - ${product.price} 檜木</h3>
                <img src="${API_URL}${product.imageUrl}" width="100">
                <button onclick="addToCart(${product.id})">加入購物車</button>
            </div>
        `).join('');
    } catch (error) {
        console.error('商品加載失敗:', error.message);
        alert(`商品加載失敗：${error.message}`);
    }
}

async function addToCart(productId) {
    const quantity = parseInt(document.getElementById(`quantity-${productId}`).value);
    if (!quantity || quantity < 1) {
        alert('數量必須至少為 1！');
        return;
    }

    await fetch(`${API_URL}/cart/add`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUser.id, productId, quantity })
    });

    await loadCart();
}

async function loadCart() {
    try {
        const response = await fetch(`${API_URL}/cart/${currentUser.id}`);
        if (!response.ok) {
            throw new Error(`無法獲取購物車內容：HTTP 狀態 ${response.status}`);
        }

        const cartData = await response.json();
        const cartList = document.getElementById('cart-list');
        const cartTotal = document.getElementById('cart-total');

        // 檢查購物車是否為空
        if (!cartData.cart || cartData.cart.length === 0) {
            cartList.innerHTML = '<li style="color: gray;">購物車為空</li>';
            cartTotal.innerHTML = '總金額：0 檜木';
            return;
        }

        // 渲染購物車內容
        cartList.innerHTML = cartData.cart.map(item => `
            <li>
                ${item.name} - 單價：${item.price} 檜木 數量：${item.quantity} 總價：${item.totalPrice} 檜木
            </li>
        `).join('');
        cartTotal.innerHTML = `總金額：${cartData.totalAmount} 檜木`;

    } catch (error) {
        console.error('購物車加載失敗:', error.message);
        document.getElementById('cart-list').innerHTML = '<li style="color: gray;">購物車為空</li>';
        document.getElementById('cart-total').innerHTML = '總金額：0 檜木';
        alert(`購物車加載失敗：${error.message}`);
    }
}

async function updateCart(productId, newQuantity) {
    if (newQuantity < 1) {
        alert('商品數量不能少於 1！');
        return;
    }

    await fetch(`${API_URL}/cart/add`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUser.id, productId, quantity: newQuantity })
    });

    await loadCart();
}

async function clearCart() {
    await fetch(`${API_URL}/cart/${currentUser.id}`, { method: 'DELETE' });
    await loadCart();
}

async function checkout() {
    const response = await fetch(`${API_URL}/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUser.id })
    });

    const result = await response.json();
    if (!response.ok) {
        throw new Error(result.message);
    }

    alert(`交易成功！剩餘檜木：${result.balance}`);
    await loadCart();
}

async function init() {
    await loadProducts();
    await loadCart();
}
init();