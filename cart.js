// Simple product generator + cart stored in localStorage
const PRODUCTS_COUNT = 12;
const PRICE_MIN = 2.5;
const PRICE_MAX = 29.99;

const productsEl = document.getElementById('products');
const tpl = document.getElementById('product-tpl');
const cartCountEl = document.getElementById('cart-count');

function rand(min, max) {
  return (Math.random() * (max - min) + min);
}

function rndName() {
  const adj = ['Fresh','Spicy','Crispy','Roasted','Organic','Fancy','Premium','Deluxe','Delicious', 'Imported','USA','Vietnam','Sweet'];
  const item = ['Chillis','Almonds','Cookies','Tea','Coffee','Olives','Noodles','Sauce','Apple','Orange','Pear','Pinenapple'];
  return adj[Math.floor(Math.random()*adj.length)] + ' ' + item[Math.floor(Math.random()*item.length)];
}

function buildProducts() {
  const products = [];
  for (let i = 0; i < PRODUCTS_COUNT; i++) {
    products.push({
      id: `p${i+1}`,
      name: rndName(),
      price: Number(rand(PRICE_MIN, PRICE_MAX).toFixed(2)),
      img: `https://picsum.photos/seed/${i+1}/300/300`
    });
  }
  return products;
}

const PRODUCTS = buildProducts();

function renderProducts() {
  productsEl.innerHTML = '';
  PRODUCTS.forEach(p => {
    const node = tpl.content.cloneNode(true);
    node.querySelector('.product-img').src = p.img;
    node.querySelector('.product-img').alt = p.name;
    node.querySelector('.product-name').innerText = p.name;
    node.querySelector('.product-price').innerText = `$${p.price.toFixed(2)}`;
    const btn = node.querySelector('.add-btn');
    btn.addEventListener('click', () => addToCart(p));
    productsEl.appendChild(node);
  });
}

function getCart() {
  try {
    return JSON.parse(localStorage.getItem('cart') || '{}');
  } catch {
    return {};
  }
}

function saveCart(cart) {
  localStorage.setItem('cart', JSON.stringify(cart));
  updateCartCount();
}

function addToCart(product) {
  const cart = getCart();
  if (!cart[product.id]) cart[product.id] = { ...product, qty: 0 };
  cart[product.id].qty += 1;
  saveCart(cart);
}

function updateCartCount() {
  const cart = getCart();
  const count = Object.values(cart).reduce((s, it) => s + (it.qty || 0), 0);
  cartCountEl.innerText = count;
}

// Init
renderProducts();
updateCartCount();
