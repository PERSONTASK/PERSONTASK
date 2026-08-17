# PERSONTASK

Aplicação web (PWA) de **gestão de tarefas e pessoas por responsabilidade**, com
alertas de prazo, anexos, comentários com menção e notificações por e-mail.

- **Frontend:** React + TypeScript + Vite + Tailwind CSS
- **Backend (BaaS):** Supabase — Postgres, Auth (e-mail/senha + Google), Storage, Row Level Security
- **E-mails:** Supabase Edge Functions + Resend (free tier)
- **i18n:** Português · English · Español
- **PWA:** instalável em Android e iOS

Terminologia do produto: **Espaço** (workspace) · **Painel** (board) · **Coluna** · **Item** (tarefa).

> ⚠️ **Este projeto foi gerado sem uma etapa de build/execução** (a máquina de
> geração não possui Node.js instalado). O código está completo e organizado,
> mas **ainda não foi compilado nem testado em runtime**. Siga o setup abaixo
> para instalar, rodar e validar. Veja também a seção **Pendências & limitações**.

---

## 1. Pré-requisitos

- **Node.js 18+** e npm — https://nodejs.org
- Conta gratuita no **Supabase** — https://supabase.com
- Conta gratuita no **Resend** (e-mails) — https://resend.com
- (Opcional) **Supabase CLI** — https://supabase.com/docs/guides/cli

## 2. Instalação

```bash
npm install
cp .env.example .env   # depois preencha os valores (passo 4)
```

## 3. Configurar o Supabase

1. Crie um projeto no Supabase.
2. **Banco + RLS + Storage:** no SQL Editor, execute o conteúdo de
   [`supabase/schema.sql`](supabase/schema.sql). Isso cria tabelas, funções,
   políticas de segurança, os 3 perfis de acesso padrão (Administrador, Gestor,
   Usuário) e os buckets de Storage (`attachments`, `avatars`, `space-backgrounds`).
3. **Login com Google:** Authentication → Providers → Google → habilite e informe
   `Client ID`/`Secret` (crie no Google Cloud Console → OAuth 2.0). Em
   Authentication → URL Configuration, adicione `http://localhost:5173` e a URL de
   produção em *Redirect URLs* (`.../auth/callback`).
4. **Confirmação de e-mail:** em dev pode ficar desabilitada (login imediato). Em
   produção, habilite Authentication → Email → *Confirm email*.

## 4. Variáveis de ambiente (`.env`)

```env
VITE_SUPABASE_URL=https://<PROJECT_REF>.supabase.co
VITE_SUPABASE_ANON_KEY=<ANON_PUBLIC_KEY>
VITE_APP_URL=http://localhost:5173
```

## 5. Rodar em desenvolvimento

```bash
npm run dev            # http://localhost:5173
npm run typecheck      # checagem de tipos (recomendado após instalar)
npm run build          # build de produção
npm run preview        # servir o build
```

## 6. Edge Functions (e-mails transacionais)

As funções ficam em [`supabase/functions`](supabase/functions). Há **exatamente
3 gatilhos** de e-mail (mais o convite), conforme especificação:

| Função                 | Gatilho                                   | Como é disparada                    |
|------------------------|-------------------------------------------|-------------------------------------|
| `notify-item-assigned` | Novo Item atribuído a um usuário          | pelo app ao definir responsáveis    |
| `notify-mention`       | Menção `@usuário` em comentário           | pelo app ao comentar                |
| `notify-due-soon`      | Vencimento próximo (antecedência do Espaço) | **cron diário** (ver abaixo)      |
| `send-invite`          | Convite de novo membro                    | pelo app ao criar convite           |

Deploy e segredos (Supabase CLI):

```bash
supabase functions deploy notify-item-assigned notify-mention notify-due-soon send-invite

supabase secrets set RESEND_API_KEY=re_xxx
supabase secrets set EMAIL_FROM="PERSONTASK <no-reply@seudominio.com>"
supabase secrets set APP_URL=https://app.seudominio.com
# SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY já são injetados automaticamente.
```

