# Architecture for LLMs

## 1. Executive Summary
Guia de leitura rápida do repositório para agentes e copilots.

## 2. Key Takeaways
Ordem sugerida de leitura:
1. `backend/src/app.ts`
2. `backend/src/routes/index.ts`
3. `backend/src/entities/*`
4. `frontend/src/app/app.routes.ts`

## 3. System View / High-Level View
Hotspots:
- autenticação
- dados clínicos
- uploads
- social/comunidade

## 4. Detailed Analysis
Trust boundaries principais e áreas de maior risco devem ser revisadas antes de qualquer sugestão.

## 5. Evidence / File References
- `backend/src/app.ts`
- `backend/src/entities/BloodTest.ts`

## 6. Risks / Gaps / Unknowns
Análises superficiais tendem a ignorar riscos de privacidade.

## 7. Recommendations
Sempre começar por arquitetura e fluxos de dados sensíveis.

## 8. Appendix
- Ver `architecture/overview.md`.
