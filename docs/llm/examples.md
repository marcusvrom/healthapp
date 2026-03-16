# Examples para LLMs

## 1. Executive Summary
Exemplos práticos de boas análises e prompts úteis.

## 2. Key Takeaways
- Sempre separar fato, inferência, risco e recomendação.
- Sempre citar evidências sem expor dados sensíveis.

## 3. System View / High-Level View
Modelos de saída:
- review de módulo
- review de segurança
- análise LGPD

## 4. Detailed Analysis
### Exemplo de evidência segura
"O fluxo usa JWT Bearer no middleware" + referência de arquivo.

### Exemplo de prompt útil
"Mapeie trust boundaries do módulo X e riscos de IDOR."

## 5. Evidence / File References
- `backend/src/middleware/auth.middleware.ts`

## 6. Risks / Gaps / Unknowns
Exemplos devem ser atualizados quando a arquitetura mudar.

## 7. Recommendations
Revisar exemplos em cada release maior.

## 8. Appendix
- Ver `prompts.txt`.
