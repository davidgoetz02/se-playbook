export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const key = process.env.ANTHROPIC_API_KEY;

  if (!key) {
    return res.status(500).json({ 
      error: 'ANTHROPIC_API_KEY is not set',
      debug: 'Environment variable missing entirely'
    });
  }

  if (!key.startsWith('sk-ant-')) {
    return res.status(500).json({ 
      error: 'ANTHROPIC_API_KEY looks invalid',
      debug: `Key starts with: ${key.substring(0, 8)}...`
    });
  }

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
        status: response.status
      });
    }
    res.status(200).json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
