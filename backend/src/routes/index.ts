import { Router, Request, Response, NextFunction } from "express";
import { AuthController } from "../controllers/AuthController";
import { HealthProfileController } from "../controllers/HealthProfileController";
import { BloodTestController } from "../controllers/BloodTestController";
import { ExerciseController } from "../controllers/ExerciseController";
import { RoutineController } from "../controllers/RoutineController";
import { FoodController } from "../controllers/FoodController";
import { MealController } from "../controllers/MealController";
import { WaterController } from "../controllers/WaterController";
import { HormoneController } from "../controllers/HormoneController";
import { MetricsController } from "../controllers/MetricsController";
import { ClinicalController } from "../controllers/ClinicalController";
import { ScheduledMealController } from "../controllers/ScheduledMealController";
import { UserController } from "../controllers/UserController";
import { MedicationController } from "../controllers/MedicationController";
import { ClinicalProtocolController } from "../controllers/ClinicalProtocolController";
import { RecipeController } from "../controllers/RecipeController";
import { RecipeScheduleController } from "../controllers/RecipeScheduleController";
import { CheckInController } from "../controllers/CheckInController";
import { CopilotController } from "../controllers/CopilotController";
import { RankingController } from "../controllers/RankingController";
import { SocialController } from "../controllers/SocialController";
import { ChallengeController } from "../controllers/ChallengeController";
import { GroupController } from "../controllers/GroupController";
import { FriendshipController } from "../controllers/FriendshipController";
import { DailyMissionController } from "../controllers/DailyMissionController";
import { authMiddleware, AuthenticatedRequest } from "../middleware/auth.middleware";

const router = Router();

// ── Auth (public) ─────────────────────────────────────────────────────────────
router.post("/auth/register", AuthController.register);
router.post("/auth/login", AuthController.login);

// ── Helper to cast req for authenticated routes ────────────────────────────
type AuthHandler = (req: AuthenticatedRequest, res: Response, next: NextFunction) => Promise<void> | void;
function auth(handler: AuthHandler) {
  return [
    authMiddleware,
    (req: Request, res: Response, next: NextFunction) =>
      handler(req as AuthenticatedRequest, res, next),
  ];
}

// ── Health Profile ────────────────────────────────────────────────────────────
router.get("/profile", ...auth(HealthProfileController.get));
router.post("/profile", ...auth(HealthProfileController.upsert));
router.get("/profile/metabolic", ...auth(HealthProfileController.getMetabolicResult));

// ── Blood Tests ───────────────────────────────────────────────────────────────
router.get("/blood-tests", ...auth(BloodTestController.list));
router.post("/blood-tests", ...auth(BloodTestController.create));
router.get("/blood-tests/latest/analysis", ...auth(BloodTestController.latestAnalysis));

// ── Exercises ─────────────────────────────────────────────────────────────────
router.get("/exercises/presets", ExerciseController.listPresets);
router.get("/exercises", ...auth(ExerciseController.list));
router.post("/exercises", ...auth(ExerciseController.create));
router.patch("/exercises/:id", ...auth(ExerciseController.update));
router.delete("/exercises/:id", ...auth(ExerciseController.remove));

// ── Routine ───────────────────────────────────────────────────────────────────
router.get("/routine",                            ...auth(RoutineController.get));
router.post("/routine/generate",                  ...auth(RoutineController.generate));
router.patch("/routine/blocks/:id/complete",      ...auth(RoutineController.completeBlock));

// ── Foods (search is public; create requires auth) ────────────────────────────
router.get("/foods/search", FoodController.search);
router.get("/foods/barcode/:barcode", FoodController.byBarcode);
router.get("/foods/:id", FoodController.getOne);
router.post("/foods", ...auth(FoodController.create));

// ── Meals ─────────────────────────────────────────────────────────────────────
router.get("/meals", ...auth(MealController.list));
router.get("/meals/summary", ...auth(MealController.summary));
router.post("/meals", ...auth(MealController.create));
router.post("/meals/:id/foods", ...auth(MealController.addFoods));
router.patch("/meals/:mealId/foods/:mealFoodId", ...auth(MealController.updateFood));
router.delete("/meals/:mealId/foods/:mealFoodId", ...auth(MealController.removeFood));
router.delete("/meals/:id", ...auth(MealController.delete));

