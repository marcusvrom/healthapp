# AiraFit — Plataforma de Saúde, Nutrição e Bem-Estar Personalizado

## Stack

| Camada         | Tecnologia                                       |
| -------------- | ------------------------------------------------ |
| Backend        | Node.js + Express.js + TypeScript                |
| ORM            | TypeORM (PostgreSQL)                             |
| Banco          | PostgreSQL 16 (Docker volume)                    |
| Frontend       | Angular 17.3 (standalone components, signals)    |
| PWA            | @angular/service-worker + Web Push (VAPID)       |
| Segurança      | Helmet, CORS restritivo, rate limiting, HttpOnly JWT |
| Containerização| Docker + Docker Compose                          |

---

## Estrutura de Pastas

```
healthapp/
├── backend/src/
│   ├── app.ts                        # Bootstrap Express (helmet, CORS, rate limit, cookie-parser)
│   ├── data-source.ts                # TypeORM DataSource
│   ├── config/
│   │   ├── env.ts                    # Variáveis de ambiente centralizadas
│   │   └── typeorm.config.ts         # Config CLI de migração
│   ├── entities/                     # 36 entidades TypeORM
│   ├── controllers/                  # 29 controllers REST
│   ├── services/                     # 20 services (incluindo NotificationScheduler)
│   ├── middleware/
│   │   ├── auth.middleware.ts        # JWT via HttpOnly cookie + fallback Bearer
│   │   └── error.middleware.ts       # Handler global de erros
│   ├── migrations/                   # 24 migrações
│   └── routes/index.ts              # Router central da API v1
│
├── frontend/src/
│   ├── app/
│   │   ├── app.routes.ts            # Rotas lazy-loaded com guards
│   │   ├── core/services/           # 29 services Angular
│   │   ├── core/models/index.ts     # Todas as interfaces/tipos
│   │   ├── features/                # 23 feature components
│   │   └── shared/components/       # NavShell, DailyMissionsWidget
│   ├── styles.scss                  # Design tokens + reset + utilities
│   ├── index.html                   # PWA meta tags, fonts
│   └── manifest.webmanifest         # Web App Manifest
│
├── docs/                            # Documentação técnica completa
│   ├── architecture/                # Visão geral, módulos, C4, fluxos
│   ├── security/                    # Revisão de segurança, threat model, checklist
│   ├── privacy/                     # LGPD, inventário de dados, retenção
│   ├── product/                     # Glossário, bounded contexts
│   ├── operations/                  # Runbook, CI/CD, backup
│   └── llm/                         # Guias para agentes IA
│
├── CLAUDE.md                        # Convenções de código
├── CLAUDE_CONTEXT.md                # Contexto completo para sessões Claude
└── docker-compose.yml
```

---

## Quick Start

### 1. Copiar variáveis de ambiente
```bash
cp .env.example .env
cp .env.example backend/.env
```

### 2. Subir containers
```bash
make up
```

### 3. Executar migrações
```bash
make install     # npm install local
make migrate     # typeorm migration:run
```

### 4. Verificar saúde da API
```
GET http://localhost:3000/health  →  { "status": "ok" }
```

---

## Comandos Úteis (Makefile)

| Comando              | Ação                                              |
| -------------------- | ------------------------------------------------- |
| `make up`            | Sobe todos os containers                          |
| `make down`          | Derruba containers (dados preservados)             |
| `make clean`         | Derruba containers **e** remove volumes            |
| `make migrate`       | Executa migrações pendentes                        |
| `make migrate-revert`| Reverte a última migração                          |
| `make migrate-generate` | Gera nova migração a partir das entidades       |
| `make dev-backend`   | Roda backend localmente com hot-reload             |

---

## API Endpoints (v1)

### Auth (público)
| Método | Rota                        | Descrição                    |
| ------ | --------------------------- | ---------------------------- |
| POST   | `/api/v1/auth/register`     | Cadastro                     |
| POST   | `/api/v1/auth/login`        | Login (retorna JWT em cookie HttpOnly) |
| POST   | `/api/v1/auth/logout`       | Logout (limpa cookie)        |

### Push (público)
| Método | Rota                        | Descrição                    |
| ------ | --------------------------- | ---------------------------- |
| GET    | `/api/v1/push/vapid-key`    | Chave pública VAPID          |

### Perfil de Saúde
| Método | Rota                        | Descrição                    |
| ------ | --------------------------- | ---------------------------- |
| GET    | `/api/v1/profile`           | Perfil do usuário            |
| POST   | `/api/v1/profile`           | Criar/atualizar perfil       |
| GET    | `/api/v1/profile/metabolic` | Resultado metabólico         |

### Exames de Sangue
| Método | Rota                              | Descrição                    |
| ------ | --------------------------------- | ---------------------------- |
| GET    | `/api/v1/blood-tests`             | Listar exames                |
| POST   | `/api/v1/blood-tests`             | Cadastrar exame              |
| GET    | `/api/v1/blood-tests/latest/analysis` | Análise + ajuste macros  |

