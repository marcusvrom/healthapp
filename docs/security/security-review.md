# Security Review (ASVS-oriented)

## 1. Executive Summary
Revisão técnica atualizada após implementação das Sprints 1-2 (segurança). Os principais riscos de sessão, CORS e rate limiting foram remediados. Restam pontos de melhoria em upload validation, auditoria de PHI e MFA.

## 2. Key Takeaways
- ~~Token em localStorage.~~ **REMEDIADO**: JWT em HttpOnly cookie com SameSite strict.
- ~~CORS permissivo.~~ **REMEDIADO**: Whitelist por ambiente via `CORS_ORIGINS`.
- ~~Ausência de rate limiting.~~ **REMEDIADO**: Auth 20/15min, API 200/min.
- ~~Sem security headers.~~ **REMEDIADO**: Helmet com CSP, HSTS, X-Frame-Options.
- **Pendente**: Uploads com validação superficial.
- **Pendente**: Auditoria formal de acesso a PHI.
- **Pendente**: MFA opcional.

## 3. System View / High-Level View
Escopo: autenticação, autorização, validação, uploads, logs, configurações e superfícies de abuso.

## 4. Detailed Analysis

### Achados e Status

| ID      | Achado                                  | Severidade | Status                    |
| ------- | --------------------------------------- | ---------- | ------------------------- |
| SEC-001 | Sessão em localStorage                  | Alto       | ✅ **REMEDIADO** (Sprint 1-2) |
| SEC-002 | Defaults inseguros de segredo/config    | Alto       | ⚠️ Parcial (env vars documentadas, validação de startup pendente) |
| SEC-003 | CORS aberto                             | Médio      | ✅ **REMEDIADO** (Sprint 1-2) |
| SEC-004 | Falta de rate limiting em auth          | Alto       | ✅ **REMEDIADO** (Sprint 1-2) |
| SEC-005 | Sem security headers                    | Médio      | ✅ **REMEDIADO** (Sprint 1-2) |
| SEC-006 | Upload validation superficial           | Médio      | ⏳ Pendente               |
| SEC-007 | Sem auditoria de acesso a PHI           | Alto       | ⏳ Pendente (Sprint 11-12) |
| SEC-008 | Sem MFA                                 | Médio      | ⏳ Pendente               |
| SEC-009 | Sem refresh token / revogação           | Médio      | ⏳ Pendente               |

### Controles Implementados

| Controle           | Implementação                                              | Arquivo                    |
| ------------------ | ---------------------------------------------------------- | -------------------------- |
| HttpOnly JWT       | Cookie `ha_token`, SameSite strict em prod                 | `AuthController.ts`        |
| Bearer fallback    | Middleware aceita cookie OU header                          | `auth.middleware.ts`       |
| Helmet             | CSP, HSTS, X-Frame-Options, X-Content-Type-Options         | `app.ts`                   |
| CORS restritivo    | Whitelist via `CORS_ORIGINS`, credentials: true             | `app.ts`                   |
| Rate limit auth    | 20 req / 15 min                                            | `app.ts`                   |
| Rate limit API     | 200 req / 1 min                                            | `app.ts`                   |
| Password hashing   | bcrypt                                                     | `AuthController.ts`        |

## 5. Evidence / File References
- `backend/src/app.ts` — helmet, cors, rate limiting, cookie-parser
- `backend/src/controllers/AuthController.ts` — login, setTokenCookie, logout
- `backend/src/middleware/auth.middleware.ts` — cookie + Bearer
- `backend/src/config/env.ts` — corsOrigins, cookieDomain
- `frontend/src/app/core/services/api.service.ts` — withCredentials: true

## 6. Risks / Gaps / Unknowns
- Validação de uploads precisa ser fortalecida (magic bytes, tamanho, tipo).
- Sem trilha de auditoria formal para acesso a dados clínicos.
- Sem validação dinâmica de produção (pen test).

## 7. Recommendations
- Fortalecer validação de uploads (Sprint 9-10 ou dedicada).
- Implementar auditoria de PHI (Sprint 11-12).
- Avaliar MFA opcional para usuários com dados sensíveis.
- Pen test antes do go-live.

## 8. Appendix
- Ver `threat-model.md` e `remediation-backlog.md`.
