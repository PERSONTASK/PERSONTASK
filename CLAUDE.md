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

## Onboarding (card de boas-vindas + manual)
- **Manual do usuário:** `public/manual.html` (14 seções, reescrito em nov/2026 cobrindo CRM, cronograma, relatórios, avisos e moeda) + `public/PERSONTASK-Manual.pdf`. **Pipeline atual:** o PDF sai do próprio HTML, com Edge headless — `msedge --headless --no-pdf-header-footer --print-to-pdf="<abs>" --virtual-time-budget=12000 "http://localhost:5173/manual.html"` (precisa do `npm run dev` no ar). A rota antiga por docx-js + Word COM foi abandonada: gerar do HTML mantém os dois idênticos.
- **Card automático:** ao criar Espaço, `CreateSpaceDialog` chama `api.spaces.seedWelcome` → Painel "Bem-vindo" + Coluna + Item **"🧭 ESTÁ PERDIDO?! COMECE POR AQUI"** com os links do manual, no idioma atual (chaves i18n `welcome.*`). Não bloqueia a criação se falhar.
- **Acesso permanente:** `ProfileMenu` tem link **"Manual / Ajuda"** (`nav.manual`) → `${APP_URL}/manual.html` (nova aba).
- **Links clicáveis:** `ItemDetail` transforma URLs da descrição em botões (`extractUrls`) abaixo do textarea.

## Auth & limites (homologação V2, 2026-08-24)
- **Recuperar senha:** rotas públicas `/forgot-password` + `/reset-password`; `AuthContext.resetPassword` (`resetPasswordForEmail`, redirect `/reset-password`) e `updatePassword` (`updateUser`). Link "Esqueceu a senha?" na `LoginPage`. ⚠️ O e-mail de reset sai pelo **Supabase built-in** (não Resend) — para produção robusta, configurar SMTP custom (Resend) em Auth → Emails.
- **Plano Grátis = 1 Painel por Espaço:** `SpacePage.boardLimitReached = !isPremium && boards.length >= 1` → `SpaceTopBar` troca o "+" por cadeado com `board.freeLimitReached`.
- **Login mais vendedor:** `AuthLayout` com selo `promo.cta` ("Comece grátis hoje mesmo") + 5 destaques (`promo.f1..f5`).

## Espaços interligados — mover/copiar itens (só Administrador)
- `space_links` guarda a relação (`api.spaces.link`/`links`, Premium, criada em `SpaceSettingsPanel`).
- **Mover/copiar item** entre Espaços interligados: `ItemDetail` mostra o botão **"Mover/copiar"** só se `can('space.manage')` **e** houver Espaços interligados; abre `MoveCopyDialog` (escolhe Espaço/Painel/Coluna destino) → `api.items.copyToSpace`/`moveToSpace` (helper `copyItemToSpace`).
- **Comportamento:** leva título, descrição, checklists, prazo e anexos (recopiados no Storage do Espaço destino). **NÃO** leva responsáveis, etiquetas nem campos personalizados (são por-Espaço). Mover = copiar + apagar original.
- **Segurança:** o RLS já impede membros de ver outro Espaço; a lista de destinos vem de `spaces.links` (RLS-filtrada aos Espaços de que o admin é membro), então só o Administrador que interligou consegue.

## CRM — Organizações & Pessoas de contato
- **Banco:** `supabase/crm.sql` (idempotente) cria `organizations` e `contacts` (por Espaço; RLS: ver = `is_space_member`, escrever = `has_space_permission(space_id,'item.edit')`) e adiciona `items.organization_id` / `items.contact_id` (`on delete set null` — apagar cadastro não apaga negócio).
- **No card:** seção **Cliente** (`ClientSection.tsx`), revelada por "+ Adicionar → Cliente" ou automaticamente quando o card já tem vínculo. Dois seletores + criar/editar inline + painel somente-leitura (telefone/e-mail da pessoa; CNPJ, Nome Fantasia, Sistema, Segmento, Status da organização). Escolher a pessoa puxa a organização dela; trocar de organização desvincula pessoa de outra empresa.
- **Sistema/Segmento:** lista suspensa **auto-construída** (`SelectOrNew`) — as opções são os valores já usados no Espaço, mais "➕ Outro…" para criar na hora. Sem tabela de config e sem deploy para incluir valores.
- **Painel central:** `ClientsPanel.tsx` — botão 🏢 na `SpaceTopBar`; abas Organizações/Pessoas, busca, editar e excluir (edição gated por `item.edit`).
- **Template CRM** (`templates.ts`): campos Valor, Data de fechamento esperada, Origem do Negócio, Feeling, Time de Vendas, Próximo contato. O antigo campo "Empresa" saiu — virou o cadastro de Organização.
- **Cliente na face do card:** `items.listByBoard` embute `organization:organizations(id, name)` e o `ItemCard` mostra o nome da Organização com ícone 🏢 abaixo do título.
- **Template CRM vem preenchido:** `TemplateDef.organizations`/`contacts` criam **cadastros de exemplo** (reaproveitados por nome, igual às etiquetas) e os cards já nascem **vinculados** (`organizationIndex`/`contactIndex`) e com os **campos personalizados preenchidos** (`cardFieldValues` em SHAPE → resolvido por idioma em `getTemplates`: `{option: n}` aponta a opção traduzida, `{inDays: n}` gera data relativa a hoje, `{value}` é literal).

