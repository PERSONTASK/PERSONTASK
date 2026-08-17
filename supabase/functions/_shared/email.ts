// Deno / Supabase Edge runtime module (não faz parte do build do Vite).
// Envio de e-mails transacionais via Resend + templates PT/EN/ES.
import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

/** Cliente com service role (ignora RLS) — use apenas dentro das functions. */
export function adminClient(): SupabaseClient {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } },
  );
}

type Locale = 'pt' | 'en' | 'es';

export const STRINGS: Record<Locale, Record<string, string>> = {
  pt: {
    assignedSubject: 'Nova tarefa para você: {title}',
    assignedTitle: 'Existe uma nova tarefa para você',
    assignedBody: 'Você foi definido como responsável pela tarefa <b>{title}</b> no Espaço <b>{space}</b>.',
    dueSubject: 'Sua tarefa "{title}" vence em {days}',
    dueTitle: 'Prazo se aproximando',
    dueBody: 'Sua tarefa <b>{title}</b> vence em <b>{days}</b>.',
    mentionSubject: '{author} mencionou você',
    mentionTitle: 'Você foi mencionado em um comentário',
    mentionBody: '<b>{author}</b> mencionou você na tarefa <b>{title}</b>:',
    inviteSubject: '{inviter} convidou você para {space}',
    inviteTitle: 'Convite para colaborar',
    inviteBody: '<b>{inviter}</b> convidou você para o Espaço <b>{space}</b> (ID: {spaceId}) no PERSONTASK.',
    open: 'Abrir no PERSONTASK',
    days_one: '{n} dia',
    days_other: '{n} dias',
    today: 'hoje',
    tomorrow: 'amanhã',
  },
  en: {
    assignedSubject: 'New task for you: {title}',
    assignedTitle: 'There is a new task for you',
    assignedBody: 'You were set as responsible for the task <b>{title}</b> in the Space <b>{space}</b>.',
    dueSubject: 'Your task "{title}" is due in {days}',
    dueTitle: 'Deadline approaching',
    dueBody: 'Your task <b>{title}</b> is due in <b>{days}</b>.',
    mentionSubject: '{author} mentioned you',
    mentionTitle: 'You were mentioned in a comment',
    mentionBody: '<b>{author}</b> mentioned you in the task <b>{title}</b>:',
    inviteSubject: '{inviter} invited you to {space}',
    inviteTitle: 'Invitation to collaborate',
    inviteBody: '<b>{inviter}</b> invited you to the Space <b>{space}</b> (ID: {spaceId}) on PERSONTASK.',
    open: 'Open in PERSONTASK',
    days_one: '{n} day',
    days_other: '{n} days',
    today: 'today',
    tomorrow: 'tomorrow',
  },
  es: {
    assignedSubject: 'Nueva tarea para ti: {title}',
    assignedTitle: 'Hay una nueva tarea para ti',
    assignedBody: 'Fuiste asignado como responsable de la tarea <b>{title}</b> en el Espacio <b>{space}</b>.',
    dueSubject: 'Tu tarea "{title}" vence en {days}',
    dueTitle: 'Fecha límite próxima',
    dueBody: 'Tu tarea <b>{title}</b> vence en <b>{days}</b>.',
    mentionSubject: '{author} te mencionó',
    mentionTitle: 'Te mencionaron en un comentario',
    mentionBody: '<b>{author}</b> te mencionó en la tarea <b>{title}</b>:',
    inviteSubject: '{inviter} te invitó a {space}',
    inviteTitle: 'Invitación para colaborar',
    inviteBody: '<b>{inviter}</b> te invitó al Espacio <b>{space}</b> (ID: {spaceId}) en PERSONTASK.',
    open: 'Abrir en PERSONTASK',
    days_one: '{n} día',
    days_other: '{n} días',
    today: 'hoy',
    tomorrow: 'mañana',
  },
};

export function tr(locale: string, key: string, vars: Record<string, string | number> = {}): string {
  const l = (['pt', 'en', 'es'].includes(locale) ? locale : 'pt') as Locale;
  let s = STRINGS[l][key] ?? STRINGS.pt[key] ?? key;
  for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, String(v));
  return s;
}

export function daysLabel(locale: string, days: number): string {
  if (days <= 0) return tr(locale, 'today');
  if (days === 1) return tr(locale, 'tomorrow');
  return tr(locale, 'days_other', { n: days });
}

/** Wrapper HTML com a identidade PERSONTASK (gradiente da marca). */
export function layout(opts: { title: string; body: string; ctaUrl: string; ctaLabel: string }): string {
  return `<!doctype html><html><body style="margin:0;background:#f3f3fa;font-family:Roboto,Arial,sans-serif;color:#0f0f1e">
  <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px">
    <table width="480" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 8px 30px rgba(0,0,0,.08)">
      <tr><td style="background:linear-gradient(135deg,#3B82F6,#6366F1,#8B5CF6);padding:22px 28px">
        <span style="color:#fff;font-weight:800;font-size:18px;letter-spacing:.5px">PERSON<span style="opacity:.85">TASK</span></span>
      </td></tr>
      <tr><td style="padding:28px">
        <h1 style="margin:0 0 12px;font-size:18px">${opts.title}</h1>
        <div style="font-size:14px;line-height:1.6;color:#3a3a52">${opts.body}</div>
        <a href="${opts.ctaUrl}" style="display:inline-block;margin-top:22px;background:#6366F1;color:#fff;text-decoration:none;padding:11px 20px;border-radius:8px;font-weight:600;font-size:14px">${opts.ctaLabel}</a>
      </td></tr>
      <tr><td style="padding:16px 28px;border-top:1px solid #eee;color:#9898b8;font-size:12px">© ${new Date().getFullYear()} PERSONTASK</td></tr>
    </table>
  </td></tr></table></body></html>`;
}

/** Resultado do envio, com detalhe para diagnóstico. */
export interface SendResult {
  ok: boolean;
  detail: string;
}

/** Envia um e-mail via Resend. */
export async function sendEmail(to: string, subject: string, html: string): Promise<SendResult> {
  const apiKey = Deno.env.get('RESEND_API_KEY');
  const from = Deno.env.get('EMAIL_FROM') ?? 'PERSONTASK <no-reply@persontask.app>';
  if (!apiKey) {
    console.warn('RESEND_API_KEY ausente — e-mail não enviado:', subject);
    return { ok: false, detail: 'RESEND_API_KEY ausente nos secrets' };
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to, subject, html }),
  });
  const body = await res.text();
  if (!res.ok) console.error('Resend error', res.status, body);
  return { ok: res.ok, detail: res.ok ? 'sent' : `Resend ${res.status}: ${body.slice(0, 240)}` };
}

export const APP_URL = () => Deno.env.get('APP_URL') ?? 'http://localhost:5173';
