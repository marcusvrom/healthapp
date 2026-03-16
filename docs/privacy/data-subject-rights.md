# Direitos do Titular (Operacional Técnico)

## 1. Executive Summary
Fluxos técnicos para atender requisições de titulares (LGPD).

## 2. Key Takeaways
- Definir processo padronizado com SLA.
- Garantir identificação e rastreabilidade.

## 3. System View / High-Level View
Direitos cobertos:
- acesso
- correção
- exclusão
- portabilidade
- revogação/contestação

## 4. Detailed Analysis
Para cada direito: entrada, validação de identidade, execução técnica, resposta, auditoria.

## 5. Evidence / File References
- `backend/src/entities/User.ts`
- `backend/src/entities/HealthProfile.ts`

## 6. Risks / Gaps / Unknowns
Sem endpoints/processo explícito dedicado para DSR no código analisado.

## 7. Recommendations
Criar runbook DSR e integração com suporte/jurídico.

## 8. Appendix
- Ver `operations/runbook.md`.