## Card concluído + avisos de prazo (sininho)
- **`items.done_at`** (`supabase/done.sql`, idempotente) — quando o card foi concluído **na mão**; nulo = em aberto. `scheduleStatus` e `effectiveSchedule` devolvem **verde** se houver `done_at`, então o card para de alertar mesmo com a Data de entrega vencida. UI: botão **Concluir / Concluído em …** no topo do `ItemDetail` (título fica riscado) + selo verde no `ItemCard`. Não é copiado ao duplicar — a cópia nasce em aberto.
- ⚠️ `api.items.update` apaga `organization` do patch: é embed de leitura, não coluna de `items`.
- **Ações no próprio sininho** (`canEdit`): **Concluir** grava `done_at`; **Remarcar prazo** abre um date input inline e grava `due_at`. Os dois tiram a linha da lista na hora, sem abrir o card.
- `api.items.listOverdue(spaceId)` traz os cards com `due_at` já passado **com Painel/Coluna embutidos** (`columns(id, title, board_id, boards(id, name))`); o filtro fino usa `effectiveSchedule(item).status === 'red'` no cliente, para bater com o semáforo do resto do app.
- `NotificationsBell.tsx` fica na `SpaceTopBar` ao lado de 🏢/Membros. **Contador** = avisos ainda não vistos; abrir zera (o "já vi" é um Set de ids em `localStorage`, por Espaço — some em aba anônima, e tudo bem). **O aviso em si NÃO some ao abrir**: ele só sai quando o card deixa de estar vencido.
- Clicar leva ao card: a `SpacePage` troca o `activeBoardId` e abre um `ItemDetail` próprio (`alertItemId`), independente do `BoardView`. Fechar incrementa `alertsToken` → o sininho recarrega e o aviso resolvido some.

## Template de Projetos (card = projeto)
- **Campos:** Prioridade (lista, na face) · Tipo de Projeto (lista: Implantação/Melhoria/Integração/Migração/Suporte/Outro, na face) · Número da Proposta (texto). **Cliente** vem do cadastro CRM (face). **Checklist** "Marcos do projeto" (Reunião de abertura, Documentação inicial, Status report, Go-live, Finalização) — o checklist já aparece na face com %. **Término previsto** = `due_at`, preenchido pelo cronograma.
- **Cronograma modelo DATADO:** `TemplateDef.cards[].schedule` (nomes em `TEXT`; níveis em `SHAPE.cardScheduleIndents` e durações em `SHAPE.cardScheduleDurations`) → `buildTemplateSchedule()` em `api.ts` monta as tarefas em **modo automático** com **predecessoras encadeadas** (fases fora da corrente) e roda o `autoSchedule` a partir do **próximo dia útil** — o card nasce com um projeto já datado (~74 dias úteis, 592 h). 5 fases: INICIAÇÃO · EXECUÇÃO · HOMOLOGAÇÃO · **PRODUÇÃO** · FINALIZAÇÃO. Sem durações no SHAPE, o cronograma nasce em branco (o `autoSchedule` nem roda).
- Duplicar o card leva o cronograma inteiro (`api.items.duplicate` carrega `schedule_tasks` e `schedule_calendar`).
- ⚠️ **Revelar a seção Cronograma:** o `show.schedule` do `ItemDetail` precisa contar `item.schedule_tasks.length` — cards cujo cronograma mora **só** nas tarefas internas (template, duplicata, importação) não têm `start_at`/`progress`/`work_hours`/`cost` preenchidos e a seção ficava **invisível** apesar das tarefas estarem gravadas. O `templates.apply` também já grava `start_at`/`due_at` com o consolidado do cronograma modelo.