### Exercícios
| Método | Rota                        | Descrição                    |
| ------ | --------------------------- | ---------------------------- |
| GET    | `/api/v1/exercises/presets` | Biblioteca de presets        |
| GET    | `/api/v1/exercises`         | Exercícios do usuário        |
| POST   | `/api/v1/exercises`         | Adicionar exercício          |
| PATCH  | `/api/v1/exercises/:id`     | Atualizar                    |
| DELETE | `/api/v1/exercises/:id`     | Remover                      |

### Rotina (Canvas)
| Método | Rota                               | Descrição                    |
| ------ | ---------------------------------- | ---------------------------- |
| GET    | `/api/v1/routine?date=YYYY-MM-DD`  | Rotina do dia (com completions) |
| POST   | `/api/v1/routine/generate?date=`   | Gerar/regenerar rotina       |
| PATCH  | `/api/v1/routine/blocks/:id`       | Atualizar bloco              |
| POST   | `/api/v1/routine/blocks/:id/complete` | Completar/descompletar bloco |
| DELETE | `/api/v1/routine/blocks/:id`       | Remover bloco                |

### Nutrição
| Método | Rota                                | Descrição                    |
| ------ | ----------------------------------- | ---------------------------- |
| GET    | `/api/v1/meals/today`               | Refeições de hoje            |
| POST   | `/api/v1/meals`                     | Registrar refeição           |
| POST   | `/api/v1/water`                     | Registrar ingestão de água   |
| GET    | `/api/v1/water/today`               | Total de água hoje           |
| GET    | `/api/v1/scheduled-meals?date=`     | Refeições agendadas          |
| GET    | `/api/v1/recipes/feed`              | Feed de receitas comunitárias|

### Social e Comunidade
| Método | Rota                                | Descrição                    |
| ------ | ----------------------------------- | ---------------------------- |
| GET    | `/api/v1/social/feed`               | Feed social                  |
| POST   | `/api/v1/social/posts`              | Criar post                   |
| GET    | `/api/v1/challenges`                | Listar desafios              |
| POST   | `/api/v1/challenges/:id/join`       | Participar de desafio        |
| GET    | `/api/v1/gamification/ranking`      | Ranking semanal              |

### Treinos (Fichas)
| Método | Rota                                | Descrição                    |
| ------ | ----------------------------------- | ---------------------------- |
| GET    | `/api/v1/workouts`                  | Listar fichas de treino      |
| POST   | `/api/v1/workouts`                  | Criar ficha                  |
| GET    | `/api/v1/workouts/templates`        | Templates disponíveis        |

### Notificações
| Método | Rota                                | Descrição                    |
| ------ | ----------------------------------- | ---------------------------- |
| GET    | `/api/v1/notifications`             | Listar notificações          |
| PATCH  | `/api/v1/notifications/:id/read`    | Marcar como lida             |
| POST   | `/api/v1/notifications/subscribe`   | Registrar push subscription  |

---

## Segurança

| Controle           | Detalhes                                                           |
| ------------------ | ------------------------------------------------------------------ |
| Sessão             | JWT em cookie HttpOnly + SameSite strict (produção)                |
| CORS               | Whitelist via `CORS_ORIGINS` env var                               |
| Rate Limit         | Auth: 20/15min, API geral: 200/min                                |
| Headers            | Helmet (CSP, HSTS, X-Frame-Options, X-Content-Type-Options)       |
| Senhas             | bcrypt com salt rounds                                             |
| Push               | Web Push via VAPID (chaves em env vars)                            |

---

## Motor de Cálculo — Resumo

### TMB (Mifflin-St Jeor)
- **Masculino:** `(10 × peso) + (6.25 × altura) − (5 × idade) + 5`
- **Feminino:**  `(10 × peso) + (6.25 × altura) − (5 × idade) − 161`

### GET (Gasto Energético Total)
`GET = TMB × Fator de Atividade`

| Fator               | Multiplicador |
| -------------------- | ------------- |
| Sedentário           | 1.2           |
| Levemente ativo      | 1.375         |
| Moderadamente ativo  | 1.55          |
| Muito ativo          | 1.725         |
| Extremamente ativo   | 1.9           |

### MET (Exercício)
`Kcal = MET × Peso(kg) × Duração(h)`

### Água
`Total (ml) = 35 × Peso(kg)` → distribuído a cada 45 min durante o período acordado.

### Score de Hipertrofia
Score ≥ 8 → meta de proteína elevada para **2.2 g/kg**.

---

## Regras de Negócio — Exames de Sangue

| Marcador             | Condição                | Ação                                          |
| -------------------- | ----------------------- | --------------------------------------------- |
| Glicemia / Insulina  | Acima do normal         | Reduz % carboidratos, orienta baixo IG        |
| LDL                  | Elevado                 | Limita gordura saturada, prioriza aeróbico    |
| HDL                  | Baixo                   | Aumenta gordura saudável, prioriza aeróbico   |
| Triglicerídeos       | Elevado                 | Reduz carboidratos simples                    |
| Vitamina D           | Insuficiente/deficiente | Injeta bloco "Exposição Solar" na rotina      |
| PCR-us               | Alto                    | Recomenda dieta anti-inflamatória             |
