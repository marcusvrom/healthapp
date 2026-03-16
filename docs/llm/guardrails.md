# Guardrails para LLMs

## 1. Executive Summary
Padrões proibidos, desencorajados e preferidos para sugestões de IA.

## 2. Key Takeaways
- Proibido: expor secret/PII/PHI.
- Desencorajado: bypass de auth, validação fraca.
- Preferido: least privilege, validação explícita e evidência.

## 3. System View / High-Level View
### Padrões proibidos
- Hardcode de segredo
- Log de payload sensível
- Acesso cross-user sem checagem

### Padrões preferidos
- checagem de ownership
- schemas de entrada
- logging com redaction

## 4. Detailed Analysis
Exemplos aceitáveis e inaceitáveis por categoria.

## 5. Evidence / File References
- `backend/src/services/MealService.ts`
- `backend/src/middleware/error.middleware.ts`

## 6. Risks / Gaps / Unknowns
Sem guardrails, IA pode gerar código inseguro.

## 7. Recommendations
Usar guardrails como critério de revisão obrigatória.

## 8. Appendix
- Ver `examples.md`.
