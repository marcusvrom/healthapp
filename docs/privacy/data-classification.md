# Classificação de Dados

## 1. Executive Summary
Modelo de classificação para orientar controles de segurança e privacidade.

## 2. Key Takeaways
Classes propostas:
- Pública
- Interna
- Pessoal
- Sensível (saúde)

## 3. System View / High-Level View
Dado de saúde deve ser tratado como sensível por padrão.

## 4. Detailed Analysis
Para cada classe, definir:
- criptografia
- retenção
- nível de log permitido
- requisitos de acesso

## 5. Evidence / File References
- `backend/src/entities/HealthProfile.ts`
- `backend/src/entities/BloodTest.ts`

## 6. Risks / Gaps / Unknowns
Sem enforcement automatizado por classe no estado atual.

## 7. Recommendations
Alinhar classificação com controles técnicos obrigatórios por ambiente.

## 8. Appendix
- Ver `security/logging-and-monitoring.md`.
