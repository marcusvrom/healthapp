# Skills para LLMs (contexto do projeto)

## 1. Executive Summary
Contexto rápido para agentes contribuírem com segurança no repositório.

## 2. Key Takeaways
- Produto: SaaS de saúde e wellness.
- Stack: Angular + Express + PostgreSQL.
- Dados de saúde são sensíveis por padrão.

## 3. System View / High-Level View
Regras centrais:
- preservar isolamento por usuário
- não expor secrets/PII/PHI
- priorizar least privilege

## 4. Detailed Analysis
### Definition of Done para sugestões de IA
- citar evidências
- marcar hipóteses
- avaliar impacto de segurança/privacidade
- não aplicar simplificações inseguras

## 5. Evidence / File References
- `backend/src/routes/index.ts`
- `backend/src/entities/BloodTest.ts`

## 6. Risks / Gaps / Unknowns
Contribuições sem guardrails podem aumentar risco sistêmico.

## 7. Recommendations
Usar junto com `system-guidelines.md` e `guardrails.md`.

## 8. Appendix
- Ver `architecture-for-llms.md`.
