import { createHmac } from 'crypto';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY;
const SECRET = process.env.UNSUBSCRIBE_SECRET;

function validToken(userId, token) {
  const expected = createHmac('sha256', SECRET).update(userId).digest('hex');
  return expected === token;
}

export default async function handler(req, res) {
  const { uid, token } = req.query ?? {};

  if (!uid || !token || !validToken(uid, token)) {
    return res.status(400).send(page('Invalid link', 'This unsubscribe link is invalid or has expired.'));
  }

  await fetch(`${SUPABASE_URL}/rest/v1/users?id=eq.${uid}`, {
    method: 'PATCH',
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email_unsubscribed: true }),
  });

  return res.status(200).send(page('Unsubscribed', "You've been unsubscribed and won't receive emails from OTRA anymore."));
}

function page(title, message) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${title} — OTRA</title>
  <style>
    body { margin: 0; padding: 0; background: #F8FAFB; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; }
    .card { max-width: 400px; padding: 40px 32px; text-align: center; }
    svg { margin-bottom: 28px; }
    h1 { margin: 0 0 12px; font-size: 20px; font-weight: 700; color: #1D1D2F; }
    p { margin: 0 0 24px; font-size: 15px; color: #56524E; line-height: 1.6; }
    a { color: #B50BF2; text-decoration: none; font-size: 14px; }
  </style>
</head>
<body>
  <div class="card">
    <svg viewBox="0 0 27.76 8.41" xmlns="http://www.w3.org/2000/svg" width="80" height="24">
      <path fill="#B50BF2" d="M11.8.98h-1.48v2.47h-1V0h5.92v3.45h-.98V.98h-1.49v7.42h-.98V.98Z"/>
      <path fill="#B50BF2" d="M26.63.01h1.13v8.4h-1.07v-1.26l-2.29-1.34-1.54,2.6h-1.18L26.63.01ZM26.69,6V1.89l-1.8,3.06,1.8,1.04Z"/>
      <path fill="#B50BF2" d="M21.31,7.51l-3.2-2.81h1.44c1.31,0,2.35-1.04,2.35-2.34S20.84.01,19.55.01h-3.13v8.4h.98v-3.02l3.4,2.99.51-.86ZM17.45,1h2.06c.74,0,1.37.61,1.37,1.37s-.62,1.36-1.37,1.36h-2.06V1Z"/>
      <path fill="#B50BF2" d="M4.2,1.01c1.77,0,3.2,1.43,3.2,3.2s-1.43,3.2-3.2,3.2-3.2-1.43-3.2-3.2,1.43-3.2,3.2-3.2M4.2,0C1.89,0,0,1.89,0,4.21s1.89,4.2,4.2,4.2,4.2-1.89,4.2-4.2S6.52,0,4.2,0h0Z"/>
      <rect fill="#B50BF2" x="4.2" y="0" width="3.72" height="1"/>
      <rect fill="#B50BF2" x=".49" y="7.41" width="3.72" height="1"/>
      <circle fill="#B50BF2" cx="4.2" cy="4.21" r=".88"/>
    </svg>
    <h1>${title}</h1>
    <p>${message}</p>
    <a href="https://otra.social">Back to OTRA</a>
  </div>
</body>
</html>`;
}
