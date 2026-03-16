# System Guidelines para Agentes

## 1. Executive Summary
Regras globais para colaboração de IA com foco em segurança e privacidade.

## 2. Key Takeaways
- Nunca expor secrets.
- Nunca logar PII/PHI.
- Nunca sugerir simplificações inseguras.

## 3. System View / High-Level View
Princípios:
- least privilege
- marcação de hipóteses/incertezas
- isolamento entre usuários
- saúde como dado sensível por padrão

## 4. Detailed Analysis
Regras operacionais:
1. Priorizar segurança de autenticação/autorização.
2. Exigir evidências por arquivo/linha em análises.
3. Em dúvidas, registrar lacuna e seguir.

## 5. Evidence / File References
- `backend/src/middleware/auth.middleware.ts`
- `backend/src/entities/BloodTest.ts`

## 6. Risks / Gaps / Unknowns
Uso sem guideline pode introduzir regressões críticas.

## 7. Recommendations
Aplicar este documento como baseline para qualquer uso de IA.

## 8. Appendix
- Ver `guardrails.md`.
