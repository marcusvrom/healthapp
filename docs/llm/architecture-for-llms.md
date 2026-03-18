# Architecture for LLMs

## 1. Executive Summary
Guia de leitura rápida do repositório para agentes e copilots. Otimizado para reduzir tokens gastos em exploração.

## 2. Key Takeaways

### Leitura obrigatória (primeira coisa a ler)
1. **`CLAUDE_CONTEXT.md`** — Visão completa do projeto, estado atual, roadmap, config pendente
2. **`CLAUDE.md`** — Convenções de código obrigatórias

### Leitura de arquitetura (sob demanda)
3. `backend/src/app.ts` — Bootstrap Express (helmet, CORS, rate limit, routes)
4. `backend/src/routes/index.ts` — Mapa de TODAS as rotas (usar como índice)
5. `frontend/src/app/app.routes.ts` — Rotas Angular lazy-loaded
6. `frontend/src/app/core/models/index.ts` — TODAS as interfaces TypeScript

### Leitura por domínio (conforme necessário)
- **Auth**: `AuthController.ts`, `auth.middleware.ts`, `auth.service.ts`
- **Clínico**: `BloodTest.ts`, `HealthProfile.ts`, `BloodTestAnalysisService.ts`
- **Rotina**: `RoutineBlock.ts`, `BlockCompletion.ts`, `RoutineController.ts`
- **Notificações**: `NotificationScheduler.ts`, `PushSubscription.ts`

## 3. System View / High-Level View

### Hotspots (áreas de maior risco/complexidade)
1. **Autenticação**: HttpOnly JWT cookies, fallback Bearer, rate limiting
2. **Dados clínicos**: PHI em BloodTest, HealthProfile, WeeklyCheckIn — sempre filtrar por userId
3. **Uploads**: Avatar upload com validação básica — precisa fortalecimento
4. **Social/comunidade**: Feed, posts, comments — múltiplos endpoints CRUD
5. **Gamificação**: XP, ranking, daily missions — lógica cross-domain
6. **Push notifications**: VAPID + node-cron scheduler in-process

### Padrões arquiteturais
- **Frontend**: Standalone components, Angular Signals, OnPush, lazy-loading, 3 arquivos por componente
- **Backend**: Controllers estáticos, Services, TypeORM repositories, SQL raw em migrações
- **Segurança**: HttpOnly JWT, Helmet, CORS whitelist, rate limiting, bcrypt

## 4. Detailed Analysis

### Dicas para eficiência de tokens
- **NÃO** ler todos os 36 entities de uma vez. Consulte `routes/index.ts` como índice.
- **NÃO** ler todos os 29 controllers. Identifique o domínio relevante primeiro.
- **PREFIRA** `models/index.ts` do frontend para entender interfaces — evita ler services.
- **USE** `Grep` para localizar padrões específicos antes de `Read` em arquivos grandes.
- **CONSULTE** `CLAUDE_CONTEXT.md` para estado atual e roadmap.

### Trust boundaries
```
Browser → [CORS + Cookie] → Nginx → [Rate Limit] → Express → [auth.middleware] → Controller → [userId filter] → TypeORM → PostgreSQL
```

### Dados sensíveis (PHI)
Entidades que contêm dados de saúde protegidos:
- `BloodTest` — biomarcadores sanguíneos
- `HealthProfile` — biometria, condições médicas
- `WeeklyCheckIn` — peso, medidas, humor
- `ClinicalProtocolLog` — aderência a medicamentos
- `HormoneLog` — administração de hormônios

**Regra**: NUNCA sugerir código que exponha PHI sem filtro de `userId`.

## 5. Evidence / File References
- `CLAUDE_CONTEXT.md` — contexto completo do projeto
- `CLAUDE.md` — convenções de código
- `backend/src/app.ts` — security middleware stack
- `backend/src/routes/index.ts` — router central

## 6. Risks / Gaps / Unknowns
- Análises superficiais tendem a ignorar riscos de privacidade.
- Contribuições sem guardrails podem aumentar risco sistêmico.

## 7. Recommendations
- Sempre começar por `CLAUDE_CONTEXT.md` e `CLAUDE.md`.
- Antes de qualquer sugestão, verificar impacto em segurança/privacidade.
- Seguir guardrails definidos em `guardrails.md`.

## 8. Appendix
- Ver `system-guidelines.md`, `skills.md`, `guardrails.md`.
