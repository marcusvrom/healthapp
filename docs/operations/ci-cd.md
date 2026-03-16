# CI/CD

## 1. Executive Summary
Diretrizes para pipeline com gates de qualidade, segurança e privacidade.

## 2. Key Takeaways
- Incluir checks estáticos e de segurança em cada PR.
- Definir critérios de bloqueio por severidade.

## 3. System View / High-Level View
Etapas sugeridas:
1. lint/typecheck/tests
2. scans de dependências
3. validações de documentação crítica

## 4. Detailed Analysis
Adicionar gates para:
- auth/authz tests
- validação de headers
- regressão de autorização

## 5. Evidence / File References
- `backend/package.json`
- `frontend/package.json`

## 6. Risks / Gaps / Unknowns
Pipeline CI não encontrado no repositório analisado.

## 7. Recommendations
Criar workflow CI com requisitos mínimos de segurança.

## 8. Appendix
- Ver `security/security-checklist.md`.
