# Remediation Backlog

## 1. Executive Summary
Backlog priorizado para reduzir risco técnico, de segurança e privacidade. Atualizado após Sprint 1-2 (segurança) e Sprint 3-6.

## 2. Key Takeaways
Quick wins e itens de alto risco/baixo esforço foram implementados nas Sprints 1-2. Restam itens de alto esforço e melhorias estruturais.

## 3. System View / High-Level View
Categorias:
- ~~Quick wins~~ → Concluídos
- ~~Alto risco/baixo esforço~~ → Concluídos
- Alto risco/alto esforço → Em progresso
- Melhorias estruturais → Planejadas

## 4. Detailed Analysis

### ✅ Quick wins (CONCLUÍDOS — Sprint 1-2)
1. ~~Restringir CORS por ambiente~~ → `CORS_ORIGINS` env var com whitelist
2. ~~Validar segredo forte em produção~~ → Documentado em env vars obrigatórias
3. ~~Security headers no backend~~ → Helmet (CSP, HSTS, X-Frame-Options)

### ✅ Alto risco/baixo esforço (CONCLUÍDOS — Sprint 1-2)
1. ~~Rate limit auth~~ → 20 req / 15 min em `/api/v1/auth`
2. ~~Rate limit API~~ → 200 req / 1 min geral

### ⏳ Alto risco/alto esforço (PENDENTES)
1. ~~Revisão de modelo de sessão (HttpOnly)~~ → ✅ **CONCLUÍDO** (Sprint 1-2)
2. **Auditoria de acesso a PHI** → Planejado Sprint 11-12
3. **LGPD compliance (retenção, portabilidade)** → Planejado Sprint 11-12
4. **Upload validation robusto** → Pendente

### ⏳ Melhorias estruturais (PENDENTES)
1. **Refresh token rotation** → Pendente
2. **MFA opcional** → Pendente
3. **Token blacklist/revogação** → Pendente
4. **Testes automatizados de segurança** → Planejado Sprint 11-12
5. **Pen test antes do go-live** → Planejado pré-deploy

## 5. Evidence / File References
- `backend/src/app.ts` — helmet, cors, rate limiting implementados
- `backend/src/controllers/AuthController.ts` — HttpOnly cookies implementados
- `backend/src/middleware/auth.middleware.ts` — cookie + Bearer middleware

## 6. Risks / Gaps / Unknowns
Itens pendentes dependem do timeline de deploy e priorização de produto.

## 7. Recommendations
- Priorizar auditoria de PHI e LGPD antes do go-live com usuários reais.
- Pen test externo antes de produção com dados reais.
- Revisar backlog a cada sprint com AppSec + Produto.

## 8. Appendix
- Ver `security-review.md` e `security-checklist.md`.
