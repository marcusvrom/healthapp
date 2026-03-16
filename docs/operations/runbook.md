# Runbook Operacional

## 1. Executive Summary
Procedimentos para operação, incidentes e continuidade.

## 2. Key Takeaways
- Definir playbooks de incidentes técnicos e de privacidade.
- Garantir papéis e escalonamento.

## 3. System View / High-Level View
Cenários:
- indisponibilidade API
- falha de banco
- suspeita de vazamento

## 4. Detailed Analysis
Cada playbook deve conter:
- gatilho
- diagnóstico
- contenção
- recuperação
- pós-mortem

## 5. Evidence / File References
- `docker-compose.yml`
- `backend/src/app.ts`

## 6. Risks / Gaps / Unknowns
Sem processo formal de incident response no repositório.

## 7. Recommendations
Definir on-call e métricas de incidentes.

## 8. Appendix
- Ver `security/logging-and-monitoring.md`.