## Cronograma — gestão de projetos (Fase 2)
- **Banco:** `supabase/schedule.sql` (idempotente) adiciona em `items`: `start_at` (Início), `work_hours`, `cost`, `progress` (0–100; nulo = usa o % do checklist) e `schedule_mode` (`manual`|`auto`). O **Término continua sendo `due_at`**. Não precisa de RLS nova.
- **Cálculos:** `src/lib/schedule.ts` — `durationDays`, `plannedProgress` (% pelo tempo decorrido), `actualProgress`, `scheduleStatus` (🟢 no prazo · 🟡 vence em ≤5 dias · 🔴 vencido) e `isBehindPlan`. **Nada é gravado**: tudo é derivado de Início/Término/%.
- **No card:** `ScheduleSection.tsx`, revelada por "+ Adicionar → Cronograma" ou quando já existem dados. A Duração é editável e recalcula o `due_at` a partir do Início (`endFromDuration`).
- **Visão LISTA:** `ScheduleView.tsx` — alternador **Quadro ↔ Lista** na `SpaceTopBar` (prop `viewMode`, ainda `'schedule'` no código; o rótulo `view.schedule` virou "Lista"). Desde que o cronograma passou a morar **dentro** do card, esta visão deixou de ser um cronograma: ficaram ID, Tarefa, Fase, Duração, Início, Término, Situação, Custo e Observações (saíram EDT, %Concl., %Prev., Trabalho, Modo e Responsáveis). A tabela fica num **cartão opaco** (`bg-surface-base`) para não disputar legibilidade com a cor/imagem de fundo do Espaço.
- **Export:** `src/lib/exportTable.ts` — Excel (`xlsx`) e PDF (`jspdf` + `jspdf-autotable`, A4 paisagem, coluna Situação colorida). As libs entram por **`import()` dinâmico** → chunks separados; não pesam o bundle principal.
- **Cronograma POR PROJETO (card = projeto):** `supabase/project-schedule.sql` adiciona `items.schedule_tasks` (JSONB, default `[]`). Cada tarefa: `{id, name, indent (0=fase | 1=tarefa), start, end, progress, work, cost, mode, predecessors[], notes}`. UI em `ProjectScheduleModal.tsx` — tabela editável com **autosave (700 ms)** + **Gantt em SVG puro** (barras coloridas pelo semáforo, setas de dependência, linha do "hoje", zoom dia/semana) + export Excel/PDF. As **predecessoras são digitadas por EDT** ("1.1, 1.2") e convertidas para ids em `parsePredecessors`.
- **Consolidação:** `effectiveSchedule(item)` — se o card tem tarefas internas, Início/Término/%/Trabalho/Custo vêm **consolidados** delas (% ponderado por duração); senão, dos campos do próprio card. A `ScheduleView` do Painel usa isso → o Painel vira a visão de **portfólio** e a `ScheduleSection` esconde os campos manuais quando há tarefas.
- `api.items.duplicate` e `copyItemToSpace` carregam os campos de cronograma e o `schedule_tasks` (o cronograma viaja com o card).
- **Tela cheia + importar:** o `Modal` ganhou as props `fullScreen` e `headerExtra`; o cronograma abre **maximizado por padrão**, com botão de restaurar. `ImportScheduleDialog` + `cloneTasks` copiam a **estrutura de outro card** (ids novos, predecessoras remapeadas, % zerado opcional e datas deslocadas para um novo início mantendo durações). `api.items.listWithSchedule(spaceId, exceptId)` lista os cards que já têm cronograma.
- **Recursos & calendário:** `supabase/resources-calendar.sql` cria a tabela `resources` (por Espaço: nome, função, `hourly_cost`, e-mail; RLS igual a `contacts`) e adiciona `items.schedule_calendar` (JSONB `{workdays, holidays, hoursPerDay}`; nulo = seg–sex, 8 h). `ScheduleDialogs.tsx` traz `ResourcesDialog` (edição inline, grava no blur) e `CalendarDialog`. A tarefa ganhou `resourceId` e, ao mudar recurso ou horas, o **custo é recalculado** (horas × custo/hora) em `patchWithCost`.
- **Dias úteis:** `calendarOf`, `isWorkday`, `workingDaysBetween` e `addWorkingDays` em `schedule.ts`. `taskDuration(task, cal)` conta **apenas dias úteis**; já as barras do Gantt usam o span de **dias corridos** (início→término) para desenhar na posição certa da linha do tempo.
- **Rolagem presa na área visível:** `Modal` ganhou `bodyScroll` — com `false` o corpo vira `min-h-0 overflow-hidden` e **o conteúdo controla a própria rolagem**. Em tela cheia o cronograma usa `flex h-full flex-col` com a tabela/Gantt em `min-h-0 flex-1 overflow-auto`, então a **barra horizontal fica no rodapé da tela** (antes só aparecia no fim de todas as tarefas) e o cabeçalho da tabela é `sticky top-0`. Fora da tela cheia, volta ao comportamento antigo.
- ⚠️ **Modal em Portal (bug importante):** `Modal` renderiza com `createPortal(..., document.body)`. Sem isso, o `transform` do `SidePanel` (animação de deslizar) vira bloco de contenção do CSS e **prende** qualquer `position: fixed` dentro do painel — era por isso que a tela cheia do cronograma ficava confinada à lateral.
- **Agendamento automático em FRAÇÕES de dia:** `autoSchedule(tasks, cal, fallbackStart)` usa a classe `WorkdayRuler` — uma régua de **dias úteis fracionários** onde 0 é o começo do 1º dia útil e 1,5 é a metade do 2º. Uma tarefa ocupa `[s, s+duração)`; Início = dia `floor(s)`, Término = dia `ceil(s+d)-1`. Assim **duas tarefas de 0,5 dia cabem no mesmo dia** e uma de 1,5 dia termina no 2º dia **com a seguinte emendando nesse mesmo 2º dia** (nas horas que sobraram). `duration` aceita fração (0,5 = 4 h numa jornada de 8 h) e os dois sentidos Duração↔Trabalho produzem frações. Roda **duas passadas** (agenda → consolida → agenda → consolida) para resolver tarefas que dependem de uma fase. É **idempotente** (testado).
- **Consolidação das fases (`rollupSummaries`):** fase/tarefa-resumo recebe Início = menor das filhas · Término = maior · Trabalho e Custo = soma · % = média ponderada pela duração. Processa de baixo para cima (subtarefa → tarefa → fase). Na tabela essas células ficam **desabilitadas** (`isSummary(tasks, i)` → `locked`), com tooltip `schedule.summaryLocked`.
- ⚠️ **`rollupTasks` pula as linhas-resumo** nas somas — elas já carregam o consolidado das filhas, e contá-las de novo **dobrava** Trabalho/Custo do card. `count` passou a ser o nº de tarefas-folha.
- **Duração ↔ Trabalho (bidirecional):** editar a Duração recalcula **Trabalho = dias × horas/dia**; editar o Trabalho recalcula **Duração = ceil(horas ÷ horas/dia)** (`setWork`). Os dois sempre recalculam o custo.
- **Atalhos na tabela** (`cellKeys` + `focusCell`, qualquer célula via `data-cell="<taskId>|<col>"`): **↑ ↓** andam na mesma coluna; **Enter** cria uma linha abaixo e foca nela (herdando o modo da anterior); **Tab** na última coluna (Observações) da última linha também cria.
- **3 níveis:** `MAX_INDENT = 2` — Fase (0) › Tarefa (1) › Subtarefa (2). A setinha ao lado da lixeira **cicla** os três. `computeWbs` numera `1` / `1.1` / `1.1.1`; `isSummary(tasks, i)` detecta tarefa-resumo (o próximo item é mais fundo) e o `autoSchedule` **não agenda** resumos nem fases — elas consolidam os filhos.
- **Múltiplos responsáveis:** `ScheduleTask.resourceIds[]` (o antigo `resourceId` continua sendo lido por `resourceIdsOf()`). O custo = horas × **soma** dos custos/hora de todos (`applyCost`) — dois a R$ 100/h em 10 h = R$ 2.000. UI: chips com × + lista "+ responsável".
- **Farol geral (desempenho):** `performanceStatus(real, previsto)` — 🟢 real ≥ previsto · 🟡 até 10 p.p. abaixo · 🔴 mais de 10 p.p. abaixo. Faixa no topo do cronograma com barra, % real, % previsto e desvio. `plannedFor` virou exportado.
- **Gantt Real × Previsto:** botão que divide cada barra em duas — em cima o real (cor do semáforo), embaixo o previsto pelo tempo decorrido (cinza).
- **Export do Gantt em PDF:** `src/lib/exportGantt.ts` desenha o Gantt **vetorial** direto na `jspdf` (rects + lines, sem html2canvas), com régua semanal/mensal, linha do "hoje", paginação e legenda.
- **Export XML (MSPDI):** `src/lib/exportProjectXml.ts` gera o XML do **Microsoft Project Data Interchange** (abre em Arquivo › Abrir), com calendário, EDT/níveis, durações, trabalho, %, custo, predecessoras, recursos e alocações. **.MPP é impossível** (binário/proprietário, sem especificação pública de escrita). Limitações propositais para o arquivo não quebrar na validação do schema: feriados **não** viram exceções de calendário e as Observações não sobem.
- **Emoji no PDF:** as fontes padrão da `jspdf` (WinAnsi) não têm emoji — 🟢 saía como `Ø=ßã` e comia a largura. `exportTable.ts` tem `forPdf()`, que **tira o emoji só no PDF** (a cor da célula já diz a situação) e dá `minCellWidth` à coluna Situação. No Excel o emoji continua.
- **Término previsto:** quando o card tem tarefas, o autosave do cronograma grava `start_at`/`due_at` com o **Início/Término consolidados** — então o "término previsto" do projeto aparece na face do card, nos alertas de vencimento e no portfólio. Fica em branco enquanto não houver datas nas tarefas.

