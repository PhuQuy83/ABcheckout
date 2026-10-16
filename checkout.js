// Checkout page: reads cart, shows summary, handles hosted tokenization (EchelonSecure sandbox v0.3)
const cartSummaryEl = document.getElementById('cart-summary');
const iframeWrap = document.getElementById('iframe-wrap');
const openBtn = document.getElementById('open-tokenizer');
const statusEl = document.getElementById('status');

function getCart() {
  try { return JSON.parse(localStorage.getItem('cart') || '{}'); } catch { return {}; }
}
function formatCurrency(n) { return Number(n).toFixed(2); }

function renderSummary() {
  const cart = getCart();
  const items = Object.values(cart);
  if (!items.length) {
    cartSummaryEl.innerHTML = '<p>Your cart is empty.</p>';
    openBtn.disabled = true;
    return;
  }

  let subtotal = 0;
  const rows = items.map(it => {
    const line = it.price * (it.qty || 0);
    subtotal += line;
    const imgHtml = `<img src="${it.img}" alt="${(it.name || '').replace(/"/g, '&quot;')}" style="width:80px;height:80px;object-fit:cover;border-radius:6px;margin-right:12px;">`;
    return `<div class="cart-row" style="display:flex;align-items:center;gap:12px;padding:8px 0;">
      ${imgHtml}
      <div style="flex:1">
        <strong style="display:block;margin-bottom:6px">${it.name}</strong>
        <div style="color:#555">${it.qty} × $${formatCurrency(it.price)} = $${formatCurrency(line)}</div>
      </div>
      <div style="font-weight:700">$${formatCurrency(line)}</div>
    </div>`;
  });

  const tax = 1.99;
  const shipping = 2.99;
  const amount = subtotal + tax + shipping;

  cartSummaryEl.innerHTML = `
    ${rows.join('')}
    <hr>
    <div>Sub-total: $${formatCurrency(subtotal)}</div>
    <div>Tax: $${formatCurrency(tax)}</div>
    <div>Shipping: $${formatCurrency(shipping)}</div>
    <h3>Total: $${formatCurrency(total)}</h3>
  `;
  openBtn.disabled = false;
  openBtn.dataset.total = formatCurrency(total);
  openBtn.dataset.subtotal = formatCurrency(subtotal);
}

renderSummary();

// Use EchelonSecure sandbox origin and iframe url
const IFRAME_ORIGIN = 'https://tokenization.sandbox.echelonsecure.app';
const IFRAME_URL = `${IFRAME_ORIGIN}/tokenization/v0.3`;

let iframeEl = null;

openBtn.addEventListener('click', function () {
  const clientKey = 'REPLACE_WITH_YOUR_CLIENT_KEY';
  if (!clientKey || clientKey.startsWith('REPLACE')) {
    alert('Put your client key into checkout.js openBtn click handler before testing.');
    return;
  }

  const total = openBtn.dataset.total || '0.00';
  iframeWrap.innerHTML = '';
  iframeEl = document.createElement('iframe');

  // Query params: client_key, amount, currency — confirm exact param names with provider docs.
  const params = new URLSearchParams({
    client_key: clientKey,
    amount: total,
    currency: 'USD'
  });

  iframeEl.src = `${IFRAME_URL}?${params.toString()}`;
  iframeEl.width = '100%';
  iframeEl.height = '560';
  iframeEl.style.border = '1px solid #ddd';
  iframeEl.title = 'Secure payment widget';
  iframeWrap.appendChild(iframeEl);

  statusEl.innerText = 'Waiting for tokenization...';
  openBtn.disabled = true;
});

// Listen for tokenization result from iframe via postMessage
window.addEventListener('message', async (evt) => {
  // Strict origin check in production
  if (evt.origin !== IFRAME_ORIGIN) return;

  const data = evt.data;
  if (!data || typeof data !== 'object') return;

  // Expected postMessage contract from iframe (adjust to provider docs):
  // { event: 'nonce.success', nonce: 'n_abc' }  OR  { event: 'token.success', token: 'tok_abc' }
  if ((data.event === 'nonce.success' && data.nonce) || (data.event === 'token.success' && data.token)) {
    const nonce = data.nonce || data.token;
    statusEl.innerText = 'Nonce received. Sending to server...';

    try {
      const total = openBtn.dataset.total || '0.00';
      const resp = await fetch('/charge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nonce, total })
      });
      const json = await resp.json();
      if (json && json.success) {
        statusEl.innerText = 'Payment successful. Thank you!';
        localStorage.removeItem('cart');
        renderSummary();
      } else {
        statusEl.innerText = 'Payment failed: ' + (json && json.message ? json.message : 'Unknown');
        openBtn.disabled = false;
      }
    } catch (err) {
      console.error(err);
      statusEl.innerText = 'Server error processing payment.';
      openBtn.disabled = false;
    }
  } else if (data.event === 'token.error' || data.event === 'nonce.error') {
    statusEl.innerText = 'Tokenization error: ' + (data.error || 'unknown error');
    openBtn.disabled = false;
  } else if (data.event === 'token.cancel' || data.event === 'nonce.cancel') {
    statusEl.innerText = 'Tokenization cancelled.';
    openBtn.disabled = false;
  } else {
    // Ignore unrelated messages
  }
});