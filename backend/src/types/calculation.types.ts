/** Result of the core metabolic engine calculations */
export interface MetabolicResult {
  /** Basal Metabolic Rate – kcal/day (Mifflin-St Jeor) */
  bmr: number;
  /** Total Energy Expenditure = BMR × activity multiplier */
  tee: number;
  /** Calories burned in the exercise session */
  exerciseCalories: number;
  /** Total daily caloric target (TEE + exercise) */
  dailyCaloricTarget: number;
  /** Macro split in grams */
  macros: MacroGrams;
  /** Total daily water target in ml */
  waterMlTotal: number;
  /** Hypertrophy score of the most demanding exercise today (0 if none) */
  hypertrophyScore: number;
  /** Caloric offset applied due to primary goal (negative=deficit, positive=surplus, 0=maintenance) */
  goalAdjustmentKcal: number;
}

export interface MacroGrams {
  proteinG: number;
  carbsG: number;
  fatG: number;
}

/** Input for calculating calories burned by a single exercise */
export interface ExerciseCalcInput {
  met: number;
  weightKg: number;
  durationMinutes: number;
  hypertrophyScore: number;
}

/** Water reminder slot */
export interface WaterReminder {
  time: string; // HH:MM
  volumeMl: number;
}