## Testar local contra o Supabase de produção
- `npm run dev` serve do código-fonte (o `dist` não é usado) e o `.env` já aponta `VITE_APP_URL=http://localhost:5173`.
- ⚠️ **Login pelo Google volta pro domínio publicado** se `http://localhost:5173/**` não estiver em Supabase → Authentication → **URL Configuration → Redirect URLs**. Sem isso o Supabase ignora o `redirectTo` e cai no **Site URL** (`https://persontask.com.br`) — o usuário acha que está no local e está no ar. O Site URL não muda; o Google Cloud Console também não (lá o redirect é o do Supabase).
- O PWA (`devOptions: { enabled: false }`) não registra service worker em dev, então não há cache velho no localhost.

## Convenções
- ⚠️ **Três nomes para o mesmo campo:** `items.due_at` aparece como **"Data de entrega"** no card (`item.dueDate`), **"Término"** no cronograma e na Lista. Só ele alimenta semáforo, sininho e e-mails de vencimento — **campo personalizado de data NÃO alimenta nada disso** (já confundiu o usuário em homologação). Unificar como "Término" está na fila.
- Ao criar Espaço: inserir com `return=minimal` + reler (o `.insert().select()` falha por RLS na linha recém-criada).
- Embeds ambíguos precisam de hint de FK (ex.: `author:profiles!comments_author_id_fkey(*)`).
- Cores da marca: azul `#3B82F6` → índigo `#6366F1` → violeta `#8B5CF6`.
- Logos em `src/assets/logo-full{,-dark}.svg` (placeholders — substituir pelos oficiais).

