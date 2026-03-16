# Ambientes (Dev / Staging / Prod)

## 1. Executive Summary
Padrões e diferenças por ambiente para reduzir risco de configuração.

## 2. Key Takeaways
- Segredos e políticas variam por ambiente.
- Produção não deve aceitar defaults de desenvolvimento.

## 3. System View / High-Level View
Matriz por ambiente:
- hostnames
- secrets
- observabilidade
- controles de segurança

## 4. Detailed Analysis
Checklist mínimo por ambiente:
- CORS restrito
- TLS
- backup
- rate limit

## 5. Evidence / File References
- `.env.example`
- `backend/src/config/env.ts`

## 6. Risks / Gaps / Unknowns
Risco de drift de configuração sem governança.

## 7. Recommendations
Versionar baseline de ambiente e validação automática.

## 8. Appendix
- Ver `deployment.md`.
