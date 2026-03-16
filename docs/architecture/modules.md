# Módulos do Sistema

## 1. Executive Summary
Mapa funcional dos domínios de negócio e técnicos.

## 2. Key Takeaways
- API concentra múltiplos domínios em um monólito.
- Controle de autorização majoritariamente por `userId`.

## 3. System View / High-Level View
- Auth/Usuário
- Clínico
- Nutrição
- Rotina
- Social
- Gamificação
- Notificações

## 4. Detailed Analysis
Cada domínio possui controllers e services específicos no backend.

## 5. Evidence / File References
- `backend/src/controllers`
- `backend/src/services`

## 6. Risks / Gaps / Unknowns
- Acoplamento entre domínios pode crescer sem fronteiras explícitas.

## 7. Recommendations
- Definir owners por domínio e contratos de integração internos.

## 8. Appendix
- Ver `product/bounded-contexts.md`.