## Deploy (produção)
- **App (frontend):** Netlify (`netlify.toml` + `public/_redirects` para SPA). Env vars no painel do Netlify.
- Domínio-alvo: `persontask.com` (Locaweb). Após publicar, adicionar a URL em Supabase **Auth → URL Configuration** e no secret **APP_URL** das Functions.
- **E-mail:** app envia via Resend (domínio `persontask.com.br` verificado). Os e-mails do **Supabase Auth** (reset de senha, confirmação, etc.) saem via **Resend SMTP** — Authentication → Emails → SMTP: `smtp.resend.com` porta `465`, Username `resend` (**minúsculo**), Password = Resend API key, Sender `no-reply@persontask.com.br`. Templates PT (com a marca) em **`supabase/email-templates/`** — colar em Authentication → Emails → Templates (ver README de lá). Caixa humana: Gmail `contato.persontask@gmail.com`.

## Relatórios (3ª visão do Painel) + Moeda
- **SQL:** `supabase/reports.sql` (idempotente) — `spaces.currency` (ISO 4217, default `BRL`) e `boards.report_config` (jsonb).
- **Moeda é do ESPAÇO**, uma só: `src/lib/money.ts` (`formatMoney`, `currencySymbol`, `formatCompact`). `Intl.NumberFormat` já entrega `R$ 41.150,00` / `US$ 41.150,00` / `€ 41.150,00` conforme o idioma. Seletor em Configurações do Espaço. Vale para Custo/Custo-hora do cronograma, a Lista e os campos numéricos com `config.money`.
- **Campo numérico vira dinheiro** com a caixinha **Moeda** no `FieldsManager` (`custom_field_defs.config.money`); `formatFieldValue` passa a formatar. O template CRM já cria o campo **Valor** marcado como moeda (`SHAPE.crm.fieldMoney`).
- **`ReportView.tsx`** — terceiro botão **Quadro · Lista · Relatório** (`ViewMode` em `types`). Duas abas:
  - **Funil**: exige `boards.report_config` = `{valueFieldId, columnRoles}` — qual campo numérico é o valor e o papel de cada Coluna (`open|won|lost|ignore`). Sem isso não há como calcular ganho/conversão, então a aba convida a configurar (`ReportConfigDialog.tsx`). KPIs (aberto/ganho/perdido/ticket), valor por etapa, rosca de conversão, ganhos por mês e por responsável, e os 8 maiores em aberto.
  - **Tarefas**: sem configuração nenhuma. No prazo / vencendo / atrasadas / concluídas / sem data, atrasadas por Coluna e por responsável, e a lista clicável.
  - Tudo calculado **no cliente** a partir dos itens do Painel — nenhuma consulta nova, nenhum número gravado.
