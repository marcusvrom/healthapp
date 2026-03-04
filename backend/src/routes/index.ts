import { Router, Request, Response, NextFunction } from "express";
import { AuthController } from "../controllers/AuthController";
import { HealthProfileController } from "../controllers/HealthProfileController";
import { BloodTestController } from "../controllers/BloodTestController";
import { ExerciseController } from "../controllers/ExerciseController";
import { RoutineController } from "../controllers/RoutineController";
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
router.get("/routine", ...auth(RoutineController.get));
router.post("/routine/generate", ...auth(RoutineController.generate));

export default router;
