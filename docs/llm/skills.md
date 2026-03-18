# Skills para LLMs (contexto do projeto)

## 1. Executive Summary
Contexto rápido para agentes contribuírem com segurança no repositório AiraFit.

## 2. Key Takeaways
- **Produto**: SaaS de saúde, nutrição e wellness personalizado (PWA).
- **Stack**: Angular 17 (standalone, signals) + Express + TypeORM + PostgreSQL.
- **Dados de saúde são sensíveis por padrão** — tratados como PHI.
- **Autenticação**: JWT em HttpOnly cookie (não localStorage).

## 3. System View / High-Level View

### Regras centrais
- Preservar isolamento por usuário (`userId` em todas as queries)
- Não expor secrets/PII/PHI em código, logs ou respostas
- Priorizar least privilege
- Usar HttpOnly cookies para sessão (não localStorage/sessionStorage)
- Seguir convenções de `CLAUDE.md` (3 arquivos por componente, etc.)

### Stack completa
| Camada | Detalhes |
|--------|----------|
| Frontend | Angular 17.3, standalone components, signals, OnPush, SCSS tokens |
| Backend | Express 4, TypeORM, Helmet, CORS, rate limiting, cookie-parser |
| Banco | PostgreSQL 16 com 36 entidades e 24 migrações |
| PWA | @angular/service-worker, Web Push VAPID, node-cron scheduler |
| Segurança | HttpOnly JWT, Helmet, CORS whitelist, rate limiting, bcrypt |

## 4. Detailed Analysis

### Definition of Done para sugestões de IA
- Citar evidências (arquivos, linhas)
- Marcar hipóteses claramente
- Avaliar impacto de segurança/privacidade
- Não aplicar simplificações inseguras
- Seguir convenções de `CLAUDE.md`:
  - 3 arquivos por componente (ts + html + scss)
  - Standalone com imports explícitos
  - Angular Signals para estado local
  - Novo control flow (@if, @for, @switch)
  - Interface em pt-BR
  - CSS custom properties para estilização

### Contexto de segurança atual
- ✅ HttpOnly JWT cookies implementados
- ✅ Helmet com CSP, HSTS
- ✅ CORS restritivo por ambiente
- ✅ Rate limiting (auth + API)
- ⏳ Auditoria de PHI pendente
- ⏳ LGPD compliance pendente
- ⏳ Testes automatizados pendentes

## 5. Evidence / File References
- `CLAUDE_CONTEXT.md` — contexto completo e roadmap
- `CLAUDE.md` — convenções de código
- `backend/src/routes/index.ts` — índice de rotas
- `backend/src/entities/BloodTest.ts` — exemplo de entidade PHI

## 6. Risks / Gaps / Unknowns
Contribuições sem guardrails podem aumentar risco sistêmico.

## 7. Recommendations
Usar junto com `system-guidelines.md` e `guardrails.md`.

## 8. Appendix
- Ver `architecture-for-llms.md` para ordem de leitura.
