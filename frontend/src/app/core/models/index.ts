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

export type PrimaryGoal = 'emagrecimento' | 'ganho_massa' | 'manutencao' | 'saude_geral' | 'diabetico';

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
  primaryGoal?: PrimaryGoal;
  targetWeight?: number;
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
  goalAdjustmentKcal: number;
}

// ── Blood Test ────────────────────────────────────────────────────────────────
export interface BloodTest {
  id: string;
  userId: string;
  collectedAt: string;
  // 1. Metabolic
  glucoseMgDl?: number;
  insulinUiuMl?: number;
  hba1cPct?: number;
  // 2. Lipid
  cholesterolTotalMgDl?: number;
  ldlMgDl?: number;
  hdlMgDl?: number;
  triglyceridesMgDl?: number;
  // 3. Vitamins
  vitaminDNgMl?: number;
  vitaminB12PgMl?: number;
  ferritinNgMl?: number;
  // 4. Thyroid
  tshMiuL?: number;
  t3FreePgMl?: number;
  t4FreeNgDl?: number;
  // 5. Hormonal
  testosteroneTotalNgDl?: number;
  testosteroneFreeNgDl?: number;
  estradiolPgMl?: number;
  shbgNmolL?: number;
  prolactinNgMl?: number;
  dhtPgMl?: number;
  fshMuiMl?: number;
  lhMuiMl?: number;
  cortisolMcgDl?: number;
  // 6. Hepatic & Renal
  astUL?: number;
  altUL?: number;
  gamaGtUL?: number;
  creatinineMgDl?: number;
  ureaMgDl?: number;
  // 7. Inflammation
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

// ── Clinical Protocols ────────────────────────────────────────────────────────
export type ClinicalCategory = 'SUPLEMENTO'|'REMEDIO_CONTROLADO'|'TRT'|'HORMONIO_FEMININO'|'SONO';

export interface ClinicalProtocol {
  id: string;
  userId: string;
  name: string;
  category: ClinicalCategory;
  dosage: string;
  scheduledTime: string;
  daysOfWeek: number[];
  notes?: string;
  isActive: boolean;
}

export interface ClinicalProtocolLog {
  id: string;
  protocolId: string;
  takenDate: string;
  takenAt: string;
  xpAwarded: boolean;
}

export interface ClinicalProtocolWithLog extends ClinicalProtocol {
  log?: ClinicalProtocolLog;
}

export interface ProtocolToggleResult {
  taken: boolean;
  xpGained: number;
  totalXp: number;
}

// ── Routine ───────────────────────────────────────────────────────────────────
export type BlockType = 'sleep'|'work'|'exercise'|'meal'|'water'|'sun_exposure'|'free'|'custom'|'medication';
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
  /** ISO timestamp set when the user marks this block completed. */
  completedAt?: string;
  xpAwarded?: boolean;
}

export interface BlockCompleteResult {
  block: RoutineBlock;
  xpGained: number;
  totalXp: number;
  level: UserLevel;
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
  /** Kcal contributed specifically by consumed recipe-linked scheduled meals */
  scheduledRecipeKcal?: number;
  byMeal: Array<{ mealType: MealType; calories: number; protein: number; carbs: number; fat: number }>;
}

// ── Clinical ───────────────────────────────────────────────────────────────────
/** Full blood-test snapshot — all panels (mirrors backend BloodTest entity). */
export interface BloodTestFull {
  id: string;
  userId: string;
  collectedAt: string;
  // 1. Metabolic
  glucoseMgDl?: number;
  insulinUiuMl?: number;
  hba1cPct?: number;
  // 2. Lipid
  cholesterolTotalMgDl?: number;
  ldlMgDl?: number;
  hdlMgDl?: number;
  triglyceridesMgDl?: number;
  // 3. Vitamins
  vitaminDNgMl?: number;
  vitaminB12PgMl?: number;
  ferritinNgMl?: number;
  // 4. Thyroid
  tshMiuL?: number;
  t3FreePgMl?: number;
  t4FreeNgDl?: number;
  // 5. Hormonal
  testosteroneTotalNgDl?: number;
  testosteroneFreeNgDl?: number;
  estradiolPgMl?: number;
  shbgNmolL?: number;
  prolactinNgMl?: number;
  dhtPgMl?: number;
  fshMuiMl?: number;
  lhMuiMl?: number;
  cortisolMcgDl?: number;
  // 6. Hepatic & Renal
  astUL?: number;
  altUL?: number;
  gamaGtUL?: number;
  creatinineMgDl?: number;
  ureaMgDl?: number;
  // 7. Inflammation
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

/**
 * Immutable snapshot of a recipe linked to a scheduled meal.
 * Nutrition values are stored at link-time so edits to the recipe never
 * retroactively change historical consumption records.
 */
export interface LinkedRecipe {
  recipeId: string;
  title: string;
  kcalPerServing: number;
  proteinGPerServing: number;
  carbsGPerServing: number;
  fatGPerServing: number;
  servings: number;
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
  /** Recipes linked to this meal — single source of truth for recipe consumption */
  linkedRecipes?: LinkedRecipe[];
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

// ── Recipes (Community) ───────────────────────────────────────────────────────
export interface Recipe {
  id: string;
  authorId: string;
  title: string;
  description?: string;
  instructions: string;
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  servings: number;
  prepTimeMin?: number;
  isPublic: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  reviews?: RecipeReview[];
  /** Aggregated fields returned by the community feed endpoint */
  avgRating?: number;
  likeCount?: number;
}

export interface RecipeReview {
  id: string;
  recipeId: string;
  userId: string;
  rating: number;
  isLiked: boolean;
  comment?: string;
  createdAt: string;
}

export interface RecipeFeedItem extends Recipe {
  avgRating: number;
  likeCount: number;
  reviewCount: number;
  /** Whether the current user has already liked/reviewed */
  myReview?: RecipeReview;
}

// ── Recipe Schedules (weekly repetitions) ─────────────────────────────────────
/**
 * A user-defined rule: auto-link recipe X to meal Y on these days of the week.
 * Unique per (userId, mealName, recipeId).
 */
export interface RecipeSchedule {
  id: string;
  userId: string;
  mealName: string;
  recipeId: string;
  title: string;
  kcalPerServing: number;
  proteinGPerServing: number;
  carbsGPerServing: number;
  fatGPerServing: number;
  servings: number;
  /** 0=Sunday … 6=Saturday */
  daysOfWeek: number[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// ── Weekly Check-in ───────────────────────────────────────────────────────────
export interface WeeklyCheckIn {
  id: string;
  userId: string;
  date: string;
  currentWeight: number;
  waistCircumference?: number;
  /** 1–5 stars */
  adherenceScore: number;
  notes?: string;
  createdAt: string;
}

// ── Copilot ───────────────────────────────────────────────────────────────────
export type InsightType = 'warning' | 'success' | 'tip' | 'info';

export interface CopilotInsight {
  type: InsightType;
  title: string;
  message: string;
  action?: string;
}
