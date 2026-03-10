import { MacroGrams } from "./calculation.types";

/** Result produced by BloodTestAnalysisService */
export interface BloodTestAdjustmentResult {
  /** Adjusted macro split (grams) after applying blood-test rules */
  adjustedMacros: MacroGrams;
  /** List of actionable recommendations */
  recommendations: Recommendation[];
  /** Whether a "sun exposure" block must be injected into the routine */
  requiresSunExposureBlock: boolean;
  /** Whether aerobic exercise should be prioritised */
  prioritiseAerobic: boolean;
}

export interface Recommendation {
  category: RecommendationCategory;
  message: string;
  severity: "info" | "warning" | "critical";
}

export enum RecommendationCategory {
  CARBOHYDRATES = "carbohydrates",
  PROTEIN = "protein",
  FAT = "fat",
  EXERCISE = "exercise",
  SUPPLEMENTATION = "supplementation",
  LIFESTYLE = "lifestyle",
  HORMONAL = "hormonal",
  HEPATIC_RENAL = "hepatic_renal",
  THYROID = "thyroid",
}

/**
 * Evidence-based clinical reference ranges.
 *
 * Sources: ADA, ACC/AHA, Endocrine Society, Brazilian Society of Endocrinology
 * (SBEM), UpToDate, and standard laboratory reference intervals.
 *
 * All thresholds are population-level guidelines; individual clinical context
 * must always take precedence.
 */
export const REFERENCE_RANGES = {
  // ── Metabolic ─────────────────────────────────────────────────────────────
  glucose:      { normal: { max: 99 }, prediabetes: { max: 125 }, diabetes: { min: 126 } }, // mg/dL fasting
  insulin:      { normal: { max: 25 } },                                                      // μIU/mL fasting
  hba1c:        { normal: { max: 5.6 }, prediabetes: { max: 6.4 } },                         // %

  // ── Lipid Panel ───────────────────────────────────────────────────────────
  ldl:          { optimal: { max: 100 }, borderline: { max: 129 }, high: { max: 159 }, veryHigh: { min: 190 } }, // mg/dL
  hdl:          { low: { min: 40 }, lowFemale: { min: 50 } },                                // mg/dL
  triglycerides:{ normal: { max: 150 }, borderline: { max: 199 }, high: { max: 499 } },      // mg/dL

  // ── Vitamins ──────────────────────────────────────────────────────────────
  vitaminD:     { deficient: { max: 20 }, insufficient: { max: 29 } },                       // ng/mL

  // ── Inflammation ──────────────────────────────────────────────────────────
  crp:          { low: { max: 1 }, average: { max: 3 } },                                    // mg/L

  // ── Thyroid ───────────────────────────────────────────────────────────────
  tsh:          { low: { min: 0.4 }, normal: { min: 0.4, max: 4.0 }, high: { min: 4.0 } },  // μIU/mL
  t3Free:       { low: { min: 2.3 }, normal: { min: 2.3, max: 4.2 } },                      // pg/mL
  t4Free:       { low: { min: 0.8 }, normal: { min: 0.8, max: 1.8 } },                      // ng/dL

  // ── Hormonal (male reference unless noted) ────────────────────────────────
  testosteroneTotal: { low: { max: 300 }, normal: { min: 300, max: 1000 } },                 // ng/dL
  testosteroneFree:  { low: { max: 5 } },                                                    // ng/dL
  estradiolMale:     { high: { min: 40 } },                                                  // pg/mL (men)
  shbg:              { high: { min: 58 } },                                                  // nmol/L
  prolactinMale:     { high: { min: 15 } },                                                  // ng/mL (men)
  prolactinFemale:   { high: { min: 25 } },                                                  // ng/mL (women)
  cortisol:          { low: { max: 6 }, normal: { min: 6, max: 23 }, high: { min: 23 } },   // μg/dL morning

  // ── Hepatic & Renal ───────────────────────────────────────────────────────
  ast:           { normal: { max: 40 }, high: { min: 40 }, veryHigh: { min: 80 } },          // U/L
  alt:           { normal: { max: 40 }, high: { min: 40 }, veryHigh: { min: 80 } },          // U/L
  gamaGt:        { normalMale: { max: 60 }, normalFemale: { max: 40 } },                     // U/L
  creatinine:    { normalMale: { max: 1.2 }, normalFemale: { max: 1.0 }, high: { min: 1.3 } }, // mg/dL
  urea:          { normal: { max: 50 }, high: { min: 50 } },                                  // mg/dL
} as const;
