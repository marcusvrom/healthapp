# Inventário de Dados

## 1. Executive Summary
Catálogo técnico de dados pessoais e sensíveis tratados na plataforma.

## 2. Key Takeaways
- PHI presente em múltiplas entidades.
- Necessário mapear finalidade e retenção por campo.

## 3. System View / High-Level View
Principais entidades:
- User
- HealthProfile
- BloodTest
- WeeklyCheckIn
- ClinicalProtocolLog

## 4. Detailed Analysis
Tabela sugerida por entidade: campo, tipo de dado, sensibilidade, finalidade, retenção, compartilhamento.

## 5. Evidence / File References
- `backend/src/entities/User.ts`
- `backend/src/entities/BloodTest.ts`

## 6. Risks / Gaps / Unknowns
Inventário ainda sem classificação e retention implementadas.

## 7. Recommendations
Manter inventário versionado e revisado por DPO técnico.

## 8. Appendix
- Ver `data-classification.md`.
