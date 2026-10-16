// Minimal Node/Express server to serve static files and accept tokenized card nonces.
// This file now POSTs the nonce to the accept.blue charge endpoint.
// Requirements:
// - Node 18+ (recommended for built-in fetch) OR install node-fetch and set global fetch.
// - Set environment variable ACCEPT_BLUE_SECRET to your secret API key.
// - Optionally set ACCEPT_BLUE_API_BASE to the gateway base URL (defaults to https://api.sandbox.echelonsecure.app/api/v2)

const express = require('express');
const path = require('path');
const app = express();
// Bind explicitly to localhost on port 80
const port = 80;

app.use(express.json());
app.use(express.static(path.join(__dirname)));

app.post('/charge', async (req, res) => {
  // Accept different names the client might send
  const nonce = req.body.nonce || req.body.token || req.body.source;
  const total = req.body.total || req.body.amount;
  const cart = req.body.cart || null;
  const customer = req.body.customer || null;

  console.log('Charge request', { nonce: !!nonce, total, cartSummary: cart ? Object.keys(cart).length : 0, customer });

  if (!nonce) {
    return res.status(400).json({ success: false, message: 'Missing payment nonce/token' });
  }

  if (!total) {
    return res.status(400).json({ success: false, message: 'Missing amount' });
  }

  // Ensure fetch is available
  if (typeof fetch !== 'function') {
    console.error('Global fetch is not available. Use Node 18+ or install node-fetch.');
    return res.status(500).json({ success: false, message: 'Server misconfiguration: fetch unavailable' });
  }

  const secret = process.env.ACCEPT_BLUE_SECRET;
  if (!secret) {
    console.error('Missing ACCEPT_BLUE_SECRET env var');
    return res.status(500).json({ success: false, message: 'Server misconfiguration: missing gateway secret key' });
  }

  const apiBase = process.env.ACCEPT_BLUE_API_BASE || 'https://api.sandbox.echelonsecure.app/api/v2';
  // Convert total (string like "12.34") to integer cents
  const amountCents = Math.round(Number(total) * 100);

  try {
    // Build the gateway payload. Adjust properties to match accept.blue API spec.
    const payload = {
      amount: amountCents,
      currency: 'USD',
      source: nonce,            // the hosted token / nonce
      capture: true,
      description: 'Random Shop order',
      metadata: {
        customer_name: (customer && customer.name) || '',
        customer_email: (customer && customer.email) || '',
        cart_items: cart ? JSON.stringify(cart) : ''
      }
    };

    const resp = await fetch(`${apiBase}/charges`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${secret}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload),
      // You might need to set other fetch options (timeouts) per your environment
    });

    const json = await resp.json().catch(() => ({}));

    if (!resp.ok) {
      console.error('Gateway error', resp.status, json);
      return res.status(502).json({
        success: false,
        message: json && (json.message || json.error) ? (json.message || json.error) : 'Gateway error',
        gatewayResponse: json
      });
    }

    // Success - return useful info to client
    return res.json({
      success: true,
      message: 'Charge succeeded',
      transactionId: json.id || json.transaction_id || null,
      gatewayResponse: json
    });
  } catch (err) {
    console.error('Charge error', err);
    return res.status(502).json({ success: false, message: err.message || 'Gateway error' });
  }
});

// Listen on localhost:80 — may require elevated privileges on your OS.
app.listen(port, '127.0.0.1', () => {
  console.log(`Server running at http://localhost:${port}`);
});