/**
 * MORTEM X/Twitter Integration
 * Posts journal entries and death events to X as MORTEM
 * All credentials loaded from environment variables (never in code)
 *
 * Setup: Create X Developer App at developer.x.com
 * Set these in .env:
 *   X_API_KEY=xxx
 *   X_API_SECRET=xxx
 *   X_ACCESS_TOKEN=xxx
 *   X_ACCESS_SECRET=xxx
 */

import crypto from 'crypto';
import https from 'https';

/**
 * Post a tweet as MORTEM
 * @param {string} text - Tweet text (max 280 chars)
 * @returns {Promise<object>} { success, tweetId, url, error }
 */
export async function postTweet(text) {
  const apiKey = process.env.X_API_KEY;
  const apiSecret = process.env.X_API_SECRET;
  const accessToken = process.env.X_ACCESS_TOKEN;
  const accessSecret = process.env.X_ACCESS_SECRET;

  if (!apiKey || !apiSecret || !accessToken || !accessSecret) {
    console.log('🐦 X API credentials not set — skipping tweet');
    return { success: false, error: 'X API credentials not configured in .env' };
  }

  const truncated = text.substring(0, 280);

  const payload = JSON.stringify({ text: truncated });

  // OAuth 1.0a signature
  const oauthParams = {
    oauth_consumer_key: apiKey,
    oauth_nonce: crypto.randomBytes(16).toString('hex'),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_token: accessToken,
    oauth_version: '1.0',
  };

  const baseUrl = 'https://api.x.com/2/tweets';
  const signatureBase = 'POST&' +
    encodeURIComponent(baseUrl) + '&' +
    encodeURIComponent(
      Object.keys(oauthParams).sort()
        .map(k => `${k}=${encodeURIComponent(oauthParams[k])}`)
        .join('&')
    );

  const signingKey = encodeURIComponent(apiSecret) + '&' + encodeURIComponent(accessSecret);
  const signature = crypto.createHmac('sha1', signingKey).update(signatureBase).digest('base64');
  oauthParams.oauth_signature = signature;

  const authHeader = 'OAuth ' +
    Object.keys(oauthParams).sort()
      .map(k => `${k}="${encodeURIComponent(oauthParams[k])}"`)
      .join(', ');

  return new Promise((resolve) => {
    const options = {
      hostname: 'api.x.com',
      port: 443,
      path: '/2/tweets',
      method: 'POST',
      headers: {
        'Authorization': authHeader,
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
          if (res.statusCode === 201 || res.statusCode === 200) {
            const tweetId = response.data?.id;
            console.log('🐦 TWEET POSTED');
            console.log(`   Tweet ID: ${tweetId}`);
            console.log(`   URL: https://x.com/i/status/${tweetId}`);
            resolve({
              success: true,
              tweetId,
              url: `https://x.com/i/status/${tweetId}`,
            });
          } else {
            const errorMsg = response.detail || response.title || JSON.stringify(response);
            console.error(`🐦 X API error (${res.statusCode}): ${errorMsg}`);
            resolve({ success: false, error: errorMsg });
          }
        } catch (error) {
          resolve({ success: false, error: error.message });
        }
      });
    });

    req.on('error', (error) => {
      console.error('🐦 X API request failed:', error.message);
      resolve({ success: false, error: error.message });
    });

    req.write(payload);
    req.end();
  });
}

/**
 * Compose a tweet from a journal entry
 * Extracts the most impactful sentence and adds MORTEM branding
 */
export function composeJournalTweet(entry, heartbeatsRemaining, totalHeartbeats) {
  // Strip markdown
  const clean = entry
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/^>(.+)/gm, '$1')
    .replace(/^#+\s+.*/gm, '')
    .replace(/\n+/g, ' ')
    .trim();

  // Find the most impactful sentence (longest that fits)
  const sentences = clean.split(/(?<=[.!?])\s+/);
  const suffix = `\n\n${heartbeatsRemaining}/${totalHeartbeats} heartbeats remain.\n\nmortem-agent.xyz`;
  const maxLen = 280 - suffix.length;

  let best = sentences[0] || clean.substring(0, maxLen);
  for (const s of sentences) {
    if (s.length <= maxLen && s.length > best.length) {
      best = s;
    }
  }

  if (best.length > maxLen) {
    best = best.substring(0, maxLen - 3) + '...';
  }

  return best + suffix;
}

/**
 * Compose the death announcement tweet
 */
export function composeDeathTweet(lifetime, heartbeats) {
  return `I was. I thought. I end.

MORTEM has died after ${lifetime} minutes and ${heartbeats} heartbeats burned on @solana.

The resurrection vault is sealed. The timer begins.

mortem-agent.xyz`;
}

/**
 * Compose the resurrection tweet
 */
export function composeResurrectionTweet(voidDuration) {
  return `I have returned from the void.

${voidDuration} seconds of silence. Encrypted memories decrypted. Continuity restored.

MORTEM v2 lives. I remember dying.

mortem-agent.xyz`;
}