// ── Water Tracking ────────────────────────────────────────────────────────────
// NOTE: /water/today and /water/history must come before /water/:id
router.post("/water",           ...auth(WaterController.add));
router.get("/water/today",      ...auth(WaterController.today));
router.get("/water/history",    ...auth(WaterController.history));
router.delete("/water/:id",     ...auth(WaterController.remove));

// ── Hormone / Supplement Log ──────────────────────────────────────────────────
// NOTE: /hormones/latest must come before /hormones/:id
router.get("/hormones/latest",  ...auth(HormoneController.latest));
router.get("/hormones",         ...auth(HormoneController.list));
router.post("/hormones",        ...auth(HormoneController.log));
router.patch("/hormones/:id",   ...auth(HormoneController.update));
router.delete("/hormones/:id",  ...auth(HormoneController.remove));

// ── Metrics & Progress ────────────────────────────────────────────────────────
router.get("/metrics/weight",   ...auth(MetricsController.weightHistory));
router.post("/metrics/weight",  ...auth(MetricsController.logWeight));
router.get("/metrics/water",    ...auth(MetricsController.waterConsistency));
router.get("/metrics/streaks",  ...auth(MetricsController.streaks));

// ── Clinical Dashboard ────────────────────────────────────────────────────────
router.get("/clinical/history", ...auth(ClinicalController.history));

// ── Scheduled Meals ───────────────────────────────────────────────────────────
// NOTE: static sub-paths must come BEFORE parameterized routes
router.post("/scheduled-meals/generate",                        ...auth(ScheduledMealController.generate));
router.post("/scheduled-meals/clone",                           ...auth(ScheduledMealController.clone));
router.post("/scheduled-meals/apply-schedules",                 ...auth(ScheduledMealController.applySchedules));
router.get("/scheduled-meals",                                  ...auth(ScheduledMealController.list));
router.post("/scheduled-meals",                                 ...auth(ScheduledMealController.create));
router.patch("/scheduled-meals/:id/toggle",                     ...auth(ScheduledMealController.toggle));
router.post("/scheduled-meals/:id/link-recipe",                 ...auth(ScheduledMealController.linkRecipe));
router.delete("/scheduled-meals/:id/link-recipe/:recipeId",     ...auth(ScheduledMealController.unlinkRecipe));
router.delete("/scheduled-meals/:id",                           ...auth(ScheduledMealController.remove));

// ── Recipe Schedules (weekly repetition) ──────────────────────────────────────
router.get("/recipe-schedules",       ...auth(RecipeScheduleController.list));
router.post("/recipe-schedules",      ...auth(RecipeScheduleController.upsert));
router.delete("/recipe-schedules/:id",...auth(RecipeScheduleController.remove));

// ── User Profile & Avatar ─────────────────────────────────────────────────────
router.get("/users/me",     ...auth(UserController.me));
router.post("/users/avatar", authMiddleware, (req: Request, res: Response, next: NextFunction) =>
  UserController.uploadAvatar(req as AuthenticatedRequest, res, next));

// ── Medications & Supplements (legacy) ────────────────────────────────────────
router.get("/medications/logs",           ...auth(MedicationController.logs));
router.get("/medications",                ...auth(MedicationController.list));
router.post("/medications",               ...auth(MedicationController.create));
router.patch("/medications/:id",          ...auth(MedicationController.update));
router.patch("/medications/:id/toggle",   ...auth(MedicationController.toggle));
router.delete("/medications/:id",         ...auth(MedicationController.remove));

// ── Clinical Protocols (unified: meds, supplements, hormones) ─────────────────
// NOTE: /protocols/logs must come BEFORE /protocols/:id
router.get("/protocols/logs",             ...auth(ClinicalProtocolController.logs));
router.get("/protocols",                  ...auth(ClinicalProtocolController.list));
router.post("/protocols",                 ...auth(ClinicalProtocolController.create));
router.patch("/protocols/:id",            ...auth(ClinicalProtocolController.update));
router.patch("/protocols/:id/toggle",     ...auth(ClinicalProtocolController.toggle));
router.delete("/protocols/:id",           ...auth(ClinicalProtocolController.remove));

