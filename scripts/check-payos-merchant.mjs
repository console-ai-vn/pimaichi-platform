import { PayOS } from '@payos/node';

const clientId = process.env.PAYOS_CLIENT_ID;
const apiKey = process.env.PAYOS_API_KEY;
const checksumKey = process.env.PAYOS_CHECKSUM_KEY;

if (!clientId || !apiKey || !checksumKey) {
  console.error('Missing payOS credentials');
  process.exit(1);
}

const payos = new PayOS({ clientId, apiKey, checksumKey });

try {
  // Try to get merchant info to check account status
  const info = await payos.paymentRequests.list({ page: 1, size: 1 });
  console.log('✅ payOS credentials are valid!');
  console.log('Account info available');
} catch (err) {
  console.error('Error:', err.message);
  if (err.response?.data) {
    const data = err.response.data;
    console.log('Code:', data.code);
    console.log('Desc:', data.desc);
  }
}