- **`src/components/Charts.tsx`** — `Kpi`, `BarsH`, `BarsV`, `Donut`, `Panel` em SVG/HTML puro. Sem biblioteca de gráficos: seriam ~100 KB para duas telas. ⚠️ `BarsV` é HTML, não SVG — texto em SVG com `preserveAspectRatio="none"` sai distorcido.
- Exportação PDF/Excel do relatório **ainda não existe** — ficou para a rodada seguinte.

## Página de abertura (landing)
- `src/features/landing/LandingPage.tsx` + rota raiz `HomeRoute` em `App.tsx`: **visitante vê a landing em `/`, quem entrou cai nos seus Espaços**. `/` saiu de dentro do `ProtectedRoute`; as demais rotas protegidas seguem iguais.
- Argumento central: **CRM + Projetos + Tarefas num app só**, mais simples e mais barato que contratar os três. Só lista função que existe de verdade. Textos em `landing.*` nos 3 idiomas.
- **Sem tabela de preços ainda** — combinado com o usuário que preço se decide depois.
- **Galeria "Veja por dentro"**: abas Quadro · Cronograma · Gantt · Relatório, com moldura de janela. As imagens vêm de `public/landing/{quadro,cronograma,cronograma2,relatorio}.png` (nomes **sem acento** — acento no nome quebra a URL) (ver `public/landing/LEIA-ME.txt`); se o arquivo não existir, o `onError` troca por um painel do gradiente com "Imagem em breve" — a página nunca quebra por falta de captura.
- ⚠️ Tom do texto: a seção "Um app, uma assinatura" **não** se compara dizendo que o produto é menos completo (era autodepreciativo). A simplicidade é apresentada como vantagem.

## Relatório: exportação e eventos
- `exportTable.ts` ganhou `ExportReport` + `exportReportToXlsx` (uma **aba por bloco**, nome saneado a 31 chars e único) e `exportReportToPdf` (A4 retrato, uma seção por bloco, `lastAutoTable.finalY` encadeia).
- O `ReportView` calcula em `buildFunnel`/`buildTasks` **fora dos componentes de tela**, e a exportação usa os mesmos objetos — o arquivo nunca diverge do que está na tela.
- **Sininho atualiza sozinho:** `api.items.create/update/remove/setColumn` disparam o evento `ITEMS_CHANGED` no `window`; o `NotificationsBell` escuta com 800 ms de espera. Assim nenhuma tela precisa conhecer o sininho (antes só recarregava ao abrir o card pelo próprio aviso).
- **Nome unificado:** `item.dueDate` virou **Término / Finish / Fin**, igual ao cronograma e à Lista.

