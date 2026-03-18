# CLAUDE_CONTEXT.md — Guia de Contexto para Sessões Claude

> **Objetivo**: Este arquivo fornece contexto rápido e estruturado para que sessões futuras do Claude (ou outro agente LLM) possam operar com máxima eficiência, reduzindo tokens gastos em exploração e evitando retrabalho.

---

## 1. Visão Geral do Projeto

**AiraFit** é um SaaS de saúde, nutrição e bem-estar personalizado. Combina rastreamento clínico (exames de sangue, protocolos médicos), planejamento nutricional, rotina de treinos, gamificação social e notificações push — tudo em um PWA responsivo.

| Camada       | Stack                                          |
| ------------ | ---------------------------------------------- |
| Frontend     | Angular 17.3 (standalone, signals, OnPush)     |
| Backend      | Express 4 + TypeScript + TypeORM               |
| Banco        | PostgreSQL 16                                  |
| Infra        | Docker Compose (Nginx → Express → Postgres)    |
| PWA          | @angular/service-worker + Web App Manifest     |
| Push         | web-push (VAPID) + node-cron scheduler         |
| Segurança    | Helmet, CORS restritivo, rate limiting, HttpOnly JWT |

---

## 2. Estrutura de Diretórios Chave

```
healthapp/
├── backend/src/
│   ├── app.ts                    # Bootstrap Express (helmet, CORS, rate limit, cookie-parser, routes)
│   ├── data-source.ts            # TypeORM DataSource
│   ├── config/
│   │   ├── env.ts                # Variáveis de ambiente centralizadas
│   │   └── typeorm.config.ts     # Config CLI de migração
│   ├── entities/                 # 36 entidades TypeORM
│   ├── controllers/              # 29 controllers REST
│   ├── services/                 # 20 services (incluindo NotificationScheduler)
│   ├── middleware/               # auth.middleware.ts + error.middleware.ts
│   ├── migrations/               # 24 migrações SQL
│   └── routes/index.ts           # Router central com ~30 grupos de rotas
│
├── frontend/src/
│   ├── app/
│   │   ├── app.routes.ts         # Rotas lazy-loaded com guards
│   │   ├── app.config.ts         # Providers (HttpClient, interceptors, SW)
│   │   ├── core/
│   │   │   ├── services/         # 29 services Angular
│   │   │   ├── guards/           # authGuard, publicGuard
│   │   │   ├── interceptors/     # authInterceptor (401 → logout)
│   │   │   └── models/index.ts   # Todas as interfaces/tipos
│   │   ├── features/             # 23 feature components (lazy-loaded)
│   │   └── shared/components/    # NavShell, DailyMissionsWidget
│   ├── styles.scss               # Design tokens + reset + utilities
│   ├── index.html                # PWA meta tags, fonts, viewport-fit
│   └── manifest.webmanifest      # PWA manifest com shortcuts
│
├── docs/                         # Documentação técnica completa
│   ├── architecture/             # overview, modules, auth-flow, data-flow, async-flows, C4, deployment
│   ├── security/                 # security-review, threat-model, checklist, remediation, secrets, logging
│   ├── privacy/                  # LGPD assessment, data inventory, classification, retention, RIPD
│   ├── product/                  # domain-glossary, bounded-contexts
│   ├── operations/               # runbook, environments, CI/CD, backup
│   └── llm/                      # architecture-for-llms, guidelines, skills, guardrails, examples, prompts
│
├── CLAUDE.md                     # Convenções obrigatórias para código
├── CLAUDE_CONTEXT.md             # Este arquivo
└── docker-compose.yml
```

---

## 3. Autenticação e Segurança (Estado Atual)

| Controle                | Implementação                                                            | Arquivo                                      |
| ----------------------- | ------------------------------------------------------------------------ | -------------------------------------------- |
| Sessão JWT              | Cookie HttpOnly (`ha_token`), SameSite strict em prod                    | `AuthController.ts`, `auth.middleware.ts`     |
| Fallback Bearer         | Middleware aceita cookie OU header `Authorization: Bearer`               | `auth.middleware.ts`                          |
| CORS                    | Whitelist via `CORS_ORIGINS` env var, `credentials: true`                | `app.ts`, `env.ts`                           |
| Rate Limit — Auth       | 20 req / 15 min em `/api/v1/auth`                                       | `app.ts`                                     |
| Rate Limit — API        | 200 req / 1 min em `/api/v1`                                            | `app.ts`                                     |
| Security Headers        | Helmet (CSP, HSTS, X-Frame-Options, X-Content-Type-Options)             | `app.ts`                                     |
| Frontend credentials    | `withCredentials: true` em todos os métodos do `ApiService`              | `api.service.ts`                             |
| Logout                  | `POST /auth/logout` limpa cookie + frontend limpa localStorage           | `AuthController.ts`, `auth.service.ts`       |
| Interceptor             | 401 → auto-logout (sem injeção de Bearer header)                        | `auth.interceptor.ts`                        |

