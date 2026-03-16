# Secrets and Configuration

## 1. Executive Summary
Guia para governança de segredos e variáveis críticas.

## 2. Key Takeaways
- Nunca usar defaults em produção.
- Separar segredos por ambiente.

## 3. System View / High-Level View
Segredos críticos:
- JWT_SECRET
- DB_PASSWORD
- qualquer chave de integração externa

## 4. Detailed Analysis
Estado atual usa `.env.example` com valores default para desenvolvimento.

## 5. Evidence / File References
- `.env.example`
- `backend/src/config/env.ts`

## 6. Risks / Gaps / Unknowns
- Falha humana pode promover defaults para ambiente real.

## 7. Recommendations
- Secret manager + rotação + validação de startup.

## 8. Appendix
- Ver `operations/environments.md`.
