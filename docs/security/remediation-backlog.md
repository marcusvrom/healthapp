# Remediation Backlog

## 1. Executive Summary
Backlog priorizado para reduzir risco técnico, de segurança e privacidade.

## 2. Key Takeaways
Prioridades iniciais em sessão, segredos, rate limit e uploads.

## 3. System View / High-Level View
Categorias:
- Quick wins
- Alto risco/baixo esforço
- Alto risco/alto esforço
- Melhorias estruturais

## 4. Detailed Analysis
## Quick wins
1. Restringir CORS por ambiente
2. Validar segredo forte em produção
3. Security headers no frontend gateway

## Alto risco/baixo esforço
1. Rate limit auth
2. Validação de payload de upload

## Alto risco/alto esforço
1. Revisão de modelo de sessão (HttpOnly)
2. Auditoria de acesso a PHI

## 5. Evidence / File References
- `backend/src/app.ts`
- `frontend/src/app/core/services/auth.service.ts`

## 6. Risks / Gaps / Unknowns
Esforço depende da estratégia de infraestrutura.

## 7. Recommendations
Revisar backlog a cada sprint com AppSec + Produto.

## 8. Appendix
- Ver `security-review.md`.
