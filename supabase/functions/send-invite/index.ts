// E-mail de convite. Invocada pelo app em api.invites.create.
// Body: { inviteId, appUrl? }  — link contém quem convidou, ID+nome do Espaço e o token.
import { adminClient, corsHeaders, layout, sendEmail, tr, APP_URL } from '../_shared/email.ts';

const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const { inviteId, appUrl } = await req.json();
    if (!inviteId) return json({ error: 'inviteId required' }, 400);

    const sb = adminClient();
    const { data: inv } = await sb
      .from('invites')
      .select('email, token, space_id, invited_by, spaces(name)')
      .eq('id', inviteId)
      .single();
    if (!inv) return json({ error: 'invite not found' }, 404);

    const { data: inviter } = inv.invited_by
      ? await sb.from('profiles').select('name, locale').eq('id', inv.invited_by).single()
      : { data: null };

    const spaceName = (inv as any).spaces?.name ?? 'PERSONTASK';
    const locale = inviter?.locale ?? 'pt';
    const base = appUrl || APP_URL();
    const link = `${base}/invite/${inv.token}?s=${encodeURIComponent(spaceName)}`;

    const html = layout({
      title: tr(locale, 'inviteTitle'),
      body: tr(locale, 'inviteBody', {
        inviter: inviter?.name ?? 'PERSONTASK',
        space: spaceName,
        spaceId: inv.space_id,
      }),
      ctaUrl: link,
      ctaLabel: tr(locale, 'open'),
    });

    const res = await sendEmail(
      inv.email,
      tr(locale, 'inviteSubject', { inviter: inviter?.name ?? 'PERSONTASK', space: spaceName }),
      html,
    );
    return json({ ok: res.ok, detail: res.detail });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
