# Hipóteses de Bases Legais (validação jurídica requerida)

## 1. Executive Summary
Mapeamento técnico preliminar de hipóteses de base legal por operação.

## 2. Key Takeaways
- Documento técnico de apoio ao jurídico/DPO.
- Não substitui parecer legal.

## 3. System View / High-Level View
Matriz sugerida: Operação | Categoria de dado | Finalidade | Hipótese legal | Observações.

## 4. Detailed Analysis
Exemplos:
- Autenticação de conta
- Registro de exames
- Geração de recomendações
- Recursos sociais

## 5. Evidence / File References
- `backend/src/routes/index.ts`
- `backend/src/entities/*.ts`

## 6. Risks / Gaps / Unknowns
Bases legais de dados sensíveis exigem validação formal.

## 7. Recommendations
Workshops com jurídico + produto + engenharia.

## 8. Appendix
- Ver `lgpd-assessment.md`.
