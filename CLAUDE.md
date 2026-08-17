# PERSONTASK — briefing do projeto

App de **gestão de tarefas e pessoas por responsabilidade** (estilo Trello/Monday), pensado para ser comercializado (identidade própria, sem imitar terceiros). Interface em **PT/EN/ES**, PWA instalável.

## Stack
- **Frontend:** React + TypeScript + Vite + Tailwind CSS.
- **Backend (BaaS):** Supabase — Postgres, Auth (e-mail/senha + Google), Storage, RLS.
- **E-mails transacionais:** Supabase Edge Functions (Deno) + Resend.
- **i18n:** i18next (`src/i18n/locales/{pt,en,es}.json`).

## Terminologia (UI e banco)
**Espaço** = workspace · **Painel** = board · **Coluna** = column · **Item** = card/tarefa.

## Rodar localmente (Windows)
Node.js fica em `C:\Program Files\nodejs` mas às vezes não está no PATH do shell — prefixe:
```bash
export PATH="/c/Program Files/nodejs:$PATH"   # Git Bash
npm install
npm run dev        # http://localhost:5173  (ou clique 2x em iniciar-app.cmd)
npm run typecheck  # tsc --noEmit
npm run build      # tsc --noEmit + vite build
```
Requer `.env` (ver `.env.example`) com `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_APP_URL`. O `.env` é gitignored.

## Supabase
- Projeto do usuário: ref `wogilvheyciprqqkprol`.
- **Schema/RLS/Storage:** `supabase/schema.sql` (idempotente — rode no SQL Editor).
- **Edge Functions:** `supabase/functions/*` — 3 gatilhos de e-mail (item atribuído, vencimento via cron, menção) + convite. Deploy: `npx supabase functions deploy <nomes> --project-ref <ref> --no-verify-jwt`. Secrets: `RESEND_API_KEY`, `EMAIL_FROM`, `APP_URL`.
- **Cron** do vencimento: `supabase/cron.sql` (pg_cron + pg_net).
- Login do Supabase CLI fica no Windows Credential Manager (invisível ao shell Bash) — deploy roda no terminal do usuário.

## Estrutura
```
src/
  components/   Logo, Avatar, Modal, ProfileMenu, ThemeToggle, LanguageSwitcher…
  contexts/     Auth, Theme, Space (permissões, membros, etiquetas, campos)
  features/
    auth/       login, cadastro, convite, callback OAuth
    overview/   visão geral dos Espaços
    space/      board (DnD @dnd-kit), colunas, itens, ItemDetail, membros, ajustes
    profile/    perfil pessoal
  lib/          supabase, api (acesso a dados), utils, validação
  i18n/         pt / en / es
  types/        modelo de domínio (espelha schema.sql)
supabase/       schema.sql, cron.sql, functions/
```

## Modelo de dados (destaques)
- RLS por Espaço via funções `is_space_member` / `has_space_permission` (SECURITY DEFINER).
- Planos `profiles.plan` (`free`|`premium`) — gating no front e recursos (múltiplos Espaços, fonte, imagem de fundo, cor de Coluna, logo, Espaços interligados). **Sem gateway de pagamento** (troca manual no perfil).
- `items.checklists` (jsonb): checklists com % (recurso do card, não campo).
- Campos personalizados (`custom_field_defs`): tipos text/number/datetime/**checkbox**/select (checklist foi removido dos campos).

## Convenções
- Ao criar Espaço: inserir com `return=minimal` + reler (o `.insert().select()` falha por RLS na linha recém-criada).
- Embeds ambíguos precisam de hint de FK (ex.: `author:profiles!comments_author_id_fkey(*)`).
- Cores da marca: azul `#3B82F6` → índigo `#6366F1` → violeta `#8B5CF6`.
- Logos em `src/assets/logo-full{,-dark}.svg` (placeholders — substituir pelos oficiais).

## Deploy (produção)
- **App (frontend):** Netlify (`netlify.toml` + `public/_redirects` para SPA). Env vars no painel do Netlify.
- Domínio-alvo: `persontask.com` (Locaweb). Após publicar, adicionar a URL em Supabase **Auth → URL Configuration** e no secret **APP_URL** das Functions.
- E-mail: caixa humana na Locaweb; envio do app pelo Resend (domínio verificado).
