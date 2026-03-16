# Security Review (ASVS-oriented)

## 1. Executive Summary
Revisão técnica preliminar identificou riscos relevantes para um SaaS de saúde: sessão, hardening HTTP, validação de entrada e controles operacionais.

## 2. Key Takeaways
- Token em localStorage.
- CORS permissivo.
- Uploads com validação superficial.
- Ausência explícita de rate limiting em autenticação.

## 3. System View / High-Level View
Escopo: autenticação, autorização, validação, uploads, logs, configurações e superfícies de abuso.

## 4. Detailed Analysis
### Principais achados
- SEC-001 Sessão em localStorage (alto)
- SEC-002 Defaults inseguros de segredo/config (alto)
- SEC-003 CORS aberto (médio)
- SEC-004 Falta de rate limiting em auth (alto)

## 5. Evidence / File References
- `frontend/src/app/core/services/auth.service.ts`
- `backend/src/app.ts`
- `backend/src/config/env.ts`

## 6. Risks / Gaps / Unknowns
- Sem validação dinâmica de produção nesta revisão.

## 7. Recommendations
- Endurecer sessão e headers.
- Introduzir rate limiting e validação de payload.

## 8. Appendix
- Ver `threat-model.md` e `remediation-backlog.md`.
