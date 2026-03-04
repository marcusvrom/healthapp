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
 * Rules are independent and additive – several can fire at the same time.
 * The final macro percentages are re-normalised so they always sum to 100 %.
 */
export class BloodTestAnalysisService {

  /**
   * Analyse the most recent blood-test row and return an adjusted macro
   * target plus a list of recommendations.
   *
   * @param bloodTest   latest BloodTest entity (null-safe)
   * @param baseMacros  baseline MacroGrams from CalculationService
   * @param gender      user gender (affects some HDL thresholds)
   * @param weightKg    body weight (used to recalculate protein in g)
   * @param totalKcal   daily caloric target (used to recompute macros)
   */
  static analyse(
    bloodTest: BloodTest,
    baseMacros: MacroGrams,
    gender: Gender,
    weightKg: number,
    totalKcal: number
  ): BloodTestAdjustmentResult {
    const recommendations: Recommendation[] = [];
    let requiresSunExposureBlock = false;
    let prioritiseAerobic = false;

    // Working macro percentages (will be mutated by rules, then re-normalised)
    // Initialise from baseMacros
    let carbsPct = (baseMacros.carbsG * 4) / totalKcal;
    let proteinPct = (baseMacros.proteinG * 4) / totalKcal;
    let fatPct = (baseMacros.fatG * 9) / totalKcal;

    // ── Rule 1: High glucose / insulin → reduce carbs, choose low GI ──────
    const glucoseHigh =
      bloodTest.glucoseMgDl != null &&
      bloodTest.glucoseMgDl > REFERENCE_RANGES.glucose.normal.max;

    const insulinHigh =
      bloodTest.insulinUiuMl != null &&
      bloodTest.insulinUiuMl > REFERENCE_RANGES.insulin.normal.max;

    const hba1cHigh =
      bloodTest.hba1cPct != null &&
      bloodTest.hba1cPct > REFERENCE_RANGES.hba1c.normal.max;

    if (glucoseHigh || insulinHigh || hba1cHigh) {
      // Reduce carbohydrates by 10–15 percentage points
      const reduction = this.glucoseReductionFactor(bloodTest);
      carbsPct = Math.max(0.1, carbsPct - reduction);

      // Compensate by increasing fat slightly (keeps total at ~100 %)
      fatPct = Math.min(0.40, fatPct + reduction * 0.5);

      const severity =
        (bloodTest.glucoseMgDl ?? 0) >= REFERENCE_RANGES.glucose.diabetes.min
          ? "critical"
          : "warning";

      recommendations.push({
        category: RecommendationCategory.CARBOHYDRATES,
        severity,
        message:
          "Glicemia/insulina elevada detectada. Reduza carboidratos de alto índice " +
          "glicêmico (açúcares refinados, pão branco, arroz branco). Priorize " +
          "fontes de baixo IG: aveia, batata-doce, leguminosas, vegetais fibrosos.",
      });

      recommendations.push({
        category: RecommendationCategory.EXERCISE,
        severity: "info",
        message:
          "Inclua caminhadas pós-refeição (10–20 min) para melhorar a sensibilidade " +
          "à insulina e o controle glicêmico.",
      });
    }

    // ── Rule 2: High LDL → limit saturated fat, suggest aerobic exercise ──
    const ldlHigh =
      bloodTest.ldlMgDl != null &&
      bloodTest.ldlMgDl > REFERENCE_RANGES.ldl.optimal.max;

    if (ldlHigh) {
      // Cap fat at 20 % and flag saturated-fat restriction
      fatPct = Math.min(fatPct, 0.20);

      prioritiseAerobic = true;

      const severity =
        (bloodTest.ldlMgDl ?? 0) >= REFERENCE_RANGES.ldl.veryHigh.min
          ? "critical"
          : "warning";

      recommendations.push({
        category: RecommendationCategory.FAT,
        severity,
        message:
          `LDL elevado (${bloodTest.ldlMgDl} mg/dL). Limite gorduras saturadas ` +
          "(carnes gordas, laticínios integrais, óleo de coco). Priorize gorduras " +
          "insaturadas: azeite extra-virgem, abacate, oleaginosas e peixes gordos.",
      });

      recommendations.push({
        category: RecommendationCategory.EXERCISE,
        severity: "info",
        message:
          "Exercícios aeróbicos de intensidade moderada (150 min/semana) aumentam " +
          "o HDL e reduzem o LDL. Priorize caminhada rápida, ciclismo ou natação.",
      });
    }

    // ── Rule 3: Low Vitamin D → inject sun-exposure block ─────────────────
    const vitaminDLow =
      bloodTest.vitaminDNgMl != null &&
      bloodTest.vitaminDNgMl <= REFERENCE_RANGES.vitaminD.insufficient.max;

    if (vitaminDLow) {
      requiresSunExposureBlock = true;

      const severity =
        (bloodTest.vitaminDNgMl ?? 0) <= REFERENCE_RANGES.vitaminD.deficient.max
          ? "critical"
          : "warning";

      recommendations.push({
        category: RecommendationCategory.LIFESTYLE,
        severity,
        message:
          `Vitamina D baixa (${bloodTest.vitaminDNgMl} ng/mL). Um bloco de ` +
          '"Exposição Solar" foi adicionado à sua rotina (10–30 min entre 10h–14h, ' +
          "sem protetor solar em braços/pernas quando possível). Converse com seu " +
          "médico sobre suplementação de vitamina D3 + K2.",
      });
    }

    // ── Rule 4: High triglycerides → reduce simple carbs & alcohol ────────
    const triglyceridesHigh =
      bloodTest.triglyceridesMgDl != null &&
      bloodTest.triglyceridesMgDl > REFERENCE_RANGES.triglycerides.normal.max;

    if (triglyceridesHigh) {
      carbsPct = Math.max(0.1, carbsPct - 0.08);
      fatPct = Math.min(0.35, fatPct + 0.04);

      recommendations.push({
        category: RecommendationCategory.CARBOHYDRATES,
        severity: "warning",
        message:
          `Triglicerídeos elevados (${bloodTest.triglyceridesMgDl} mg/dL). ` +
          "Elimine açúcares simples, bebidas açucaradas e álcool. Aumente o consumo " +
          "de ômega-3 (salmão, sardinha, linhaça, chia).",
      });
    }

    // ── Rule 5: Low HDL → promote healthy fats & aerobic exercise ─────────
    const hdlThreshold =
      gender === Gender.FEMALE
        ? REFERENCE_RANGES.hdl.lowFemale.min
        : REFERENCE_RANGES.hdl.low.min;

    const hdlLow =
      bloodTest.hdlMgDl != null && bloodTest.hdlMgDl < hdlThreshold;

    if (hdlLow) {
      // Slightly increase healthy fat allocation
      fatPct = Math.min(0.35, fatPct + 0.05);
      carbsPct = Math.max(0.1, carbsPct - 0.05);
      prioritiseAerobic = true;

      recommendations.push({
        category: RecommendationCategory.FAT,
        severity: "info",
        message:
          `HDL baixo (${bloodTest.hdlMgDl} mg/dL). Aumente o consumo de gorduras ` +
          "saudáveis (azeite, abacate, castanhas) e inclua exercício aeróbico " +
          "regular para elevar o HDL.",
      });
    }

    // ── Rule 6: High CRP (inflammation) → anti-inflammatory diet ──────────
    const crpHigh =
      bloodTest.crpMgL != null &&
      bloodTest.crpMgL > REFERENCE_RANGES.crp.average.max;

    if (crpHigh) {
      recommendations.push({
        category: RecommendationCategory.LIFESTYLE,
        severity: "warning",
        message:
          `PCR-us elevado (${bloodTest.crpMgL} mg/L) – sinal de inflamação sistêmica. ` +
          "Priorize alimentos anti-inflamatórios: cúrcuma, gengibre, ômega-3, " +
          "frutas vermelhas. Reduza ultraprocessados, gorduras trans e açúcar refinado.",
      });
    }

    // ── Normalise macro percentages so they sum to 1.0 ────────────────────
    const total = carbsPct + proteinPct + fatPct;
    carbsPct /= total;
    proteinPct /= total;
    fatPct /= total;

    // Convert adjusted percentages back to grams
    const adjustedMacros: MacroGrams = {
      proteinG: this.round2((proteinPct * totalKcal) / 4),
      carbsG: this.round2((carbsPct * totalKcal) / 4),
      fatG: this.round2((fatPct * totalKcal) / 9),
    };

    return {
      adjustedMacros,
      recommendations,
      requiresSunExposureBlock,
      prioritiseAerobic,
    };
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  /**
   * Returns the carbohydrate reduction factor based on glucose severity.
   *  Prediabetes range → −10 pp
   *  Diabetes range    → −15 pp
   */
  private static glucoseReductionFactor(bt: BloodTest): number {
    if (
      bt.glucoseMgDl != null &&
      bt.glucoseMgDl >= REFERENCE_RANGES.glucose.diabetes.min
    ) {
      return 0.15;
    }
    return 0.10;
  }

  private static round2(n: number): number {
    return Math.round(n * 100) / 100;
  }
}
