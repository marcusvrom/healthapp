import { Response, NextFunction, Request } from "express";
import { AppDataSource } from "../config/typeorm.config";
import { Exercise, EXERCISE_PRESETS } from "../entities/Exercise";
import { HealthProfile } from "../entities/HealthProfile";
import { AuthenticatedRequest } from "../middleware/auth.middleware";

const exerciseRepo = () => AppDataSource.getRepository(Exercise);
const profileRepo = () => AppDataSource.getRepository(HealthProfile);

export class ExerciseController {
  /** GET /exercises/presets */
  static listPresets(_req: Request, res: Response): void {
    res.json(EXERCISE_PRESETS);
  }

  /** GET /exercises */
  static async list(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const profile = await profileRepo().findOneBy({ userId: req.userId });
      if (!profile) {
        res.json([]);
        return;
      }

      const exercises = await exerciseRepo().findBy({ healthProfileId: profile.id });
      res.json(exercises);
    } catch (err) {
      next(err);
    }
  }

  /** POST /exercises */
  static async create(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const profile = await profileRepo().findOneBy({ userId: req.userId });
      if (!profile) {
        res.status(400).json({ message: "Crie um perfil de saúde antes de cadastrar exercícios." });
        return;
      }

      const exercise = exerciseRepo().create({
        ...req.body,
        healthProfileId: profile.id,
      });
      const saved = await exerciseRepo().save(exercise);
      res.status(201).json(saved);
    } catch (err) {
      next(err);
    }
  }

  /** PATCH /exercises/:id */
  static async update(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const profile = await profileRepo().findOneBy({ userId: req.userId });
      if (!profile) {
        res.status(404).json({ message: "Perfil não encontrado." });
        return;
      }

      const exercise = await exerciseRepo().findOneBy({
        id: req.params["id"],
        healthProfileId: profile.id,
      });

      if (!exercise) {
        res.status(404).json({ message: "Exercício não encontrado." });
        return;
      }

      Object.assign(exercise, req.body);
      await exerciseRepo().save(exercise);
      res.json(exercise);
    } catch (err) {
      next(err);
    }
  }

  /** DELETE /exercises/:id */
  static async remove(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const profile = await profileRepo().findOneBy({ userId: req.userId });
      if (!profile) {
        res.status(404).json({ message: "Perfil não encontrado." });
        return;
      }

      const result = await exerciseRepo().delete({
        id: req.params["id"],
        healthProfileId: profile.id,
      });

      if (result.affected === 0) {
        res.status(404).json({ message: "Exercício não encontrado." });
        return;
      }

      res.status(204).send();
    } catch (err) {
      next(err);
    }
  }
}
