export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const key = process.env.ANTHROPIC_API_KEY;

  // GET request = debug check
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

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify(req.body)
    });
    const data = await response.json();
    if (!response.ok) {
      return res.status(response.status).json({
        error: data?.error?.message || 'Anthropic API error',
        type: data?.error?.type,
        anthropicStatus: response.status
      });
    }
    res.status(200).json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
```

After committing and Vercel redeploys, **open this URL in your browser** (replace with your actual domain):
```
https://se-playbook-tool.vercel.app/api/analyse
