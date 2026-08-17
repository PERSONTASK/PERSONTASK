// Gatilho 3/3 — Menção (@usuário) em comentário.
// Invocada pelo app em api.comments.create. Body: { commentId }
import { adminClient, corsHeaders, layout, sendEmail, tr, APP_URL } from '../_shared/email.ts';

const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const { commentId } = await req.json();
    if (!commentId) return json({ error: 'commentId required' }, 400);

    const sb = adminClient();
    const { data: c } = await sb
      .from('comments')
      .select('id, body, item_id, space_id, author_id, items(title)')
      .eq('id', commentId)
      .single();
    if (!c) return json({ error: 'comment not found' }, 404);

    const [{ data: author }, { data: mrows }] = await Promise.all([
      sb.from('profiles').select('name').eq('id', c.author_id).single(),
      sb.from('comment_mentions').select('mentioned_user_id').eq('comment_id', commentId),
    ]);
    const ids = (mrows ?? []).map((r) => r.mentioned_user_id).filter((id) => id !== c.author_id);
    if (ids.length === 0) return json({ ok: true, sent: 0 });

    const { data: profiles } = await sb
      .from('profiles')
      .select('id, email, locale, email_notifications')
      .in('id', ids);

    const itemTitle = (c as any).items?.title ?? '';
    const authorName = author?.name ?? '—';

    let sent = 0;
    for (const p of profiles ?? []) {
      if (!p.email || !p.email_notifications) continue;
      const html = layout({
        title: tr(p.locale, 'mentionTitle'),
        body: `${tr(p.locale, 'mentionBody', { author: authorName, title: itemTitle })}<blockquote style="margin:12px 0;padding:8px 12px;border-left:3px solid #6366F1;color:#555">${c.body}</blockquote>`,
        ctaUrl: `${APP_URL()}/space/${c.space_id}`,
        ctaLabel: tr(p.locale, 'open'),
      });
      if ((await sendEmail(p.email, tr(p.locale, 'mentionSubject', { author: authorName }), html)).ok) sent++;
      await sb.from('notifications_log').insert({ type: 'mention', item_id: c.item_id, user_id: p.id });
    }
    return json({ ok: true, sent });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