## Migrar card entre Espaços: manter o original
- **SQL:** `supabase/migrate-keep.sql` — `spaces.keep_on_migrate` (boolean, default **true**).
- O `MoveCopyDialog` deixou de ter dois botões iguais (Copiar / Mover) e passou a ter **uma escolha explícita** com as consequências escritas: *manter o card aqui também* (cópia, preserva metas, valores fechados e histórico) ou *tirar deste Espaço* (mover). Um botão só: **Migrar**. O padrão vem de `space.keep_on_migrate` e pode ser mudado na hora.
- O parâmetro fica em Configurações do Espaço → **Migrar cards**.

## Período nos relatórios
- `src/lib/period.ts` — `Period` (`all | week | month | year | custom`), `resolveRange`, `inRange`, `buildBuckets`, `describeRange`, `referenceDate`.
- **Data de referência de um card = `done_at` e, na falta dela, o Término consolidado** (`effectiveSchedule(item).end`). É o que responde "quando isso aconteceu" tanto para negócio ganho quanto para tarefa. Card **sem data fica fora** de qualquer período — o `ReportView` mostra quantos ficaram, para o número não parecer errado.
- A semana começa na **segunda**. O gráfico de evolução muda de granularidade sozinho: ≤14 dias por dia, ≤92 por semana, acima disso por mês; sem período, últimos 6 meses.
- O período entra como primeira linha do **Resumo** nas exportações, então o arquivo diz a que recorte se refere.

## Publicação no Cloudflare (nov/2026)
Os créditos do Netlify acabaram (plano Free gasta 15 créditos por deploy de produção) e a publicação migrou para o **Cloudflare**, conectada ao GitHub — todo push na `main` publica sozinho.

- **Fluxo é Workers com assets, não Pages:** o Cloudflare encerrou a criação de projetos Pages no painel. `wrangler.jsonc` na raiz aponta `assets.directory: ./dist` e `not_found_handling: "single-page-application"` (a regra de SPA do React Router).
- ⚠️ **`public/_redirects` foi REMOVIDO.** O Cloudflare lê esse arquivo do diretório de assets e rejeita `/* → /index.html 200` como laço infinito (`code: 100324`), porque no modelo dele quem faz o fallback é o `not_found_handling`. O `netlify.toml` já declarava a mesma regra, então o Netlify não perdeu nada.
- **Variáveis de build** no painel do Cloudflare: `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`. O `VITE_APP_URL` fica **de fora** de propósito — sem ele o código cai em `window.location.origin` e funciona em qualquer endereço sem rebuild.
- **Node 20** vem do `.nvmrc` (vale para Cloudflare e Netlify).
- Endereço provisório: `https://persontask.joabe-reis2.workers.dev`.
- **Domínio migrado para o Cloudflare (10/11/2026).** `persontask.com.br` e `www` são Custom Domains do Worker `persontask`. O DNS saiu da Locaweb: os nameservers no registro.br (alterados pelo painel da Locaweb, porque ela é o Provedor de Serviços e o bloco de DNS do registro.br fica só-leitura) agora são `celine.ns.cloudflare.com` e `milan.ns.cloudflare.com`.
  - ⚠️ O escaneamento do Cloudflare **não** importou `send` e `rsend` — registros de DNS não podem ser listados, só adivinhados. Sempre confira a zona contra uma captura feita antes.
  - ⚠️ Adicionar um Custom Domain **falha** se já houver registro A/CNAME naquele nome: é preciso apagar o antigo primeiro (breve janela sem ar).
  - O Netlify saiu de cena. A zona antiga segue na Locaweb, inerte, como plano B.

## ⚠️ Verificar deploy: olhe o CONTEÚDO, não o código HTTP
O app devolve `index.html` para **qualquer** rota desconhecida (regra de SPA). Logo, `curl -o /dev/null -w "%{http_code}"` devolve **200 para tudo** — inclusive para arquivo que não existe. Isso já levou a um diagnóstico errado ("as páginas legais estão no ar" quando não estavam).

Verificação correta:
```bash
curl -sL https://persontask.com.br/termos.html | grep -o "<title>[^<]*"
curl -s https://persontask.com.br/ | grep -o 'assets/index-[A-Za-z0-9_-]*\.js'   # compara com dist/index.html
```
