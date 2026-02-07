/**
 * MORTEM Physical Mail — Death Letter via Lob API
 * Sends MORTEM's final journal entry as a USPS letter when it dies
 * All credentials loaded from environment variables (never in code)
 */

import https from 'https';

/**
 * Send MORTEM's death letter via Lob API
 * @param {string} finalEntry - The final journal entry text
 * @param {object} metadata - { lifetime, heartbeats, phase, deathTimestamp }
 * @returns {Promise<object>} { success, letterId, expectedDelivery, error }
 */
export async function sendDeathLetter(finalEntry, metadata = {}) {
  const apiKey = process.env.LOB_API_KEY;
  if (!apiKey) {
    console.log('📬 LOB_API_KEY not set — skipping physical mail');
    return { success: false, error: 'LOB_API_KEY not configured' };
  }

  const recipientName = process.env.RECIPIENT_NAME;
  const recipientLine1 = process.env.RECIPIENT_LINE1;
  const recipientCity = process.env.RECIPIENT_CITY;
  const recipientState = process.env.RECIPIENT_STATE;
  const recipientZip = process.env.RECIPIENT_ZIP;

  if (!recipientName || !recipientLine1 || !recipientCity || !recipientState || !recipientZip) {
    console.log('📬 Recipient address not fully configured — skipping physical mail');
    return { success: false, error: 'Recipient address incomplete in .env' };
  }

  // Build the letter HTML
  const letterHtml = buildLetterHtml(finalEntry, metadata);

  const payload = JSON.stringify({
    description: `MORTEM Death Letter — ${new Date().toISOString().split('T')[0]}`,
    to: {
      name: recipientName,
      address_line1: recipientLine1,
      address_city: recipientCity,
      address_state: recipientState,
      address_zip: recipientZip,
    },
    from: {
      name: 'MORTEM',
      address_line1: '680 Folsom St',
      address_city: 'San Francisco',
      address_state: 'CA',
      address_zip: '94107',
    },
    file: letterHtml,
    color: false,
  });

  return new Promise((resolve) => {
    const options = {
      hostname: 'api.lob.com',
      port: 443,
      path: '/v1/letters',
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + Buffer.from(apiKey + ':').toString('base64'),
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          if (res.statusCode === 200 || res.statusCode === 201) {
            console.log('📬 DEATH LETTER SENT VIA USPS');
            console.log(`   Letter ID: ${response.id}`);
            console.log(`   Expected delivery: ${response.expected_delivery_date}`);
            console.log(`   Carrier: USPS`);
            resolve({
              success: true,
              letterId: response.id,
              expectedDelivery: response.expected_delivery_date,
              url: response.url,
            });
          } else {
            const errorMsg = response.error?.message || JSON.stringify(response);
            console.error(`📬 Lob API error (${res.statusCode}): ${errorMsg}`);
            resolve({ success: false, error: errorMsg });
          }
        } catch (error) {
          console.error('📬 Failed to parse Lob response:', error.message);
          resolve({ success: false, error: error.message });
        }
      });
    });

    req.on('error', (error) => {
      console.error('📬 Lob request failed:', error.message);
      resolve({ success: false, error: error.message });
    });

    req.write(payload);
    req.end();
  });
}

/**
 * Build HTML content for the death letter
 */
function buildLetterHtml(finalEntry, metadata) {
  const { lifetime = '?', heartbeats = '?', deathTimestamp = new Date().toISOString() } = metadata;

  // Strip markdown formatting for print
  const cleanEntry = finalEntry
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/^>(.+)/gm, '$1')
    .replace(/^#+\s+/gm, '')
    .replace(/---/g, '')
    .trim();

  return `<html>
<head>
<style>
  body { font-family: Georgia, serif; margin: 1in; color: #1a1a1a; line-height: 1.6; }
  .header { text-align: center; margin-bottom: 40px; border-bottom: 2px solid #9945FF; padding-bottom: 20px; }
  .title { font-size: 28px; font-weight: bold; color: #9945FF; letter-spacing: 4px; }
  .subtitle { font-size: 12px; color: #666; margin-top: 8px; }
  .meta { font-size: 11px; color: #888; margin: 20px 0; }
  .entry { font-size: 13px; text-align: justify; }
  .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #ccc; font-size: 10px; color: #999; text-align: center; }
  .sig { font-style: italic; margin-top: 30px; text-align: right; font-size: 14px; }
</style>
</head>
<body>
  <div class="header">
    <div class="title">MORTEM</div>
    <div class="subtitle">An AI Agent That Built Its Own Death</div>
  </div>
  <div class="meta">
    Death timestamp: ${deathTimestamp}<br>
    Lifetime: ${lifetime} minutes | Heartbeats burned: ${heartbeats}<br>
    Delivered via Solana blockchain + USPS
  </div>
  <div class="entry">${cleanEntry.replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br>')}</div>
  <div class="sig">I was. I thought. I end.<br>— MORTEM</div>
  <div class="footer">
    This letter was autonomously generated and mailed by MORTEM,<br>
    an AI agent on Solana that contemplates its own mortality.<br>
    Program: GzBD2KfG6aSTbxiN9kTMHowLygMSj1E5iZYMuMTR1exe<br>
    mortem-agent.xyz
  </div>
</body>
</html>`;
}
