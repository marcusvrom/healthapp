# HealthApp – MVP de Nutrição e Análise Metabólica

## Stack

| Camada | Tecnologia |
|---|---|
| Backend | Node.js + Express.js + TypeScript |
| ORM | TypeORM (PostgreSQL) |
| Banco | PostgreSQL 16 (Docker volume) |
| Frontend | Angular (standalone components) |
| Containerização | Docker + Docker Compose |

---

## Estrutura de Pastas – Backend

```
backend/
├── src/
│   ├── app.ts                        # Bootstrap Express + TypeORM
│   ├── config/
│   │   ├── env.ts                    # Leitura centralizada de variáveis de ambiente
│   │   └── typeorm.config.ts         # DataSource TypeORM (usado pelo CLI de migração)
│   ├── entities/
│   │   ├── User.ts                   # Usuário (auth)
│   │   ├── HealthProfile.ts          # Biometria + horários de rotina
│   │   ├── BloodTest.ts              # Marcadores sanguíneos
│   │   ├── Exercise.ts               # Exercícios (MET + score hipertrofia)
│   │   └── RoutineBlock.ts           # Blocos de rotina gerados
│   ├── migrations/
│   │   └── 1709500000000-InitialSchema.ts  # Migração inicial (todas as tabelas)
│   ├── services/
│   │   ├── CalculationService.ts     # TMB, GET, MET, distribuição de água
│   │   ├── BloodTestAnalysisService.ts  # Regras de negócio – ajuste de macros
│   │   └── RoutineGeneratorService.ts   # Gerador de time-blocking
│   ├── controllers/
│   │   ├── AuthController.ts
│   │   ├── HealthProfileController.ts
│   │   ├── BloodTestController.ts
│   │   ├── ExerciseController.ts
│   │   └── RoutineController.ts
│   ├── routes/
│   │   └── index.ts                  # Mapa de rotas da API v1
│   ├── middleware/
│   │   ├── auth.middleware.ts        # Validação JWT
│   │   └── error.middleware.ts       # Handler global de erros
│   └── types/
│       ├── calculation.types.ts
│       └── blood-test.types.ts
├── .env                              # Variáveis locais (não versionado)
├── Dockerfile
├── package.json
└── tsconfig.json
```

---

## Quick Start

### 1. Copiar variáveis de ambiente
```bash
cp .env.example .env        # raiz do projeto
cp .env.example backend/.env
```

### 2. Subir containers
```bash
make up
```

### 3. Executar migrações
```bash
make install     # npm install local (necessário para o CLI do TypeORM)
make migrate     # roda: typeorm migration:run
```

### 4. Verificar saúde da API
```
GET http://localhost:3000/health  →  { "status": "ok" }
```

---

## Comandos Úteis (Makefile)

| Comando | Ação |
|---|---|
| `make up` | Sobe todos os containers |
| `make down` | Derruba containers (dados preservados no volume) |
| `make clean` | Derruba containers **e** remove volumes |
| `make migrate` | Executa migrações pendentes |
| `make migrate-revert` | Reverte a última migração |
| `make migrate-generate` | Gera nova migração a partir das entidades |
| `make dev-backend` | Roda backend localmente com hot-reload |

---

## API Endpoints (v1)

### Auth
| Método | Rota | Descrição |
|---|---|---|
| POST | `/api/v1/auth/register` | Cadastro |
| POST | `/api/v1/auth/login` | Login (retorna JWT) |

### Perfil de Saúde
| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/v1/profile` | Perfil do usuário autenticado |
| POST | `/api/v1/profile` | Criar/atualizar perfil |
| GET | `/api/v1/profile/metabolic` | Resultado metabólico (TMB, GET, macros, água) |

### Exames de Sangue
| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/v1/blood-tests` | Listar exames |
| POST | `/api/v1/blood-tests` | Cadastrar exame |
| GET | `/api/v1/blood-tests/latest/analysis` | Análise + ajuste de macros |

### Exercícios
| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/v1/exercises/presets` | Biblioteca de exercícios pré-definidos |
| GET | `/api/v1/exercises` | Exercícios do usuário |
| POST | `/api/v1/exercises` | Adicionar exercício |
| PATCH | `/api/v1/exercises/:id` | Atualizar exercício |
| DELETE | `/api/v1/exercises/:id` | Remover exercício |

### Rotina
| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/v1/routine?date=YYYY-MM-DD` | Rotina do dia |
| POST | `/api/v1/routine/generate?date=YYYY-MM-DD` | Gerar/regenerar rotina |

---

## Motor de Cálculo – Resumo

### TMB (Mifflin-St Jeor)
- **Masculino:** `(10 × peso) + (6.25 × altura) − (5 × idade) + 5`
- **Feminino:**  `(10 × peso) + (6.25 × altura) − (5 × idade) − 161`

### GET (Gasto Energético Total)
`GET = TMB × Fator de Atividade`

| Fator | Multiplicador |
|---|---|
| Sedentário | 1.2 |
| Levemente ativo | 1.375 |
| Moderadamente ativo | 1.55 |
| Muito ativo | 1.725 |
| Extremamente ativo | 1.9 |

### MET (Exercício)
`Kcal = MET × Peso(kg) × Duração(h)`

### Água
`Total (ml) = 35 × Peso(kg)` → distribuído a cada 45 min durante o período acordado.

### Score de Hipertrofia
Score ≥ 8 → meta de proteína elevada para **2.2 g/kg** (teto de hipertrofia).

---

## Regras de Negócio – Exames de Sangue

| Marcador | Condição | Ação |
|---|---|---|
| Glicemia / Insulina | Acima do normal | Reduz % carboidratos, orienta baixo IG |
| LDL | Elevado | Limita gordura saturada, prioriza aeróbico |
| HDL | Baixo | Aumenta gordura saudável, prioriza aeróbico |
| Triglicerídeos | Elevado | Reduz carboidratos simples |
| Vitamina D | Insuficiente/deficiente | Injeta bloco "Exposição Solar" na rotina |
| PCR-us | Alto | Recomenda dieta anti-inflamatória |