### Variáveis de Ambiente de Segurança (Produção)
```
CORS_ORIGINS=https://app.airafit.com
COOKIE_DOMAIN=.airafit.com
VAPID_PUBLIC_KEY=<gerada>
VAPID_PRIVATE_KEY=<gerada>
VAPID_SUBJECT=mailto:dev@airafit.com
JWT_SECRET=<segredo forte, mín. 32 chars>
```

---

## 4. Funcionalidades por Domínio

### Domínios de Negócio
| Domínio           | Entidades Principais                                        | Controllers                              |
| ----------------- | ----------------------------------------------------------- | ---------------------------------------- |
| Auth/Usuário      | User                                                        | AuthController, UserController, OnboardingController |
| Saúde Clínica     | HealthProfile, BloodTest, WeeklyCheckIn, HormoneLog         | HealthProfileController, BloodTestController, CheckInController, HormoneController, ClinicalController |
| Nutrição          | Food, Meal, Recipe, ScheduledMeal, RecipeSchedule, WaterLog | MealController, FoodController, RecipeController, ScheduledMealController, WaterController |
| Protocolos        | ClinicalProtocol, ClinicalProtocolLog, Medication, MedicationLog | ClinicalProtocolController, MedicationController |
| Rotina/Treinos    | RoutineBlock, BlockCompletion, WorkoutSheet, WorkoutSheetExercise, Exercise | RoutineController, WorkoutController, ExerciseController |
| Social            | BlockPost, BlockLike, BlockComment, Friendship, Group, GroupMember | SocialController, FriendshipController, GroupController, CommunityController |
| Gamificação       | XpLog, DailyMission, Challenge, ChallengeParticipant        | RankingController, DailyMissionController, ChallengeController |
| Notificações      | Notification, PushSubscription                               | NotificationController                   |

### Funcionalidades Recentes (Sprints 1-6)
- **Sprint 1-2**: HttpOnly JWT cookies, Helmet, CORS restritivo, rate limiting
- **Sprint 3-4**: BlockCompletion (completions por data em blocos recorrentes), NotificationScheduler (node-cron + Web Push VAPID)
- **Sprint 5-6**: PWA completa (manifest, SW data cache, iOS meta tags), mobile UX (touch targets 44px, overscroll, hamburger animado)

---

## 5. Padrões Arquiteturais do Frontend

### Componentes
- **Standalone** com `imports` explícitos (sem NgModules)
- **3 arquivos** obrigatórios: `.ts` + `.html` + `.scss` (NUNCA inline)
- **Signals** (`signal()`, `computed()`, `effect()`) para estado local
- **OnPush** change detection (default via angular.json)
- **Lazy-loaded** via `loadComponent` no router
- **Novo control flow**: `@if`, `@for`, `@switch` (não usar `*ngIf`/`*ngFor`)

### Services
- `ApiService` é o HTTP client base (GET, POST, PATCH, DELETE com `withCredentials`)
- Services de domínio consomem `ApiService` e expõem dados via Signals ou Observables
- `AuthService` armazena apenas `ha_uid` no localStorage (token fica no cookie HttpOnly)

### Estilização
- Design tokens em CSS Custom Properties (`--color-primary`, `--radius-md`, etc.)
- Dark mode via `body.dark` que sobrescreve tokens
- SCSS com nesting nativo
- `styles.scss` contém reset, utilities e componentes globais (btn, card, chip, alert)

---

## 6. Padrões Arquiteturais do Backend

### Camadas
```
Routes → Controllers → Services → TypeORM Repositories → PostgreSQL
```

### Convenções
- Controllers são **estáticos** (`static async method(req, res)`)
- Autenticação via `authMiddleware` que injeta `req.userId`
- Todas as queries filtram por `userId` (multi-tenant por design)
- Migrações são classes TypeORM com `up()` e `down()` em SQL raw
- Entidades usam decorators TypeORM (`@Entity`, `@Column`, `@ManyToOne`, etc.)

### Scheduler
- `NotificationScheduler` usa `node-cron` (minuto a minuto)
- Verifica blocos próximos (5 min), envia Web Push e cria Notification in-app
- Iniciado no `app.listen()` callback

