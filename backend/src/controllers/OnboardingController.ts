import { Response, NextFunction } from "express";
import { AuthenticatedRequest } from "../middleware/auth.middleware";
import { OnboardingService, CompleteOnboardingDto } from "../services/OnboardingService";

export class OnboardingController {
  /**
   * POST /onboarding/complete
   * Body: { wakeUpTime, sleepTime, preferredTrainTime, meals }
   *
   * Generates the user's recurring base routine (sleep, activity, exercise,
   * and meal blocks) based on their onboarding choices.
   */
  static async complete(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const {
        wakeUpTime, sleepTime, preferredTrainTime, meals,
        waterReminders, waterIntervalMin,
        exercises, exerciseDaysOfWeek, exerciseDurationMin,
      } = req.body as CompleteOnboardingDto;

      if (!wakeUpTime || !sleepTime || !preferredTrainTime || !Array.isArray(meals) || meals.length === 0) {
        res.status(400).json({
          message: "Campos obrigatórios: wakeUpTime, sleepTime, preferredTrainTime, meals (array não vazio).",
        });
        return;
      }

      await OnboardingService.completeOnboarding(req.userId, {
        wakeUpTime,
        sleepTime,
        preferredTrainTime,
        meals,
        waterReminders: waterReminders === true,
        waterIntervalMin: waterIntervalMin ? Number(waterIntervalMin) : undefined,
        exercises,
        exerciseDaysOfWeek,
        exerciseDurationMin: exerciseDurationMin ? Number(exerciseDurationMin) : undefined,
      });

      res.status(201).json({ message: "Rotina base criada com sucesso." });
    } catch (err) {
      next(err);
    }
  }
}
