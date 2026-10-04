# SPEC-0013 — Frontend Hardening & UX Improvements

**Status:** Draft  
**Versão:** 0.1.0  
**Produto:** AgendaZap

## 1. Objetivo

Transformar a interface atual de demonstração em uma base de frontend confiável para o MVP real, reduzindo risco operacional e preparando a integração com agenda, WhatsApp, pagamentos e Revenue Engine.

## 2. Identidade visual

### P0
- substituir o monograma temporário `AZ` pela marca oficial;
- manter três ativos oficiais:
  - logo completa com tagline;
  - logo horizontal sem tagline;
  - ícone isolado;
- usar o ícone isolado na sidebar recolhida;
- usar o ícone como favicon/PWA;
- garantir contraste adequado em temas claro e escuro.

### Tokens
- verde principal: `#25D366`;
- verde escuro: `#0B8F4B`;
- grafite: `#101722`;
- cinza secundário: `#64748B`;
- fundo claro: `#F8FAFC`;
- fundo escuro: `#0B1220`.

## 3. Correções P0 de infraestrutura

### Cache
Enquanto JS/CSS não tiverem nomes versionados por hash, não usar `immutable` com cache longo.

Opções aceitas:
1. cache curto/no-cache para `app.js` e `styles.css`; ou
2. pipeline de build com arquivos content-hashed.

### Headers Nginx
Garantir que assets estáticos preservem:
- X-Content-Type-Options;
- X-Frame-Options;
- Referrer-Policy;
- Permissions-Policy;
- Content-Security-Policy quando o frontend estiver estabilizado.

### Imagem base
Atualizar Nginx para uma versão estável suportada e preferir pin por digest em produção.

### Deploy
Deploy só é considerado bem-sucedido se:
1. container iniciar;
2. healthcheck reportar healthy;
3. `/healthz` responder 200;
4. página principal responder 200.

Falha deve retornar exit code != 0.

## 4. Demo versus produção

Enquanto dados forem hard-coded:
- exibir selo visível `AMBIENTE DE DEMONSTRAÇÃO`;
- não apresentar números simulados como dados reais;
- separar claramente demo fixture de dados reais.

O selo pode ser removido apenas quando dashboard consumir API real.

## 5. Sidebar e acessibilidade

### Estado
Ao restaurar sidebar recolhida do localStorage:
- sincronizar estado visual;
- atualizar `aria-label`;
- atualizar `aria-expanded`;
- atualizar `title`.

### Teclado
- todos os controles acessíveis via Tab;
- foco visível;
- Enter/Space operam botões;
- navegação deve informar item ativo.

## 6. Tema claro/escuro

Aplicar preferência de tema antes do primeiro paint para evitar flash claro em usuários dark.

Ordem:
1. localStorage;
2. `prefers-color-scheme`;
3. fallback light.

## 7. Navegação

Substituir troca puramente visual de sections por navegação com estado de URL.

Rotas mínimas:
- `/`;
- `/agenda`;
- `/clientes`;
- `/automacoes`;
- `/financeiro`;
- `/planos`.

Requisitos:
- refresh mantém tela;
- back/forward funciona;
- deep link funciona.

## 8. Mobile

Em telas pequenas:
- não manter sidebar fixa de 82px;
- usar drawer ou bottom navigation;
- preservar acesso rápido a Dashboard, Agenda, Clientes e Mais.

## 9. CTAs

Nenhum CTA comercial pode ser decorativo.

### Novo agendamento
Abrir formulário/modal real ou rota de criação.

### Ver agenda
Navegar para `/agenda`.

### Planos
`Fundador`, `Profissional` e `Pro` devem iniciar captura de lead/onboarding com plano pré-selecionado.

Campos mínimos:
- responsável;
- estabelecimento;
- telefone/WhatsApp;
- e-mail;
- plano.

## 10. PWA

Adicionar:
- `manifest.webmanifest`;
- favicon/app icon;
- metadata de tema;
- service worker em fase posterior;
- offline fallback quando agenda local fizer sentido.

## 11. CI / Quality Gates

Pipeline mínimo:
- validação HTML;
- `node --check app.js`;
- lint CSS;
- ShellCheck;
- Hadolint;
- `nginx -t`;
- Docker build;
- scanner de vulnerabilidade;
- smoke tests.

Merge em `main` deve depender desses gates quando CI estiver ativo.

## 12. Testes E2E

Playwright ou equivalente:

- dashboard abre;
- sidebar expande/recolhe;
- estado da sidebar persiste;
- aria acompanha estado;
- tema troca;
- tema persiste;
- rota Planos funciona;
- preço principal exibe R$ 597 + R$ 249/mês;
- layout mobile não perde navegação;
- CTAs executam ação esperada.

## 13. Próximo marco de produto

O primeiro fluxo end-to-end real é:

```text
Cliente
  ↓
WhatsApp
  ↓
mensagem
  ↓
interpretação
  ↓
consulta de disponibilidade
  ↓
slots reais
  ↓
seleção
  ↓
booking hold
  ↓
appointment
  ↓
confirmação no WhatsApp
```

## 14. Dashboard real

Cards devem migrar de fixtures para API.

Dados mínimos:
- receita prevista;
- receita recebida;
- receita recuperada;
- ocupação;
- no-show;
- próximos appointments;
- oportunidades do Revenue Engine.

## 15. Prioridade

1. branding + correções infra;
2. demo badge + CTAs + routing;
3. backend de agenda real;
4. WhatsApp end-to-end;
5. Revenue Engine conectado;
6. PWA/polish.

## 16. Definition of Done

SPEC concluída quando:
- marca oficial substitui `AZ`;
- favicon/PWA usa ícone oficial;
- nenhum cache stale crítico;
- headers preservados;
- deploy falha se healthcheck falhar;
- sidebar/theme acessíveis;
- rotas persistem;
- CTAs são funcionais;
- demo é explicitamente identificada;
- smoke tests cobrem os fluxos essenciais.
