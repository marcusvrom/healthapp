# Security Checklist

## 1. Executive Summary
Checklist operacional para releases e mudanças críticas.

## 2. Key Takeaways
Aplicar antes de merge/release em produção.

## 3. System View / High-Level View
Categorias:
- Auth/Authz
- Input validation
- Uploads
- Secrets/config
- Logs/auditoria

## 4. Detailed Analysis
- [ ] Rate limiting em `/auth/*`
- [ ] CORS restrito por ambiente
- [ ] Security headers (CSP/HSTS/etc.)
- [ ] Redaction de PII/PHI em logs
- [ ] Testes de autorização por recurso

## 5. Evidence / File References
- `backend/src/routes/index.ts`
- `frontend/nginx.conf`

## 6. Risks / Gaps / Unknowns
Checklist depende de validação dinâmica complementar.

## 7. Recommendations
Automatizar checklist no CI sempre que possível.

## 8. Appendix
- Ver `operations/ci-cd.md`.
