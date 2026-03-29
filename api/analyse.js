const https = require('https');

function supabaseRequest(path, method, body, useServiceKey = false) {
  const key = useServiceKey ? process.env.SUPABASE_SERVICE_KEY : process.env.SUPABASE_ANON_KEY;
  const supabaseUrl = process.env.SUPABASE_URL;
  const hostname = supabaseUrl.replace('https://', '');
  return new Promise((resolve, reject) => {
    const bodyStr = body ? JSON.stringify(body) : '';
    const options = {
      hostname,
      path,
      method,
      headers: {
        'Content-Type': 'application/json',
        'apikey': key,
        'Authorization': `Bearer ${key}`,
        ...(body ? { 'Content-Length': Buffer.byteLength(bodyStr) } : {}),
        'Prefer': 'return=representation'
      }
    };
    const req = https.request(options, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data || '{}') }); }
        catch { resolve({ status: res.statusCode, body: data }); }
      });
    });
    req.on('error', reject);
    if (body) req.write(bodyStr);
    req.end();
  });
}

function anthropicRequest(body) {
  const key = process.env.ANTHROPIC_API_KEY;
  return new Promise((resolve, reject) => {
    const bodyStr = JSON.stringify(body);
    const options = {
      hostname: 'api.anthropic.com',
      path: '/v1/messages',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(bodyStr),
        'x-api-key': key,
        'anthropic-version': '2023-06-01'
      }
    };
    const req = https.request(options, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, body: data }); }
      });
    });
    req.on('error', reject);
    req.write(bodyStr);
    req.end();
  });
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const { action, payload, token } = req.body || {};

  // Verify JWT token for all protected actions
  async function verifyToken() {
    if (!token) return null;
    const r = await supabaseRequest('/auth/v1/user', 'GET', null, false);
    // Use anon key but pass user's JWT as Bearer
    const key = process.env.SUPABASE_ANON_KEY;
    const supabaseUrl = process.env.SUPABASE_URL;
    const hostname = supabaseUrl.replace('https://', '');
    return new Promise((resolve) => {
      const options = {
        hostname,
        path: '/auth/v1/user',
        method: 'GET',
        headers: {
          'apikey': key,
          'Authorization': `Bearer ${token}`
        }
      };
      const req2 = https.request(options, r2 => {
        let d = '';
        r2.on('data', c => d += c);
        r2.on('end', () => {
          try { resolve(JSON.parse(d)); } catch { resolve(null); }
        });
      });
      req2.on('error', () => resolve(null));
      req2.end();
    });
  }

  try {
    // --- AUTH: Sign in ---
    if (action === 'signin') {
      const { email, password } = payload;
      const r = await supabaseRequest('/auth/v1/token?grant_type=password', 'POST', { email, password }, false);
      if (r.status !== 200) return res.status(401).json({ error: 'Invalid credentials' });
      // Get profile
      const profileR = await supabaseRequest(`/rest/v1/profiles?select=username,role&id=eq.${r.body.user.id}`, 'GET', null, true);
      const profile = profileR.body?.[0];
      return res.status(200).json({ token: r.body.access_token, refresh_token: r.body.refresh_token, user: { id: r.body.user.id, username: profile?.username || r.body.user.email, role: profile?.role || 'member' } });
    }

    // --- AUTH: Refresh token ---
    if (action === 'refresh') {
      const { refresh_token } = payload;
      const r = await supabaseRequest('/auth/v1/token?grant_type=refresh_token', 'POST', { refresh_token }, false);
      if (r.status !== 200) return res.status(401).json({ error: 'Session expired' });
      return res.status(200).json({ token: r.body.access_token, refresh_token: r.body.refresh_token });
    }

    // --- AUTH: Change password (requires current token) ---
    if (action === 'change_password') {
      const user = await verifyToken();
      if (!user?.id) return res.status(401).json({ error: 'Unauthorized' });
      const r = await supabaseRequest('/auth/v1/user', 'PUT', { password: payload.new_password }, false);
      return res.status(r.status).json(r.status === 200 ? { success: true } : { error: 'Failed to change password' });
    }

    // --- ADMIN: Create user (requires admin token) ---
    if (action === 'create_user') {
      const user = await verifyToken();
      if (!user?.id) return res.status(401).json({ error: 'Unauthorized' });
      const profileR = await supabaseRequest(`/rest/v1/profiles?select=role&id=eq.${user.id}`, 'GET', null, true);
      if (profileR.body?.[0]?.role !== 'admin') return res.status(403).json({ error: 'Admins only' });
      // Create auth user
      const authR = await supabaseRequest('/auth/v1/admin/users', 'POST', { email: payload.email, password: payload.password, email_confirm: true }, true);
      if (authR.status !== 200 && authR.status !== 201) return res.status(400).json({ error: authR.body?.message || 'Failed to create user' });
      // Create profile
      await supabaseRequest('/rest/v1/profiles', 'POST', { id: authR.body.id, username: payload.username, role: payload.role || 'member' }, true);
      return res.status(200).json({ success: true });
    }

    // --- ADMIN: Delete user ---
    if (action === 'delete_user') {
      const user = await verifyToken();
      if (!user?.id) return res.status(401).json({ error: 'Unauthorized' });
      const profileR = await supabaseRequest(`/rest/v1/profiles?select=role&id=eq.${user.id}`, 'GET', null, true);
      if (profileR.body?.[0]?.role !== 'admin') return res.status(403).json({ error: 'Admins only' });
      await supabaseRequest(`/auth/v1/admin/users/${payload.user_id}`, 'DELETE', null, true);
      return res.status(200).json({ success: true });
    }

    // --- ADMIN: List users ---
    if (action === 'list_users') {
      const user = await verifyToken();
      if (!user?.id) return res.status(401).json({ error: 'Unauthorized' });
      const r = await supabaseRequest('/rest/v1/profiles?select=id,username,role', 'GET', null, true);
      return res.status(200).json({ users: r.body });
    }

    // --- ADMIN: Reset password ---
    if (action === 'reset_password') {
      const user = await verifyToken();
      if (!user?.id) return res.status(401).json({ error: 'Unauthorized' });
      const profileR = await supabaseRequest(`/rest/v1/profiles?select=role&id=eq.${user.id}`, 'GET', null, true);
      if (profileR.body?.[0]?.role !== 'admin') return res.status(403).json({ error: 'Admins only' });
      const r = await supabaseRequest(`/auth/v1/admin/users/${payload.user_id}`, 'PUT', { password: payload.new_password }, true);
      return res.status(r.status === 200 ? 200 : 400).json(r.status === 200 ? { success: true } : { error: 'Failed to reset password' });
    }

    // --- AI: Analyse transcript ---
    if (action === 'analyse') {
      const user = await verifyToken();
      if (!user?.id) return res.status(401).json({ error: 'Unauthorized' });
      const r = await anthropicRequest(payload);
      return res.status(r.status).json(r.body);
    }

    return res.status(400).json({ error: 'Unknown action' });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: e.message });
  }
};
