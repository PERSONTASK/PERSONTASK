# PERSONTASK — Templates de e-mail (Supabase Auth)

Backup dos templates de e-mail de autenticação do Supabase, com a identidade do PERSONTASK
(cabeçalho em gradiente, botão, sem imagens externas — o que também ajuda na entrega/deliverability).

## Como aplicar
No painel do Supabase: **Authentication → Emails → Templates**.
Cada template tem dois campos: **Subject** (assunto) e **Message body** (corpo HTML).
Copie o assunto da tabela abaixo e o corpo do arquivo `.html` correspondente, e clique **Save**.

| Template no Supabase | Assunto (Subject) | Arquivo |
|---|---|---|
| Reset Password | Redefinir sua senha do PERSONTASK | `reset-password.html` |
| Confirm signup | Confirme seu cadastro no PERSONTASK | `confirm-signup.html` |
| Magic Link | Seu link de acesso ao PERSONTASK | `magic-link.html` |
| Invite user | Você foi convidado para o PERSONTASK | `invite.html` |
| Change Email Address | Confirme seu novo e-mail no PERSONTASK | `change-email.html` |

## Variáveis do Supabase (não alterar)
- `{{ .ConfirmationURL }}` — link da ação (o Supabase injeta). Presente em todos.
- `{{ .NewEmail }}` — novo e-mail (só no template de troca de e-mail).
- `{{ .Token }}` — código OTP (usado no template **Reauthentication**, que não está aqui pois usa código em vez de link).

## Observações
- **Idioma:** os e-mails do Supabase são um idioma só para todos os usuários. Estão em **PT** (público BR).
- **Convite:** o app tem convite próprio (via Resend/Edge Function, com outro layout). O template "Invite user" acima só dispara se usar o convite **nativo** do Supabase.
- **Envio (SMTP):** configurado via Resend em Authentication → Emails → SMTP —
  Host `smtp.resend.com`, Port `465`, Username `resend` (**minúsculo!**), Password = Resend API key,
  Sender `no-reply@persontask.com.br`.
- **Spam/deliverability:** domínio autenticado (SPF/DKIM/DMARC PASS). E-mails de domínio novo podem
  cair no spam no começo — marcar "não é spam" acelera o aquecimento da reputação.
