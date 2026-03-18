# Módulos do Sistema

## 1. Executive Summary
Mapa funcional dos domínios de negócio e técnicos do AiraFit. A API concentra 8 domínios principais em um monólito modular com 36 entidades, 29 controllers e 20 services.

## 2. Key Takeaways
- API concentra múltiplos domínios em um monólito modular.
- Controle de autorização por `userId` em todas as queries (multi-tenant by design).
- Cada domínio possui controllers, services e entidades específicos.

## 3. System View / High-Level View

| Domínio           | Entidades                                                              | Controllers                                                     |
| ----------------- | ---------------------------------------------------------------------- | --------------------------------------------------------------- |
| Auth/Usuário      | User                                                                   | AuthController, UserController, OnboardingController            |
| Saúde Clínica     | HealthProfile, BloodTest, WeeklyCheckIn, HormoneLog, WeightLog         | HealthProfileController, BloodTestController, CheckInController, HormoneController, ClinicalController, MetricsController |
| Nutrição          | Food, Meal, Recipe, RecipeIngredient, RecipeReview, ScheduledMeal, RecipeSchedule, WaterLog | MealController, FoodController, RecipeController, ScheduledMealController, RecipeScheduleController, WaterController |
| Protocolos        | ClinicalProtocol, ClinicalProtocolLog, Medication, MedicationLog       | ClinicalProtocolController, MedicationController                |
| Rotina/Treinos    | RoutineBlock, BlockCompletion, Exercise, WorkoutSheet, WorkoutSheetExercise | RoutineController, WorkoutController, ExerciseController        |
| Social            | BlockPost, BlockLike, BlockComment, Friendship, Group, GroupMember      | SocialController, FriendshipController, GroupController, CommunityController |
| Gamificação       | XpLog, DailyMission, Challenge, ChallengeParticipant                   | RankingController, DailyMissionController, ChallengeController  |
| Notificações      | Notification, PushSubscription                                          | NotificationController                                          |

## 4. Detailed Analysis

### Auth/Usuário
- Registro e login com JWT em HttpOnly cookie
- Onboarding multi-step (dados pessoais → horários → atividade → objetivo → rotina)
- Upload de avatar, edição de perfil

### Saúde Clínica
- Perfil biométrico com cálculos metabólicos (TMB, GET, macros)
- 24+ biomarcadores em exames de sangue com análise automática
- Check-ins semanais (peso, circunferência, aderência)
- Tracking de hormônios com categorias (TRT, feminino, sono)
- Dashboard clínico com gráficos SVG de tendência

### Nutrição
- Base de alimentos com dados nutricionais
- Refeições agendadas com vinculação de receitas
- Comunidade de receitas (feed, fork, review, like)
- Protocolos clínicos recorrentes (suplementos, medicamentos)
- Tracking de água com meta diária

### Rotina/Treinos
- Canvas de blocos diários (exercício, refeição, sono, trabalho, sol, água, custom)
- `BlockCompletion`: completions por data — resolve blocos recorrentes
- Fichas de treino com exercícios, séries, reps, descanso
- Templates de treino (PPL, Upper/Lower, Full Body)
- Agendamento de treinos vinculado a blocos de rotina

### Social
- Feed de atividades completadas (posts com foto)
- Likes e comments com paginação
- Sistema de amizades (request, accept, decline, block)
- Grupos com código de convite e leaderboard

### Gamificação
- XP por completar blocos, check-ins, desafios
- Ranking semanal (global, amigos)
- Daily missions (5 tipos: água, refeições, atividade, peso, sono)
- Challenges semanais com progresso por categoria

### Notificações
- In-app (polling 30s) com dropdown e badge
- Web Push via VAPID com scheduler node-cron
- Preferências por usuário (ativar/desativar push)

## 5. Evidence / File References
- `backend/src/controllers/` — 29 controllers
- `backend/src/services/` — 20 services
- `backend/src/entities/` — 36 entidades
- `backend/src/routes/index.ts` — ~30 grupos de rotas

## 6. Risks / Gaps / Unknowns
- Acoplamento entre domínios pode crescer sem fronteiras explícitas.
- Alguns services (GamificationService, RoutineController) cruzam domínios.

## 7. Recommendations
- Definir owners por domínio e contratos de integração internos.
- Considerar extração de módulos mais independentes se o monólito crescer.

## 8. Appendix
- Ver `product/bounded-contexts.md` e `product/domain-glossary.md`.
