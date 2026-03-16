# Arquitetura — Overview

## 1. Executive Summary
AiraFit é um SaaS de saúde e wellness com frontend Angular, backend Express/TypeScript e PostgreSQL. O backend concentra domínios clínicos, nutricionais, sociais e gamificação em uma API `/api/v1`.

## 2. Key Takeaways
- Arquitetura monolítica modular por domínio.
- Dados de saúde sensíveis exigem controles fortes de privacidade e segurança.
- Fluxos principais: autenticação JWT, coleta de dados clínicos, recomendações e engajamento.

## 3. System View / High-Level View
- Frontend: Angular 17 + Nginx.
- Backend: Express + TypeORM.
- Dados: PostgreSQL + storage local de uploads.

## 4. Detailed Analysis
### Módulos principais
- Auth/Usuário
- Saúde clínica (perfil, exames, check-ins)
- Nutrição (meals, recipes, protocolos)
- Social/comunidade (feed, grupos, desafios)
- Notificações e gamificação

## 5. Evidence / File References
- `backend/src/app.ts`
- `backend/src/routes/index.ts`
- `frontend/src/app/app.routes.ts`

## 6. Risks / Gaps / Unknowns
- Ausência de política formal de retenção em código.
- Sessão em localStorage.

## 7. Recommendations
- Formalizar documentação C4 + fluxos de dados sensíveis.
- Definir ownership por módulo.

## 8. Appendix
- Ver também: `c4-context.md`, `modules.md`, `data-flow.md`.
