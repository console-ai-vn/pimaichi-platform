import { PayOS } from '@payos/node';

const clientId = process.env.PAYOS_CLIENT_ID;
const apiKey = process.env.PAYOS_API_KEY;
const checksumKey = process.env.PAYOS_CHECKSUM_KEY;

if (!clientId || !apiKey || !checksumKey) {
  console.error('Missing PAYOS_CLIENT_ID, PAYOS_API_KEY, or PAYOS_CHECKSUM_KEY');
  process.exit(1);
}

const payos = new PayOS({ clientId, apiKey, checksumKey });

// The workers.dev URL for the webhook
const webhookUrl = process.env.WEBHOOK_URL || 'https://pimaichi-platform.ceo-23f.workers.dev/api/v1/payments/webhook';

try {
  // Step 1: Confirm webhook URL
  console.log(`Confirming webhook URL: ${webhookUrl}`);
  const confirmResult = await payos.webhooks.confirm(webhookUrl);
  console.log('✅ Webhook URL confirmed successfully!');
  console.log(JSON.stringify(confirmResult, null, 2));
} catch (err) {
  console.error('❌ Failed to confirm webhook URL:', err.message);
  if (err.response?.data) console.error(JSON.stringify(err.response.data, null, 2));
  console.log('\n📌 You can also set the webhook URL manually:');
  console.log('   1. Go to https://payos.vn and log into your merchant dashboard');
  console.log('   2. Navigate to Settings > Webhook');
  console.log('   3. Enter:', webhookUrl);
  console.log('\n📌 If payment gateway is not active (code 214):');
  console.log('   1. Go to https://payos.vn');
  console.log('   2. Complete merchant registration/verification');
  console.log('   3. Activate the payment gateway in the dashboard');
}
