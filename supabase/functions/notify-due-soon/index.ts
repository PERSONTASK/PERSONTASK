// Gatilho 2/3 — Vencimento próximo. Executada por AGENDAMENTO (cron).
// Para cada Item com due_at dentro da antecedência do Espaço (due_soon_lead_days),
// envia "Sua tarefa X vence em N dias" aos responsáveis (1x por dia, deduplicado).
import { adminClient, corsHeaders, layout, sendEmail, tr, daysLabel, APP_URL } from '../_shared/email.ts';

const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

const DAY = 86400000;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const sb = adminClient();
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const horizon = new Date(startOfToday.getTime() + 31 * DAY); // limite superior generoso

    const { data: items } = await sb
      .from('items')
      .select('id, title, space_id, due_at, spaces(due_soon_lead_days), item_assignees(user_id)')
      .not('due_at', 'is', null)
      .gte('due_at', startOfToday.toISOString())
      .lte('due_at', horizon.toISOString());

    let sent = 0;
    for (const item of items ?? []) {
      const lead = (item as any).spaces?.due_soon_lead_days ?? 3;
      const due = new Date(item.due_at as string);
      const days = Math.ceil((new Date(due.getFullYear(), due.getMonth(), due.getDate()).getTime() - startOfToday.getTime()) / DAY);
      if (days < 0 || days > lead) continue;

      const assigneeIds = ((item as any).item_assignees ?? []).map((a: { user_id: string }) => a.user_id);
      if (assigneeIds.length === 0) continue;

      // Dedupe: quem já recebeu due_soon hoje para este item
      const { data: sentToday } = await sb
        .from('notifications_log')
        .select('user_id')
        .eq('type', 'due_soon')
        .eq('item_id', item.id)
        .gte('sent_at', startOfToday.toISOString());
      const already = new Set((sentToday ?? []).map((r) => r.user_id));

      const pending = assigneeIds.filter((id: string) => !already.has(id));
      if (pending.length === 0) continue;

      const { data: profiles } = await sb
        .from('profiles')
        .select('id, email, locale, email_notifications')
        .in('id', pending);

      for (const p of profiles ?? []) {
        if (!p.email || !p.email_notifications) continue;
        const label = daysLabel(p.locale, days);
        const html = layout({
          title: tr(p.locale, 'dueTitle'),
          body: tr(p.locale, 'dueBody', { title: item.title, days: label }),
          ctaUrl: `${APP_URL()}/space/${item.space_id}`,
          ctaLabel: tr(p.locale, 'open'),
        });
        if ((await sendEmail(p.email, tr(p.locale, 'dueSubject', { title: item.title, days: label }), html)).ok) sent++;
        await sb.from('notifications_log').insert({ type: 'due_soon', item_id: item.id, user_id: p.id });
      }
    }
    return json({ ok: true, sent });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