**Agendamento do vencimento próximo:** execute [`supabase/cron.sql`](supabase/cron.sql)
(usa `pg_cron` + `pg_net`) para chamar `notify-due-soon` uma vez ao dia.

> Fora desses gatilhos, **nenhum e-mail é enviado** — a ferramenta não funciona
> como emissor livre de e-mails.

## 7. Logotipo (troca automática por tema)

Os caminhos ficam centralizados no componente
[`src/components/Logo.tsx`](src/components/Logo.tsx), que escolhe automaticamente:

- `src/assets/logo-full.svg` — para **fundos claros** (texto escuro)
- `src/assets/logo-full-dark.svg` — para **fundos escuros** (texto claro)

Substitua esses dois arquivos pelos oficiais (mesmo nome) e o logo é atualizado em
login, cabeçalho, e-mails (embutido) e como base do favicon/ícones do PWA.

## 8. PWA / ícones

O manifest e o service worker são configurados por `vite-plugin-pwa` em
[`vite.config.ts`](vite.config.ts). Um ícone SVG está em `public/icons/icon.svg`.
Para instalação com qualidade de loja, gere os PNGs e splash a partir do logo:

```bash
npx @vite-pwa/assets-generator --preset minimal-2023 public/icons/icon.svg
```

## 9. Estrutura

```
src/
  assets/            logo-full.svg, logo-full-dark.svg
  components/        Logo, Avatar, Modal, ProfileMenu, ThemeToggle, LanguageSwitcher, …
  contexts/          Auth, Theme, Space (permissões, membros, etiquetas, campos)
  features/
    auth/            login, cadastro, convite, callback OAuth
    overview/        visão geral dos Espaços
    space/           board (DnD), colunas, itens, item detail, membros, ajustes
    profile/         perfil pessoal
  i18n/              pt / en / es
  lib/               supabase, api (acesso a dados), utils, validação
  types/             modelo de domínio
supabase/
  schema.sql         tabelas + RLS + storage + triggers
  cron.sql           agendamento do e-mail de vencimento
  functions/         Edge Functions (e-mails)
```

## 10. Planos (Grátis × Premium)

Sem gateway de pagamento nesta versão — o plano é o campo `profiles.plan`
(`free` | `premium`). Alterne em **Perfil → Plano** para testar os recursos Premium
(múltiplos Espaços, imagem de fundo, escolha de fonte, Espaços interligados).

---

## Pendências & limitações (honestas)

1. **Não compilado/executado aqui** — rode `npm install`, `npm run typecheck` e
   `npm run dev`. Podem surgir pequenos ajustes de tipos/import na primeira
   compilação; o código foi escrito para passar em `strict`, mas não foi validado
   por um compilador nesta geração.
2. **Ícones PNG e splash do PWA** não foram gerados (sem Node). Use o comando do
   passo 8. O `icon.svg` é um placeholder derivado do logo.
3. **Logos são placeholders** — substitua pelos SVGs oficiais.
4. **Fontes Premium (Google):** ✅ resolvido — as 6 famílias são carregadas via
   `<link>` do Google Fonts em `index.html` (e cacheadas pelo PWA via workbox),
   então a troca de fonte do Espaço tem efeito visual imediato. Para 100% offline
   sem depender do CDN, auto-hospede os `.woff2` (ex.: `@fontsource/*`) e troque o
   `<link>` por imports locais.
5. **Realtime (colaboração ao vivo)** não está ligado; há uma linha comentada em
   `schema.sql` para publicar as tabelas. Hoje a UI recarrega após mutações.
6. **Empacotamento nativo (Capacitor)** e **cobrança** ficam para versão futura,
   conforme a especificação.
7. **Testes automatizados** não incluídos.
8. **Reordenação por posição** usa índices sequenciais (0..n) atualizados em lote;
   para escala muito alta, considere posicionamento fracionário.

## Licença

Proprietário — © PERSONTASK.