---

## 7. PWA e Mobile

| Feature                  | Status | Detalhes                                                 |
| ------------------------ | ------ | -------------------------------------------------------- |
| Web App Manifest         | ✅     | Shortcuts, display_override, orientation, lang           |
| Service Worker           | ✅     | ngsw-config.json com assetGroups + dataGroups            |
| iOS PWA meta tags        | ✅     | apple-mobile-web-app-capable, status-bar-style, icons    |
| Touch targets            | ✅     | 44px mínimo, tap highlight removido                      |
| Input zoom prevention    | ✅     | font-size: 16px em inputs mobile                         |
| Overscroll behavior      | ✅     | overscroll-behavior-y: contain                           |
| Push notifications       | ✅     | VAPID + node-cron scheduler (backend)                    |
| Offline API cache        | ✅     | Profile 1h, routine 5min, static 30min                   |

---

## 8. Migrações e Banco de Dados

- **24 migrações** aplicadas sequencialmente
- Convenção de nome: `{timestamp}-{DescriptiveName}.ts`
- Última migração: `CreateBlockCompletions` (BlockCompletion entity)
- Dados sensíveis: BloodTest, HealthProfile, WeeklyCheckIn, ClinicalProtocolLog, HormoneLog

---

## 9. Roadmap Pendente

| Sprint   | Escopo                                                    | Status     |
| -------- | --------------------------------------------------------- | ---------- |
| 1-2      | Segurança (HttpOnly, rate limit, CORS, headers)           | ✅ Concluído |
| 3-4      | BlockCompletion + NotificationScheduler + Web Push        | ✅ Concluído |
| 5-6      | Mobile UX + PWA completa                                  | ✅ Concluído |
| 7-8      | Copilot IA generativa + scanner alimentos (barcode/OCR)   | ⏳ Pendente |
| 9-10     | Badges/conquistas + progressão treino + relatórios PDF    | ⏳ Pendente |
| 11-12    | Testes automatizados + LGPD compliance (retenção, RIPD)   | ⏳ Pendente |

---

## 10. Config de Produção Necessária

Antes do deploy final, as seguintes variáveis devem ser configuradas:

```env
# Obrigatórias
NODE_ENV=production
JWT_SECRET=<segredo forte>
CORS_ORIGINS=https://app.airafit.com
COOKIE_DOMAIN=.airafit.com

# Push Notifications
VAPID_PUBLIC_KEY=<gerar com web-push generate-vapid-keys>
VAPID_PRIVATE_KEY=<gerar com web-push generate-vapid-keys>
VAPID_SUBJECT=mailto:suporte@airafit.com

# Banco
DB_HOST=<host produção>
DB_PORT=5432
DB_NAME=airafit
DB_USERNAME=<user produção>
DB_PASSWORD=<senha forte>
```

---

## 11. Erros Pré-Existentes Conhecidos

Os seguintes erros de compilação TypeScript (`npx tsc --noEmit`) existem no backend e **não foram introduzidos pelas sprints recentes**:

- `BloodTest.ts` — campos opcionais vs. TypeORM strict
- `GroupController.ts` — tipagem de membro de grupo
- `RecipeSchedule.ts` — relação nullable
- `RoutineGeneratorService.ts` — acesso a campos opcionais
- `import.meta` — configuração de target no tsconfig

Estes devem ser resolvidos na sprint de testes (11-12).

---

## 12. Leitura Recomendada para Novas Sessões

**Ramp-up rápido (5 min):**
1. Este arquivo (`CLAUDE_CONTEXT.md`)
2. `CLAUDE.md` (convenções de código)

**Entender arquitetura (10 min):**
3. `backend/src/app.ts`
4. `backend/src/routes/index.ts`
5. `frontend/src/app/app.routes.ts`
6. `frontend/src/app/core/models/index.ts`

**Entender segurança (5 min):**
7. `docs/security/security-review.md`
8. `docs/security/threat-model.md`

**Entender domínio (10 min):**
9. `docs/product/domain-glossary.md`
10. `docs/product/bounded-contexts.md`

---

## 13. Dicas para Performance de Tokens

- **NÃO** ler todos os 36 entities de uma vez. Consulte apenas as relevantes à tarefa.
- **NÃO** ler todos os 29 controllers. Use `routes/index.ts` como índice.
- **PREFIRA** `Grep` sobre `Read` para localizar padrões específicos.
- **USE** `models/index.ts` do frontend como referência para interfaces — evita ler services individuais.
- **CONSULTE** este arquivo primeiro em toda nova sessão para evitar exploração redundante.
