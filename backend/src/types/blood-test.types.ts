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
}

/** Clinical reference ranges used for rule evaluation */
export const REFERENCE_RANGES = {
  glucose: { normal: { max: 99 }, prediabetes: { max: 125 }, diabetes: { min: 126 } },
  insulin: { normal: { max: 25 } },                // μIU/mL fasting
  hba1c: { normal: { max: 5.6 }, prediabetes: { max: 6.4 } }, // %
  ldl: { optimal: { max: 100 }, borderline: { max: 129 }, high: { max: 159 }, veryHigh: { min: 190 } },
  hdl: { low: { min: 40 }, lowFemale: { min: 50 } },
  triglycerides: { normal: { max: 150 }, borderline: { max: 199 }, high: { max: 499 } },
  vitaminD: { deficient: { max: 20 }, insufficient: { max: 29 } }, // ng/mL
  crp: { low: { max: 1 }, average: { max: 3 } },   // mg/L
} as const;
