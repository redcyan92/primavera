import { Resend } from 'resend';

const resend    = new Resend(process.env.RESEND_API_KEY);
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const FROM  = 'otra <noreply@otra.social>';
const APP_URL = 'https://otra.vercel.app';

// ── Supabase helpers ──────────────────────────────────────────────────────────

async function sbGet(table, query) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${query}`, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
  });
  return res.json();
}

async function getUser(id) {
  const rows = await sbGet('users', `id=eq.${id}&select=id,email,name`);
  return rows?.[0] ?? null;
}

async function getUsersWithArtistInFestival(festivalId, artist, excludeUserId) {
  const rows = await sbGet(
    'notes',
    `festival_id=eq.${encodeURIComponent(festivalId)}&artist=eq.${encodeURIComponent(artist)}&user_id=neq.${excludeUserId}&select=user_id`
  );
  if (!Array.isArray(rows)) return [];
  const seen = new Set();
  return rows.map(r => r.user_id).filter(id => { if (seen.has(id)) return false; seen.add(id); return true; });
}

// ── Email templates ───────────────────────────────────────────────────────────

const btn = (label) =>
  `<a href="${APP_URL}" style="display:inline-block;margin-top:20px;padding:12px 24px;background:#7C3AED;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px">${label}</a>`;

const wrap = (body) => `
<!DOCTYPE html><html><body style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;padding:32px 20px;color:#1D1D2F">
<img src="${APP_URL}/icon.svg" width="40" alt="otra" style="margin-bottom:24px">
${body}
<p style="margin-top:40px;font-size:12px;color:#9E9A93">otra — festival connections</p>
</body></html>`;

function searchLiveHtml(festivalName, description, artist) {
  const artistLine = artist && artist !== 'Otro' ? `<p style="margin:4px 0 0;font-size:13px;color:#7C3AED">${artist}</p>` : '';
  return wrap(`
    <h2 style="margin:0 0 8px">Your search is live 🔍</h2>
    <p style="color:#555">We're matching you with people at <strong>${festivalName}</strong> who shared the same moment.</p>
    <div style="background:#F7F5F2;border-radius:8px;padding:14px;margin:20px 0;font-size:14px;color:#1D1D2F;line-height:1.6">${description}${artistLine}</div>
    <p style="color:#555;font-size:14px">We'll notify you as soon as we find a match.</p>
    ${btn('See your search →')}
  `);
}

function activityDigestHtml(festivalName, artist) {
  return wrap(`
    <h2 style="margin:0 0 8px">More people searching at ${festivalName}</h2>
    <p style="color:#555">New searches for <strong>${artist}</strong> have appeared — there may be new matches waiting for you.</p>
    ${btn('Check your matches →')}
  `);
}

function mutualMatchHtml(festivalName, otherName) {
  return wrap(`
    <h2 style="margin:0 0 8px">You have a mutual match ✦</h2>
    <p style="color:#555">You and <strong>${otherName || 'someone'}</strong> both accepted each other at <strong>${festivalName}</strong>.</p>
    <p style="color:#555;font-size:14px">Open the app to share your Instagram and connect.</p>
    ${btn('Connect now →')}
  `);
}

function crowdRequestHtml(festivalName, senderName, postDescription, message) {
  const msgLine = message ? `<blockquote style="border-left:3px solid #7C3AED;margin:16px 0;padding:8px 14px;color:#555;font-size:14px">${message}</blockquote>` : '';
  return wrap(`
    <h2 style="margin:0 0 8px">Someone wants to connect with you</h2>
    <p style="color:#555"><strong>${senderName || 'Someone'}</strong> saw your post at <strong>${festivalName}</strong> and wants to connect.</p>
    <div style="background:#F7F5F2;border-radius:8px;padding:14px;margin:16px 0;font-size:14px;color:#1D1D2F;line-height:1.6">${postDescription}</div>
    ${msgLine}
    ${btn('See the request →')}
  `);
}

// ── Handler ───────────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  if (!process.env.RESEND_API_KEY) return res.status(500).json({ error: 'RESEND_API_KEY not set' });

  const { type, ...data } = req.body ?? {};

  try {
    if (type === 'search_live') {
      const { userId, festivalName, noteDescription, artist } = data;
      const user = await getUser(userId);
      if (!user?.email) return res.status(200).json({ skipped: 'no email' });

      await resend.emails.send({
        from: FROM, to: user.email,
        subject: `Your search is live at ${festivalName}`,
        html: searchLiveHtml(festivalName, noteDescription, artist),
      });
    }

    else if (type === 'activity_digest') {
      const { festivalId, festivalName, artist, excludeUserId } = data;
      const userIds = await getUsersWithArtistInFestival(festivalId, artist, excludeUserId);
      const scheduledAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

      await Promise.all(userIds.map(async (uid) => {
        const user = await getUser(uid);
        if (!user?.email) return;
        await resend.emails.send({
          from: FROM, to: user.email,
          subject: `More people searching at ${festivalName} for ${artist}`,
          html: activityDigestHtml(festivalName, artist),
          scheduledAt,
        });
      }));
    }

    else if (type === 'mutual_match') {
      const { user1Id, user2Id, festivalName } = data;
      const [user1, user2] = await Promise.all([getUser(user1Id), getUser(user2Id)]);

      await Promise.all([
        user1?.email && resend.emails.send({
          from: FROM, to: user1.email,
          subject: `You matched at ${festivalName} — connect now`,
          html: mutualMatchHtml(festivalName, user2?.name),
        }),
        user2?.email && resend.emails.send({
          from: FROM, to: user2.email,
          subject: `You matched at ${festivalName} — connect now`,
          html: mutualMatchHtml(festivalName, user1?.name),
        }),
      ]);
    }

    else if (type === 'crowd_request') {
      const { senderId, receiverId, festivalName, postDescription, message } = data;
      const [sender, receiver] = await Promise.all([getUser(senderId), getUser(receiverId)]);
      if (!receiver?.email) return res.status(200).json({ skipped: 'no email' });

      await resend.emails.send({
        from: FROM, to: receiver.email,
        subject: `Someone wants to connect with you at ${festivalName}`,
        html: crowdRequestHtml(festivalName, sender?.name, postDescription, message),
      });
    }

    else {
      return res.status(400).json({ error: 'Unknown email type' });
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('send-email error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
