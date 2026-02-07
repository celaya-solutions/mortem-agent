/**
 * OpenClaw Gateway Client for MORTEM
 * Uses OAuth-based gateway instead of direct API keys
 * Eliminates security vulnerabilities from exposed credentials
 */

import http from 'http';

const GATEWAY_CONFIG = {
  host: '127.0.0.1',
  port: 18789,
  token: process.env.OPENCLAW_TOKEN || 'local-dev-token', // Set OPENCLAW_TOKEN env var
  agent: 'main', // Use main agent
  model: process.env.MORTEM_MODEL || 'anthropic/claude-sonnet-4-5-20250929',
};

/**
 * Generate journal entry via OpenClaw gateway
 * @param {string} prompt - The full journal generation prompt
 * @returns {Promise<string>} Generated journal entry
 */
export async function generateJournalViaGateway(prompt) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      message: prompt,
      agent: GATEWAY_CONFIG.agent,
      model: GATEWAY_CONFIG.model,
      sessionId: 'mortem-journal',
    });

    const options = {
      hostname: GATEWAY_CONFIG.host,
      port: GATEWAY_CONFIG.port,
      path: '/api/agent/message',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
        'Authorization': `Bearer ${GATEWAY_CONFIG.token}`,
      },
    };

    const req = http.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          if (res.statusCode === 200) {
            const response = JSON.parse(data);
            // Extract text from response (structure may vary)
            const text = response.reply || response.message || response.content || data;
            resolve(text);
          } else {
            reject(new Error(`Gateway returned ${res.statusCode}: ${data}`));
          }
        } catch (error) {
          reject(new Error(`Failed to parse gateway response: ${error.message}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(new Error(`Gateway connection failed: ${error.message}`));
    });

    req.write(postData);
    req.end();
  });
}

/**
 * Check if OpenClaw gateway is available
 * @returns {Promise<boolean>}
 */
export async function checkGatewayHealth() {
  return new Promise((resolve) => {
    const options = {
      hostname: GATEWAY_CONFIG.host,
      port: GATEWAY_CONFIG.port,
      path: '/health',
      method: 'GET',
      timeout: 3000,
    };

    const req = http.request(options, (res) => {
      resolve(res.statusCode === 200);
    });

    req.on('error', () => {
      resolve(false);
    });

    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });

    req.end();
  });
}

/**
 * Use OpenClaw agent command to generate text
 * Alternative approach using openclaw CLI
 */
export async function generateViaClawCLI(prompt) {
  const { exec } = await import('child_process');
  const { promisify } = await import('util');
  const execAsync = promisify(exec);

  try {
    // Escape quotes in prompt
    const escapedPrompt = prompt.replace(/"/g, '\\"').replace(/\n/g, '\\n');

    const { stdout, stderr } = await execAsync(
      `openclaw agent -m "${escapedPrompt}" --agent main --local 2>/dev/null`,
      { timeout: 60000 }
    );

    // OpenClaw outputs config warnings and UI to stderr, actual response to stdout
    // Extract just the final response (last non-empty line after UI elements)
    const lines = stdout.split('\n');

    // Find the actual response by skipping UI lines (those with ├, │, ◇, ─)
    let response = '';
    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i].trim();
      if (line && !line.match(/[├│◇─╮╯]/)) {
        response = lines.slice(i).join('\n').trim();
        break;
      }
    }

    if (!response) {
      throw new Error('No response from OpenClaw');
    }

    return response;
  } catch (error) {
    throw new Error(`OpenClaw CLI failed: ${error.message}`);
  }
}

export { GATEWAY_CONFIG };