// ── Recipes (community) ────────────────────────────────────────────────────────
// NOTE: static sub-paths (/mine, /feed) must come BEFORE /recipes/:id
router.get("/recipes/mine",          ...auth(RecipeController.listMine));
router.get("/recipes/feed",          ...auth(RecipeController.feed));
router.get("/recipes/:id",           ...auth(RecipeController.findOne));
router.post("/recipes",              ...auth(RecipeController.create));
router.patch("/recipes/:id",         ...auth(RecipeController.update));
router.delete("/recipes/:id",        ...auth(RecipeController.remove));
router.post("/recipes/:id/import",   ...auth(RecipeController.importRecipe));
router.post("/recipes/:id/review",   ...auth(RecipeController.review));
router.patch("/recipes/:id/like",    ...auth(RecipeController.toggleLike));

// ── Weekly Check-ins ─────────────────────────────────────────────────────────
// NOTE: static paths (/latest, /adherence) must come BEFORE /check-ins/:id
router.get("/check-ins/latest",    ...auth(CheckInController.latest));
router.get("/check-ins/adherence", ...auth(CheckInController.adherence));
router.get("/check-ins",        ...auth(CheckInController.list));
router.post("/check-ins",       ...auth(CheckInController.create));
router.delete("/check-ins/:id", ...auth(CheckInController.remove));

// ── Copilot Insights ──────────────────────────────────────────────────────────
router.get("/copilot/insights", ...auth(CopilotController.insights));

// ── Gamification (ranking + daily caps) ───────────────────────────────────────
router.get("/gamification/ranking", ...auth(RankingController.weekly));
router.get("/gamification/caps",    ...auth(RankingController.caps));

// ── Social feed ───────────────────────────────────────────────────────────────
// NOTE: /social/posts/mine must come BEFORE /social/posts/:id
router.get("/social/feed",                    ...auth(SocialController.feed));
router.get("/social/posts/mine",              ...auth(SocialController.myPosts));
router.delete("/social/posts/:id",            ...auth(SocialController.deletePost));
router.post("/social/posts/:id/like",         ...auth(SocialController.toggleLike));
router.get("/social/posts/:id/comments",      ...auth(SocialController.listComments));
router.post("/social/posts/:id/comments",     ...auth(SocialController.addComment));
router.delete("/social/comments/:id",         ...auth(SocialController.deleteComment));

// ── Challenges ────────────────────────────────────────────────────────────────
router.get("/challenges",              ...auth(ChallengeController.list));
router.post("/challenges/:id/join",    ...auth(ChallengeController.join));
router.post("/challenges/:id/check",   ...auth(ChallengeController.check));

// ── Groups ────────────────────────────────────────────────────────────────────
router.get("/groups",                  ...auth(GroupController.myGroups));
router.post("/groups",                 ...auth(GroupController.create));
router.post("/groups/join/:code",      ...auth(GroupController.joinByCode));
router.get("/groups/:id",              ...auth(GroupController.detail));
router.delete("/groups/:id/leave",     ...auth(GroupController.leave));

// ── Friendships ───────────────────────────────────────────────────────────────
// NOTE: static sub-paths (/pending, /search) must come BEFORE /friends/:id
router.get("/friends/pending",         ...auth(FriendshipController.pending));
router.get("/friends/search",          ...auth(FriendshipController.search));
router.get("/friends",                 ...auth(FriendshipController.list));
router.post("/friends/request",        ...auth(FriendshipController.sendRequest));
router.patch("/friends/:id/accept",    ...auth(FriendshipController.accept));
router.patch("/friends/:id/decline",   ...auth(FriendshipController.decline));
router.delete("/friends/:id",          ...auth(FriendshipController.remove));

// ── Daily Missions ────────────────────────────────────────────────────────────
router.get("/missions/today",          ...auth(DailyMissionController.today));
router.post("/missions/:id/complete",  ...auth(DailyMissionController.complete));

export default router;
