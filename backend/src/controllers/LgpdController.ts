import { Response, NextFunction } from "express";
import { AuthenticatedRequest } from "../middleware/auth.middleware";
import { LgpdService } from "../services/LgpdService";

export class LgpdController {
  /**
   * GET /lgpd/export — download all personal data as JSON (Art. 18, V)
   */
  static async exportData(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await LgpdService.exportUserData(req.userId);

      res.setHeader("Content-Type", "application/json");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="airafit-dados-pessoais-${new Date().toISOString().slice(0, 10)}.json"`
      );
      res.json(data);
    } catch (err) { next(err); }
  }

  /**
   * DELETE /lgpd/account — permanently delete user account and all data (Art. 18, VI)
   * Requires confirmation body: { confirm: "EXCLUIR MINHA CONTA" }
   */
  static async deleteAccount(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { confirm } = req.body as { confirm?: string };

      if (confirm !== "EXCLUIR MINHA CONTA") {
        res.status(400).json({
          message: "Para confirmar, envie { confirm: 'EXCLUIR MINHA CONTA' }",
        });
        return;
      }

      await LgpdService.deleteUserAccount(req.userId);

      // Clear auth cookie
      res.clearCookie("ha_token");
      res.json({ message: "Conta e todos os dados pessoais foram excluidos permanentemente." });
    } catch (err) { next(err); }
  }
}
