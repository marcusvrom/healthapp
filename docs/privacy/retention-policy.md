# Política de Retenção e Descarte

## 1. Executive Summary
Diretriz para retenção mínima necessária e descarte seguro.

## 2. Key Takeaways
- Definir prazo por categoria.
- Garantir descarte verificável.

## 3. System View / High-Level View
Categorias:
- Conta/identidade
- Dados clínicos sensíveis
- Conteúdo social
- Logs operacionais

## 4. Detailed Analysis
Cada categoria deve ter:
- prazo
- justificativa
- método de descarte
- exceções legais

## 5. Evidence / File References
- `backend/src/entities/BloodTest.ts`
- `backend/src/entities/BlockPost.ts`

## 6. Risks / Gaps / Unknowns
Sem evidência de automação de retenção no estado atual.

## 7. Recommendations
Implementar jobs de purge com trilha de auditoria.

## 8. Appendix
- Ver `operations/backup-and-recovery.md`.
