import { PayOS } from '@payos/node';

const clientId = process.env.PAYOS_CLIENT_ID;
const apiKey = process.env.PAYOS_API_KEY;
const checksumKey = process.env.PAYOS_CHECKSUM_KEY;

if (!clientId || !apiKey || !checksumKey) {
  console.error('Missing PAYOS_CLIENT_ID, PAYOS_API_KEY, or PAYOS_CHECKSUM_KEY');
  process.exit(1);
}

const payos = new PayOS({ clientId, apiKey, checksumKey });

const orderCode = Date.now() % 1000000;

const paymentData = {
  orderCode,
  amount: 10000,
  description: `test payos ${orderCode}`,
  cancelUrl: 'https://pimaichi.local/cancel',
  returnUrl: 'https://pimaichi.local/success',
  expiredAt: Math.floor(Date.now() / 1000) + 600,
};

try {
  const result = await payos.paymentRequests.create(paymentData);
  console.log('✅ Create payment link success!');
  console.log('Order Code:', orderCode);
  console.log('Checkout URL:', result.checkoutUrl || result.data?.checkoutUrl);
  console.log('QR Code:', (result.qrCode || result.data?.qrCode)?.slice(0, 50) + '...');
  console.log('\n👉 Open the checkout URL in your browser to test payment');
} catch (err) {
  console.error('❌ Error:', err.message);
  if (err.response?.data) console.error(JSON.stringify(err.response.data, null, 2));
}
