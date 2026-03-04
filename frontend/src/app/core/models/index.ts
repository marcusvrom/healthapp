// ── Auth ──────────────────────────────────────────────────────────────────────
export interface AuthResponse { token: string; userId: string; }

// ── Current User (from /users/me) ─────────────────────────────────────────────
export interface UserLevel { level: number; title: string; nextLevelXp: number; }
export interface CurrentUser {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  xp: number;
  level: UserLevel;
}

// ── User / Profile ────────────────────────────────────────────────────────────
export type Gender = 'male' | 'female' | 'other';
export type ActivityFactor =
  | 'sedentary' | 'lightly_active' | 'moderately_active'
  | 'very_active' | 'extra_active';

export interface HealthProfile {
  id: string;
  userId: string;
  age: number;
  weight: number;
  height: number;
  gender: Gender;
  activityFactor: ActivityFactor;
  wakeUpTime: string;
  sleepTime: string;
  workStartTime: string;
  workEndTime: string;
  caloricGoal?: number;
  proteinGoalG?: number;
  carbsGoalG?: number;
  fatGoalG?: number;
  exercises?: Exercise[];
}

// ── Metabolic ─────────────────────────────────────────────────────────────────
export interface MacroGrams { proteinG: number; carbsG: number; fatG: number; }
export interface MetabolicResult {
  bmr: number;
  tee: number;
  exerciseCalories: number;
  dailyCaloricTarget: number;
  macros: MacroGrams;
  waterMlTotal: number;
  hypertrophyScore: number;
}

// ── Blood Test ────────────────────────────────────────────────────────────────
export interface BloodTest {
  id: string;
  userId: string;
  collectedAt: string;
  glucoseMgDl?: number;
  insulinUiuMl?: number;
  hba1cPct?: number;
  cholesterolTotalMgDl?: number;
  ldlMgDl?: number;
  hdlMgDl?: number;
  triglyceridesMgDl?: number;
  vitaminDNgMl?: number;
  vitaminB12PgMl?: number;
  ferritinNgMl?: number;
  tshMiuL?: number;
  crpMgL?: number;
  notes?: string;
  computedAdjustments?: BloodTestAnalysis;
}

export interface BloodTestAnalysis {
  adjustedMacros: MacroGrams;
  recommendations: Recommendation[];
  requiresSunExposureBlock: boolean;
  prioritiseAerobic: boolean;
}

export interface Recommendation {
  category: string;
  message: string;
  severity: 'info' | 'warning' | 'critical';
}

// ── Exercise ──────────────────────────────────────────────────────────────────
export type ExerciseCategory = 'strength' | 'cardio' | 'flexibility' | 'mind_body' | 'sports';

export interface Exercise {
  id: string;
  healthProfileId: string;
  name: string;
  category: ExerciseCategory;
  met: number;
  hypertrophyScore: number;
  durationMinutes: number;
  preferredTime?: string;
  daysOfWeek: number[];
}

export interface ExercisePreset {
  name: string;
  category: ExerciseCategory;
  met: number;
  hypertrophyScore: number;
}

// ── Routine ───────────────────────────────────────────────────────────────────
export type BlockType = 'sleep'|'work'|'exercise'|'meal'|'water'|'sun_exposure'|'free'|'custom';
export type MealType =
  | 'breakfast'|'morning_snack'|'lunch'|'afternoon_snack'
  | 'pre_workout'|'post_workout'|'dinner'|'supper';

export interface RoutineBlock {
  id: string;
  userId: string;
  routineDate: string;
  type: BlockType;
  startTime: string;
  endTime: string;
  label: string;
  mealType?: MealType;
  caloricTarget?: number;
  waterMl?: number;
  metadata?: Record<string, unknown>;
  sortOrder: number;
}

// ── Food ──────────────────────────────────────────────────────────────────────
export type FoodSource = 'TACO' | 'TBCA' | 'OpenFoodFacts' | 'UserCustom';

export interface Food {
  id: string;
  name: string;
  householdMeasure?: string;
  gramsReference?: number;
  calories: number;
  carbs: number;
  protein: number;
  fat: number;
  fiber?: number;
  sodium?: number;
  source: FoodSource;
  barcode?: string;
}

// ── Meal ──────────────────────────────────────────────────────────────────────
export interface MealFood {
  id: string;
  mealId: string;
  foodId: string;
  quantityG: number;
  food: Food;
  computedCalories: number;
  computedProtein: number;
  computedCarbs: number;
  computedFat: number;
  computedFiber: number;
}

export interface Meal {
  id: string;
  userId: string;
  mealDate: string;
  mealType: MealType;
  notes?: string;
  mealFoods: MealFood[];
  totalCalories: number;
  totalProtein: number;
  totalCarbs: number;
  totalFat: number;
  totalFiber: number;
}

export interface DailySummary {
  totalCalories: number;
  totalProtein: number;
  totalCarbs: number;
  totalFat: number;
  totalFiber: number;
  byMeal: Array<{ mealType: MealType; calories: number; protein: number; carbs: number; fat: number }>;
}

// ── Clinical ───────────────────────────────────────────────────────────────────
export interface BloodTestFull {
  id: string;
  userId: string;
  collectedAt: string;
  glucoseMgDl?: number;
  insulinUiuMl?: number;
  hba1cPct?: number;
  cholesterolTotalMgDl?: number;
  ldlMgDl?: number;
  hdlMgDl?: number;
  triglyceridesMgDl?: number;
  vitaminDNgMl?: number;
  vitaminB12PgMl?: number;
  ferritinNgMl?: number;
  testosteroneTotalNgDl?: number;
  estradiolPgMl?: number;
  tshMiuL?: number;
  crpMgL?: number;
  notes?: string;
}

export interface HormoneLog {
  id: string;
  userId: string;
  category: 'TRT' | 'Female_Hormones' | 'Sleep' | 'Other';
  name: string;
  dosage: number;
  unit: string;
  administeredAt: string;
  notes?: string;
}

export interface ClinicalHistory {
  bloodTests: BloodTestFull[];
  hormoneLogs: HormoneLog[];
}

// ── Scheduled Meals ───────────────────────────────────────────────────────────
export interface ScheduledFoodItem {
  name: string;
  quantityG: number;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

export interface ScheduledMeal {
  id: string;
  userId: string;
  scheduledDate: string;
  name: string;
  scheduledTime: string;
  caloricTarget?: number;
  proteinG?: number;
  carbsG?: number;
  fatG?: number;
  foods?: ScheduledFoodItem[];
  isConsumed: boolean;
  consumedAt?: string;
  xpAwarded: boolean;
  notes?: string;
}

export interface ToggleResult {
  meal: ScheduledMeal;
  xpGained: number;
  totalXp: number;
  level: UserLevel;
}
