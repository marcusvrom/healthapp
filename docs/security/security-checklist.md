# Security Checklist

## 1. Executive Summary
Checklist operacional para releases e mudanças críticas. Atualizado com status pós-Sprint 1-2.

## 2. Key Takeaways
Aplicar antes de merge/release em produção.

## 3. System View / High-Level View
Categorias:
- Auth/Authz
- Input validation
- Uploads
- Secrets/config
- Logs/auditoria
- PWA/Push

## 4. Detailed Analysis

### Auth/Authz
- [x] Rate limiting em `/auth/*` — 20/15min ✅
- [x] Sessão em HttpOnly cookie (não localStorage) ✅
- [x] SameSite strict em produção ✅
- [x] Logout limpa cookie no servidor ✅
- [ ] MFA opcional para dados sensíveis
- [ ] Refresh token rotation
- [ ] Token blacklist/revogação

### HTTP Security
- [x] CORS restrito por ambiente (`CORS_ORIGINS`) ✅
- [x] Security headers — Helmet (CSP, HSTS, X-Frame-Options) ✅
- [x] cookie-parser para HttpOnly cookies ✅
- [x] Rate limiting geral da API — 200/min ✅

### Input Validation
- [x] express-validator em rotas críticas ✅
- [ ] Validação robusta de uploads (magic bytes, tamanho)
- [ ] Sanitização de input em campos de texto livre

### Secrets/Config
- [x] Env vars documentadas para produção ✅
- [x] CORS_ORIGINS, COOKIE_DOMAIN, VAPID keys configuráveis ✅
- [ ] Validação de startup (rejeitar boot sem JWT_SECRET forte)
- [ ] Secret manager em produção

### Logs/Auditoria
- [ ] Redaction de PII/PHI em logs
- [ ] Auditoria de acesso a dados clínicos
- [ ] Testes de autorização por recurso

### PWA/Push
- [x] VAPID keys em env vars (não hardcoded) ✅
- [x] Endpoint público para VAPID key ✅
- [x] Auto-desativação de subscriptions expiradas ✅
- [ ] Validação de origin em push subscriptions

## 5. Evidence / File References
- `backend/src/app.ts` — helmet, cors, rate limiting
- `backend/src/routes/index.ts` — rotas protegidas
- `backend/src/controllers/AuthController.ts` — cookie config

## 6. Risks / Gaps / Unknowns
Checklist depende de validação dinâmica complementar (pen test).

## 7. Recommendations
Automatizar checklist no CI sempre que possível (linting, SAST).

## 8. Appendix
- Ver `operations/ci-cd.md`.
