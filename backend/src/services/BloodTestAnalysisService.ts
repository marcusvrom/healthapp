import { BloodTest } from "../entities/BloodTest";
import { Gender } from "../entities/HealthProfile";
import { MacroGrams } from "../types/calculation.types";
import {
  BloodTestAdjustmentResult,
  REFERENCE_RANGES,
  Recommendation,
  RecommendationCategory,
} from "../types/blood-test.types";

/**
 * BloodTestAnalysisService
 * ─────────────────────────
 * Applies evidence-based business rules to blood-test markers and adjusts
 * the baseline macro split produced by CalculationService.
 *
 * Rules are independent and additive — several can fire at the same time.
 * The final macro percentages are re-normalised so they always sum to 100 %.
 *
 * Rule catalogue
 * ──────────────
 *  Metabolic    1. High glucose / insulin / HbA1c → cut carbs
 *  Lipid        2. High LDL                       → cap fat, add aerobic
 *               3. High triglycerides              → cut simple carbs
 *               4. Low HDL                         → add healthy fat + aerobic
 *  Vitamins     5. Low Vitamin D                   → inject sun-exposure block
 *  Inflammation 6. High CRP                        → anti-inflammatory diet
 *  Thyroid      7. High TSH (hypothyroid)          → lifestyle + medical referral
 *               8. Low TSH (hyperthyroid)          → caloric density + referral
 *               9. Low Free T3 or T4               → medical referral
 *  Hormonal    10. Low testosterone (total/free)   → boost protein + strength
 *              11. High cortisol                   → cut stimulants, sleep protocol
 *              12. High prolactin                  → lifestyle + medical referral
 *              13. High SHBG                       → informational flag
 *  Hepatic/Renal 14. High AST or ALT              → hepatoprotective diet
 *              15. High GGT                        → alcohol + toxin reduction
 *              16. High creatinine                 → moderate protein, hydration
 *              17. High urea                       → hydration + protein check
 */
export class BloodTestAnalysisService {

