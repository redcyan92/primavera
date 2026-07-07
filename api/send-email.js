import { Resend } from 'resend';

const resend    = new Resend(process.env.RESEND_API_KEY);
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const FROM  = 'otra <onboarding@resend.dev>'; // swap to noreply@otra.social once domain is verified in Resend
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

// ── Design tokens (matching app) ─────────────────────────────────────────────
const C = {
  bg:       '#F8FAFB',
  card:     '#FFFFFF',
  primary:  '#B50BF2',
  tint:     'rgba(181,11,242,0.07)',
  tintBorder: 'rgba(181,11,242,0.18)',
  dark:     '#1D1D2F',
  sec:      '#56524E',
  muted:    '#9E9A93',
  border:   '#E6E8EC',
  surface:  '#F2F3F6',
};

// ── Shared primitives ─────────────────────────────────────────────────────────

const btn = (label) =>
  `<a href="${APP_URL}" style="display:inline-block;margin-top:24px;padding:13px 28px;background:${C.primary};color:#fff;text-decoration:none;border-radius:10px;font-weight:700;font-size:14px;letter-spacing:0.01em">${label}</a>`;

const chip = (text) =>
  `<span style="display:inline-block;font-size:11px;color:${C.muted};background:${C.surface};border-radius:4px;padding:3px 9px;margin-right:6px;font-weight:500">${text}</span>`;

const quoteBlock = (text, chips = '') =>
  `<div style="background:${C.tint};border:1px solid ${C.tintBorder};border-radius:10px;padding:14px 16px;margin:18px 0">
    ${chips ? `<div style="margin-bottom:8px">${chips}</div>` : ''}
    <p style="margin:0;font-size:14px;color:${C.dark};line-height:1.65">${text}</p>
  </div>`;

const divider = () =>
  `<hr style="border:none;border-top:1px solid ${C.border};margin:28px 0">`;

// SVG logomark inlined so it renders in all clients
const logo = `<svg width="28" height="28" viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
  <circle cx="100" cy="100" r="90" stroke="${C.primary}" stroke-width="16"/>
  <circle cx="100" cy="100" r="28" fill="${C.primary}"/>
  <path d="M100 190 Q130 160 100 130" stroke="${C.primary}" stroke-width="14" stroke-linecap="round" fill="none"/>
</svg>`;

const wrap = (body) => `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:${C.bg};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,sans-serif;color:${C.dark}">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:${C.bg};padding:32px 16px">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:480px">

        <!-- Header -->
        <tr><td style="padding:0 0 24px">${logo}</td></tr>

        <!-- Card -->
        <tr><td style="background:${C.card};border-radius:16px;padding:28px 28px 32px;border:1px solid ${C.border}">
          ${body}
        </td></tr>

        <!-- Footer -->
        <tr><td style="padding:24px 4px 0;font-size:12px;color:${C.muted};line-height:1.6">
          otra — festival connections<br>
          <a href="${APP_URL}" style="color:${C.muted}">otra.vercel.app</a>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body></html>`;

// ── Templates ─────────────────────────────────────────────────────────────────

function searchLiveHtml(festivalName, description, artist) {
  const chips = artist && artist !== 'Otro' ? chip(artist) : '';
  return wrap(`
    <p style="margin:0 0 6px;font-size:12px;font-weight:600;color:${C.primary};letter-spacing:0.06em;text-transform:uppercase">AI Search</p>
    <h1 style="margin:0 0 12px;font-size:22px;font-weight:700;color:${C.dark};line-height:1.3">Your search is live</h1>
    <p style="margin:0 0 4px;font-size:15px;color:${C.sec};line-height:1.6">We're matching you with people at <strong style="color:${C.dark}">${festivalName}</strong> who shared the same moment.</p>
    ${quoteBlock(description, chips)}
    <p style="margin:0;font-size:14px;color:${C.muted}">We'll notify you as soon as we find a match.</p>
    ${btn('See your search →')}
  `);
}

function activityDigestHtml(festivalName, artist) {
  return wrap(`
    <p style="margin:0 0 6px;font-size:12px;font-weight:600;color:${C.primary};letter-spacing:0.06em;text-transform:uppercase">New activity</p>
    <h1 style="margin:0 0 12px;font-size:22px;font-weight:700;color:${C.dark};line-height:1.3">More people searching at ${festivalName}</h1>
    <p style="margin:0;font-size:15px;color:${C.sec};line-height:1.6">New searches for <strong style="color:${C.dark}">${artist}</strong> just appeared — there may be new matches waiting for you.</p>
    ${btn('Check your matches →')}
  `);
}

function mutualMatchHtml(festivalName, otherName) {
  return wrap(`
    <p style="margin:0 0 6px;font-size:12px;font-weight:600;color:${C.primary};letter-spacing:0.06em;text-transform:uppercase">Mutual match</p>
    <h1 style="margin:0 0 12px;font-size:22px;font-weight:700;color:${C.dark};line-height:1.3">You matched ✦</h1>
    <p style="margin:0 0 4px;font-size:15px;color:${C.sec};line-height:1.6">You and <strong style="color:${C.dark}">${otherName || 'someone'}</strong> both accepted each other at <strong style="color:${C.dark}">${festivalName}</strong>.</p>
    ${divider()}
    <p style="margin:0;font-size:14px;color:${C.muted}">Open the app and share your Instagram to connect.</p>
    ${btn('Connect now →')}
  `);
}

function crowdRequestHtml(festivalName, senderName, postDescription, message) {
  const msgBlock = message
    ? `<div style="border-left:3px solid ${C.primary};padding:10px 14px;margin:16px 0;font-size:14px;color:${C.sec};font-style:italic;line-height:1.6">${message}</div>`
    : '';
  return wrap(`
    <p style="margin:0 0 6px;font-size:12px;font-weight:600;color:${C.primary};letter-spacing:0.06em;text-transform:uppercase">Crowd</p>
    <h1 style="margin:0 0 12px;font-size:22px;font-weight:700;color:${C.dark};line-height:1.3">Someone wants to connect</h1>
    <p style="margin:0 0 4px;font-size:15px;color:${C.sec};line-height:1.6"><strong style="color:${C.dark}">${senderName || 'Someone'}</strong> saw your post at <strong style="color:${C.dark}">${festivalName}</strong> and wants to connect.</p>
    ${quoteBlock(postDescription)}
    ${msgBlock}
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
