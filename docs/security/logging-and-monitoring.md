# Logging and Monitoring

## 1. Executive Summary
Princípios para monitorar segurança sem vazar PII/PHI.

## 2. Key Takeaways
- Log estruturado e minimizado.
- Telemetria de auth e abuso.

## 3. System View / High-Level View
Eventos mínimos:
- login success/fail
- tentativa de acesso negado
- alterações em recursos clínicos

## 4. Detailed Analysis
Definir correlação por request-id e redaction de dados sensíveis em erros.

## 5. Evidence / File References
- `backend/src/middleware/error.middleware.ts`

## 6. Risks / Gaps / Unknowns
Sem política de observabilidade formal no repositório.

## 7. Recommendations
Integrar stack de logs/auditoria centralizada.

## 8. Appendix
- Ver `operations/runbook.md`.
