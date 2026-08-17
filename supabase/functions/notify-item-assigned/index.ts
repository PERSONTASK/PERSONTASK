// Gatilho 1/3 — Novo Item atribuído ao usuário.
// Invocada pelo app em api.items.setAssignees. Body: { itemId, userIds }
import { adminClient, corsHeaders, layout, sendEmail, tr, APP_URL } from '../_shared/email.ts';

const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const { itemId, userIds } = await req.json();
    if (!itemId || !Array.isArray(userIds) || userIds.length === 0) return json({ ok: true, skipped: true });

    const sb = adminClient();
    const { data: item } = await sb
      .from('items')
      .select('id, title, space_id, spaces(name)')
      .eq('id', itemId)
      .single();
    if (!item) return json({ error: 'item not found' }, 404);

    const spaceName = (item as any).spaces?.name ?? '';
    const { data: profiles } = await sb
      .from('profiles')
      .select('id, email, locale, email_notifications')
      .in('id', userIds);

    let sent = 0;
    let debug = '';
    let considered = 0;
    for (const p of profiles ?? []) {
      if (!p.email || !p.email_notifications) continue;
      considered++;
      const html = layout({
        title: tr(p.locale, 'assignedTitle'),
        body: tr(p.locale, 'assignedBody', { title: item.title, space: spaceName }),
        ctaUrl: `${APP_URL()}/space/${item.space_id}`,
        ctaLabel: tr(p.locale, 'open'),
      });
      const res = await sendEmail(p.email, tr(p.locale, 'assignedSubject', { title: item.title }), html);
      if (res.ok) sent++;
      else debug = res.detail;
      await sb.from('notifications_log').insert({ type: 'item_assigned', item_id: item.id, user_id: p.id });
    }
    return json({ ok: true, sent, considered, debug });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