  /**
   * Analyse the most recent blood-test row and return an adjusted macro
   * target plus a list of actionable recommendations.
   */
  static analyse(
    bloodTest: BloodTest,
    baseMacros: MacroGrams,
    gender: Gender,
    weightKg: number,
    totalKcal: number
  ): BloodTestAdjustmentResult {
    const rec: Recommendation[] = [];
    let requiresSunExposureBlock = false;
    let prioritiseAerobic = false;

    // Working macro percentages (mutated by rules, then re-normalised)
    let carbsPct   = (baseMacros.carbsG   * 4) / totalKcal;
    let proteinPct = (baseMacros.proteinG * 4) / totalKcal;
    let fatPct     = (baseMacros.fatG     * 9) / totalKcal;

    // ── Rule 1 — High glucose / insulin / HbA1c → reduce carbs, low-GI ──────
    const glucoseHigh = bloodTest.glucoseMgDl  != null && bloodTest.glucoseMgDl  > REFERENCE_RANGES.glucose.normal.max;
    const insulinHigh = bloodTest.insulinUiuMl != null && bloodTest.insulinUiuMl > REFERENCE_RANGES.insulin.normal.max;
    const hba1cHigh   = bloodTest.hba1cPct     != null && bloodTest.hba1cPct     > REFERENCE_RANGES.hba1c.normal.max;

    if (glucoseHigh || insulinHigh || hba1cHigh) {
      const reduction = this.glucoseReductionFactor(bloodTest);
      carbsPct = Math.max(0.10, carbsPct - reduction);
      fatPct   = Math.min(0.40, fatPct   + reduction * 0.5);

      const severity = (bloodTest.glucoseMgDl ?? 0) >= REFERENCE_RANGES.glucose.diabetes.min
        ? "critical" : "warning";

      rec.push({
        category: RecommendationCategory.CARBOHYDRATES, severity,
        message:
          "Glicemia/insulina elevada detectada. Reduza carboidratos de alto índice glicêmico " +
          "(açúcares refinados, pão branco, arroz branco). Priorize fontes de baixo IG: " +
          "aveia, batata-doce, leguminosas, vegetais fibrosos.",
      });
      rec.push({
        category: RecommendationCategory.EXERCISE, severity: "info",
        message:
          "Inclua caminhadas pós-refeição (10–20 min) para melhorar a sensibilidade " +
          "à insulina e o controle glicêmico.",
      });
    }

    // ── Rule 2 — High LDL → limit saturated fat, suggest aerobic exercise ────
    const ldlHigh = bloodTest.ldlMgDl != null && bloodTest.ldlMgDl > REFERENCE_RANGES.ldl.optimal.max;

    if (ldlHigh) {
      fatPct = Math.min(fatPct, 0.20);
      prioritiseAerobic = true;

      const severity = (bloodTest.ldlMgDl ?? 0) >= REFERENCE_RANGES.ldl.veryHigh.min
        ? "critical" : "warning";

      rec.push({
        category: RecommendationCategory.FAT, severity,
        message:
          `LDL elevado (${bloodTest.ldlMgDl} mg/dL). Limite gorduras saturadas ` +
          "(carnes gordas, laticínios integrais). Priorize gorduras insaturadas: " +
          "azeite extra-virgem, abacate, oleaginosas e peixes gordos.",
      });
      rec.push({
        category: RecommendationCategory.EXERCISE, severity: "info",
        message:
          "150 min/semana de exercício aeróbico de intensidade moderada aumentam o HDL e reduzem o LDL.",
      });
    }

    // ── Rule 3 — High triglycerides → reduce simple carbs & alcohol ──────────
    const triglyceridesHigh =
      bloodTest.triglyceridesMgDl != null &&
      bloodTest.triglyceridesMgDl > REFERENCE_RANGES.triglycerides.normal.max;

    if (triglyceridesHigh) {
      carbsPct = Math.max(0.10, carbsPct - 0.08);
      fatPct   = Math.min(0.35, fatPct   + 0.04);

      rec.push({
        category: RecommendationCategory.CARBOHYDRATES, severity: "warning",
        message:
          `Triglicerídeos elevados (${bloodTest.triglyceridesMgDl} mg/dL). ` +
          "Elimine açúcares simples, bebidas açucaradas e álcool. " +
          "Aumente ômega-3 (salmão, sardinha, linhaça, chia).",
      });
    }

    // ── Rule 4 — Low HDL → promote healthy fats & aerobic exercise ───────────
    const hdlThreshold = gender === Gender.FEMALE
      ? REFERENCE_RANGES.hdl.lowFemale.min : REFERENCE_RANGES.hdl.low.min;
    const hdlLow = bloodTest.hdlMgDl != null && bloodTest.hdlMgDl < hdlThreshold;

    if (hdlLow) {
      fatPct   = Math.min(0.35, fatPct   + 0.05);
      carbsPct = Math.max(0.10, carbsPct - 0.05);
      prioritiseAerobic = true;

      rec.push({
        category: RecommendationCategory.FAT, severity: "info",
        message:
          `HDL baixo (${bloodTest.hdlMgDl} mg/dL). Aumente gorduras saudáveis ` +
          "(azeite, abacate, castanhas) e inclua exercício aeróbico regular para elevar o HDL.",
      });
    }

    // ── Rule 5 — Low Vitamin D → inject sun-exposure block ───────────────────
    const vitaminDLow =
      bloodTest.vitaminDNgMl != null &&
      bloodTest.vitaminDNgMl <= REFERENCE_RANGES.vitaminD.insufficient.max;

    if (vitaminDLow) {
      requiresSunExposureBlock = true;
      const severity = (bloodTest.vitaminDNgMl ?? 0) <= REFERENCE_RANGES.vitaminD.deficient.max
        ? "critical" : "warning";

      rec.push({
        category: RecommendationCategory.LIFESTYLE, severity,
        message:
          `Vitamina D baixa (${bloodTest.vitaminDNgMl} ng/mL). Um bloco de "Exposição Solar" ` +
          "foi adicionado à sua rotina (10–30 min entre 10h–14h). " +
          "Converse com seu médico sobre suplementação de D3 + K2.",
      });
    }

    // ── Rule 6 — High CRP (inflammation) → anti-inflammatory diet ────────────
    const crpHigh = bloodTest.crpMgL != null && bloodTest.crpMgL > REFERENCE_RANGES.crp.average.max;

    if (crpHigh) {
      rec.push({
        category: RecommendationCategory.LIFESTYLE, severity: "warning",
        message:
          `PCR-us elevado (${bloodTest.crpMgL} mg/L) — sinal de inflamação sistêmica. ` +
          "Priorize alimentos anti-inflamatórios: cúrcuma, gengibre, ômega-3, frutas vermelhas. " +
          "Reduza ultraprocessados, gorduras trans e açúcar refinado.",
      });
    }

    // ── Rule 7 — High TSH (hypothyroid) → energy & protein guidance + referral
    const tshHigh = bloodTest.tshMiuL != null && bloodTest.tshMiuL > REFERENCE_RANGES.tsh.high.min;

    if (tshHigh) {
      carbsPct = Math.max(0.10, carbsPct - 0.05);

      rec.push({
        category: RecommendationCategory.THYROID, severity: "warning",
        message:
          `TSH elevado (${bloodTest.tshMiuL} μIU/mL) — possível hipotireoidismo. ` +
          "Evite excesso de alimentos bociogênicos crus (couve, brócolis, soja). " +
          "Garanta ingestão adequada de iodo e selênio. Consulte um endocrinologista.",
      });
    }

    // ── Rule 8 — Low TSH (hyperthyroid) → increase caloric density + referral
    const tshLow = bloodTest.tshMiuL != null && bloodTest.tshMiuL < REFERENCE_RANGES.tsh.low.min;

    if (tshLow) {
      rec.push({
        category: RecommendationCategory.THYROID, severity: "warning",
        message:
          `TSH suprimido (${bloodTest.tshMiuL} μIU/mL) — possível hipertireoidismo ou supressão exógena. ` +
          "Aumente a ingestão calórica total para compensar o hipermetabolismo. " +
          "Evite estimulantes (cafeína, efedrina). Avaliação endocrinológica urgente.",
      });
    }

    // ── Rule 9 — Low Free T3 or T4 → thyroid referral ────────────────────────
    const t3Low = bloodTest.t3FreePgMl != null && bloodTest.t3FreePgMl < REFERENCE_RANGES.t3Free.low.min;
    const t4Low = bloodTest.t4FreeNgDl != null && bloodTest.t4FreeNgDl < REFERENCE_RANGES.t4Free.low.min;

    if (t3Low || t4Low) {
      rec.push({
        category: RecommendationCategory.THYROID, severity: "warning",
        message:
          "T3 Livre e/ou T4 Livre abaixo do referencial — indicativo de hipotireoidismo " +
          "(primário ou central). Avalie com endocrinologista; pode requerer reposição hormonal.",
      });
    }

    // ── Rule 10 — Low testosterone (total or free) → boost protein + strength
    const testTotalLow =
      bloodTest.testosteroneTotalNgDl != null &&
      bloodTest.testosteroneTotalNgDl < REFERENCE_RANGES.testosteroneTotal.low.max;
    const testFreeLow =
      bloodTest.testosteroneFreeNgDl != null &&
      bloodTest.testosteroneFreeNgDl < REFERENCE_RANGES.testosteroneFree.low.max;

    if ((testTotalLow || testFreeLow) && gender === Gender.MALE) {
      proteinPct = Math.min(0.35, proteinPct + 0.05);
      carbsPct   = Math.max(0.10, carbsPct   - 0.05);

      rec.push({
        category: RecommendationCategory.HORMONAL, severity: "warning",
        message:
          `Testosterona baixa (Total: ${bloodTest.testosteroneTotalNgDl ?? "—"} ng/dL | ` +
          `Livre: ${bloodTest.testosteroneFreeNgDl ?? "—"} ng/dL). ` +
          "Priorize treino de força progressivo, sono de qualidade (7–9 h) e gorduras saudáveis " +
          "(zinco, vitamina D). Avalie com endocrinologista se persistir.",
      });
    }

    // ── Rule 11 — High cortisol → reduce stimulants, recovery protocol ────────
    const cortisolHigh =
      bloodTest.cortisolMcgDl != null &&
      bloodTest.cortisolMcgDl > REFERENCE_RANGES.cortisol.high.min;

    if (cortisolHigh) {
      proteinPct = Math.min(0.35, proteinPct + 0.03);
      carbsPct   = Math.max(0.10, carbsPct   - 0.03);

      rec.push({
        category: RecommendationCategory.HORMONAL, severity: "warning",
        message:
          `Cortisol matinal elevado (${bloodTest.cortisolMcgDl} μg/dL) — sinal de estresse ` +
          "crônico. Priorize sono (7–9 h), relaxamento (meditação, respiração diafragmática). " +
          "Reduza cafeína após 14h e evite sessões de treino excessivamente longas. " +
          "Adapatógenos (ashwagandha) podem auxiliar sob orientação médica.",
      });
    }

    // ── Rule 12 — High prolactin → lifestyle + medical referral ──────────────
    const prolactinThreshold = gender === Gender.FEMALE
      ? REFERENCE_RANGES.prolactinFemale.high.min : REFERENCE_RANGES.prolactinMale.high.min;
    const prolactinHigh =
      bloodTest.prolactinNgMl != null && bloodTest.prolactinNgMl > prolactinThreshold;

    if (prolactinHigh) {
      rec.push({
        category: RecommendationCategory.HORMONAL, severity: "warning",
        message:
          `Prolactina elevada (${bloodTest.prolactinNgMl} ng/mL). Causas comuns: estresse, ` +
          "exercício intenso recente, hipotireoidismo ou uso de medicamentos dopaminérgicos. " +
          "Avalie com endocrinologista — pode indicar hiperprolactinemia ou prolactinoma.",
      });
    }

    // ── Rule 13 — High SHBG → informational flag ──────────────────────────────
    const shbgHigh = bloodTest.shbgNmolL != null && bloodTest.shbgNmolL > REFERENCE_RANGES.shbg.high.min;

    if (shbgHigh) {
      rec.push({
        category: RecommendationCategory.HORMONAL, severity: "info",
        message:
          `SHBG elevado (${bloodTest.shbgNmolL} nmol/L) — reduz a biodisponibilidade de ` +
          "testosterona e outros hormônios sexuais. Associado a dietas hipocalóricas prolongadas, " +
          "excesso de fibras ou hipotireoidismo. Avalie com especialista.",
      });
    }

    // ── Rule 14 — High AST or ALT → hepatoprotective diet ────────────────────
    const astHigh = bloodTest.astUL != null && bloodTest.astUL > REFERENCE_RANGES.ast.normal.max;
    const altHigh = bloodTest.altUL != null && bloodTest.altUL > REFERENCE_RANGES.alt.normal.max;

    if (astHigh || altHigh) {
      const severity =
        ((bloodTest.astUL ?? 0) >= REFERENCE_RANGES.ast.veryHigh.min ||
         (bloodTest.altUL ?? 0) >= REFERENCE_RANGES.alt.veryHigh.min)
          ? "critical" : "warning";

      rec.push({
        category: RecommendationCategory.HEPATIC_RENAL, severity,
        message:
          `Transaminases elevadas (AST: ${bloodTest.astUL ?? "—"} U/L | ALT: ${bloodTest.altUL ?? "—"} U/L). ` +
          "Elimine álcool completamente. Reduza suplementos hepatotóxicos em doses altas " +
          "(niacina, kava, doses excessivas de vitamina A). " +
          "Priorize alcachofra, cardo-mariano, cúrcuma e brócolis. Avaliação médica recomendada.",
      });
    }

    // ── Rule 15 — High GGT → alcohol + toxin reduction ───────────────────────
    const gamaGtThreshold = gender === Gender.FEMALE
      ? REFERENCE_RANGES.gamaGt.normalFemale.max : REFERENCE_RANGES.gamaGt.normalMale.max;
    const gamaGtHigh =
      bloodTest.gamaGtUL != null && bloodTest.gamaGtUL > gamaGtThreshold;

    if (gamaGtHigh) {
      rec.push({
        category: RecommendationCategory.HEPATIC_RENAL, severity: "warning",
        message:
          `GGT elevado (${bloodTest.gamaGtUL} U/L) — marcador sensível de sobrecarga hepática, ` +
          "especialmente por álcool ou medicamentos. Suspenda ou reduza drasticamente o álcool. " +
          "Reveja medicamentos e suplementos em uso com seu médico.",
      });
    }

    // ── Rule 16 — High creatinine → moderate protein, increase hydration ──────
    const creatinineThreshold = gender === Gender.FEMALE
      ? REFERENCE_RANGES.creatinine.normalFemale.max : REFERENCE_RANGES.creatinine.normalMale.max;
    const creatinineHigh =
      bloodTest.creatinineMgDl != null && bloodTest.creatinineMgDl > creatinineThreshold;

    if (creatinineHigh) {
      proteinPct = Math.min(proteinPct, 0.25); // cap protein at ~25 % of calories

      rec.push({
        category: RecommendationCategory.HEPATIC_RENAL, severity: "warning",
        message:
          `Creatinina elevada (${bloodTest.creatinineMgDl} mg/dL) — possível sobrecarga renal. ` +
          "Modere a ingestão de proteína (máx. 1,6 g/kg/dia). " +
          "Aumente a hidratação para ≥ 35 ml/kg/dia. Avaliação nefrológica recomendada.",
      });
    }

    // ── Rule 17 — High urea → hydration + protein check ───────────────────────
    const ureaHigh = bloodTest.ureaMgDl != null && bloodTest.ureaMgDl > REFERENCE_RANGES.urea.high.min;

    if (ureaHigh) {
      rec.push({
        category: RecommendationCategory.HEPATIC_RENAL, severity: "info",
        message:
          `Ureia elevada (${bloodTest.ureaMgDl} mg/dL). Pode indicar desidratação, ingestão ` +
          "proteica excessiva ou redução da filtração renal. " +
          "Garanta hidratação adequada e avalie a quantidade de proteína consumida.",
      });
    }

    // ── Normalise macro percentages so they always sum to 1.0 ────────────────
    const total = carbsPct + proteinPct + fatPct;
    carbsPct   /= total;
    proteinPct /= total;
    fatPct     /= total;

    const adjustedMacros: MacroGrams = {
      proteinG: this.round2((proteinPct * totalKcal) / 4),
      carbsG:   this.round2((carbsPct   * totalKcal) / 4),
      fatG:     this.round2((fatPct     * totalKcal) / 9),
    };

    return { adjustedMacros, recommendations: rec, requiresSunExposureBlock, prioritiseAerobic };
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  /** Returns carbohydrate reduction factor based on glucose severity. */
  private static glucoseReductionFactor(bt: BloodTest): number {
    if (bt.glucoseMgDl != null && bt.glucoseMgDl >= REFERENCE_RANGES.glucose.diabetes.min) {
      return 0.15; // Diabetes range   → −15 pp
    }
    return 0.10;   // Prediabetes range → −10 pp
  }

  private static round2(n: number): number {
    return Math.round(n * 100) / 100;
  }
}
