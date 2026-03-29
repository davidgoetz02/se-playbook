const https = require('https');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const key = process.env.ANTHROPIC_API_KEY;

  if (req.method === 'GET') {
    return res.status(200).json({
      hasKey: !!key,
      keyPrefix: key ? key.substring(0, 14) + '...' : 'NOT SET',
      keyLength: key ? key.length : 0,
      validFormat: key ? key.startsWith('sk-ant-') : false
    });
  }

  if (req.method !== 'POST') return res.status(405).end();
  if (!key) return res.status(500).json({ error: 'ANTHROPIC_API_KEY not set' });

  const body = JSON.stringify(req.body);

  return new Promise((resolve) => {
    const options = {
      hostname: 'api.anthropic.com',
      path: '/v1/messages',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
        'x-api-key': key,
        'anthropic-version': '2023-06-01'
      }
    };

    const apiReq = https.request(options, (apiRes) => {
      let data = '';
      apiRes.on('data', chunk => data += chunk);
      apiRes.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          res.status(apiRes.statusCode).json(parsed);
        } catch (e) {
          res.status(500).json({ error: 'Failed to parse response', raw: data });
        }
        resolve();
      });
    });

    apiReq.on('error', (e) => {
      res.status(500).json({ error: e.message });
      resolve();
    });

    apiReq.write(body);
    apiReq.end();
  });
};
