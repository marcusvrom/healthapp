# Backup and Recovery

## 1. Executive Summary
Estratégia de backup/restore para banco e storage.

## 2. Key Takeaways
- Definir RPO/RTO por tipo de dado.
- Testar restauração periodicamente.

## 3. System View / High-Level View
Escopo:
- banco PostgreSQL
- uploads
- metadados críticos

## 4. Detailed Analysis
Plano sugerido:
- backup diário incremental
- restore testado mensalmente
- retenção por criticidade

## 5. Evidence / File References
- `docker-compose.yml`

## 6. Risks / Gaps / Unknowns
Sem evidência de rotina de backup testada no repositório.

## 7. Recommendations
Formalizar runbook de recuperação e testes de desastre.

## 8. Appendix
- Ver `privacy/retention-policy.md`.
