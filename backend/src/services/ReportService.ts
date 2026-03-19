import PDFDocument from "pdfkit";
import { AppDataSource } from "../config/typeorm.config";
import { User } from "../entities/User";
import { HealthProfile } from "../entities/HealthProfile";
import { ExerciseLog } from "../entities/ExerciseLog";
import { WorkoutSheet } from "../entities/WorkoutSheet";
import { BlockCompletion } from "../entities/BlockCompletion";
import { UserBadge } from "../entities/Badge";
import { BADGE_CATALOG } from "./BadgeService";

export class ReportService {
  /**
   * Generate a PDF progress report for a user.
   * Returns a readable stream (PDFDocument).
   */
  static async generateProgressReport(userId: string): Promise<PDFKit.PDFDocument> {
    const user = await AppDataSource.getRepository(User).findOne({
      where: { id: userId },
      relations: ["profile"],
    });
    const profile = await AppDataSource.getRepository(HealthProfile).findOneBy({ userId });
    const badges = await AppDataSource.getRepository(UserBadge).find({ where: { userId } });
    const sheets = await AppDataSource.getRepository(WorkoutSheet).find({
      where: { userId, isActive: true },
      relations: ["exercises"],
    });

    // Completions last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const completions30d = await AppDataSource.getRepository(BlockCompletion)
      .createQueryBuilder("bc")
      .where("bc.userId = :userId", { userId })
      .andWhere("bc.completionDate >= :from", { from: thirtyDaysAgo.toISOString().slice(0, 10) })
      .getCount();

    // Exercise logs last 30 days
    const recentLogs = await AppDataSource.getRepository(ExerciseLog)
      .createQueryBuilder("log")
      .where("log.userId = :userId", { userId })
      .andWhere("log.logDate >= :from", { from: thirtyDaysAgo.toISOString().slice(0, 10) })
      .orderBy("log.logDate", "DESC")
      .getMany();

    // Weight history (from metrics)
    const weightHistory: Array<{ date: string; weight: number }> = await AppDataSource.query(
      `SELECT "logDate" as date, weight FROM weight_logs WHERE "userId" = $1 ORDER BY "logDate" DESC LIMIT 10`,
      [userId]
    ).catch(() => []);

    // ── Build PDF ──────────────────────────────────────────────────────────────
    const doc = new PDFDocument({ size: "A4", margin: 50 });

    const primary = "#18B895";
    const dark = "#0d2329";
    const textColor = "#333333";

    // Header
    doc.rect(0, 0, doc.page.width, 100).fill(primary);
    doc.fillColor("#ffffff").fontSize(28).font("Helvetica-Bold")
      .text("AiraFit — Relatorio de Progresso", 50, 35);
    doc.fontSize(12).font("Helvetica")
      .text(`Gerado em ${new Date().toLocaleDateString("pt-BR")}`, 50, 70);

    doc.moveDown(3);

    // User Info
    doc.fillColor(dark).fontSize(18).font("Helvetica-Bold").text("Dados do Usuario");
    doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor(primary).lineWidth(1).stroke();
    doc.moveDown(0.5);

    doc.fillColor(textColor).fontSize(12).font("Helvetica");
    doc.text(`Nome: ${user?.name ?? "—"}`);
    if (profile) {
      doc.text(`Idade: ${profile.age ?? "—"} anos   |   Peso: ${profile.weight ?? "—"} kg   |   Altura: ${profile.height ?? "—"} cm`);
      doc.text(`Objetivo: ${this.translateGoal(profile.primaryGoal)}`);
      if (profile.caloricGoal) doc.text(`Meta calorica: ${profile.caloricGoal} kcal/dia`);
    }
    doc.text(`XP total: ${user?.xp ?? 0}`);

    doc.moveDown(1.5);

    // Badges
    doc.fillColor(dark).fontSize(18).font("Helvetica-Bold").text("Conquistas Desbloqueadas");
    doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor(primary).lineWidth(1).stroke();
    doc.moveDown(0.5);

    doc.fillColor(textColor).fontSize(11).font("Helvetica");
    if (badges.length === 0) {
      doc.text("Nenhuma conquista desbloqueada ainda.");
    } else {
      for (const b of badges) {
        const def = BADGE_CATALOG.find(d => d.slug === b.slug);
        if (def) {
          doc.text(`${def.emoji}  ${def.name} — ${def.description}  (${b.unlockedAt.toLocaleDateString("pt-BR")})`);
        }
      }
    }

    doc.moveDown(1.5);

    // Activity Summary
    doc.fillColor(dark).fontSize(18).font("Helvetica-Bold").text("Resumo dos Ultimos 30 Dias");
    doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor(primary).lineWidth(1).stroke();
    doc.moveDown(0.5);

    doc.fillColor(textColor).fontSize(12).font("Helvetica");
    doc.text(`Blocos completados: ${completions30d}`);
    doc.text(`Registros de exercicio: ${recentLogs.length}`);

    // Unique exercises
    const uniqueExercises = [...new Set(recentLogs.map(l => l.exerciseName))];
    doc.text(`Exercicios diferentes: ${uniqueExercises.length}`);

    doc.moveDown(1.5);

    // Workout Sheets
    doc.fillColor(dark).fontSize(18).font("Helvetica-Bold").text("Fichas de Treino Ativas");
    doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor(primary).lineWidth(1).stroke();
    doc.moveDown(0.5);

    doc.fillColor(textColor).fontSize(11).font("Helvetica");
    if (sheets.length === 0) {
      doc.text("Nenhuma ficha ativa.");
    } else {
      for (const s of sheets) {
        doc.font("Helvetica-Bold").text(`${s.name}${s.description ? " — " + s.description : ""}`);
        doc.font("Helvetica");
        const exes = (s.exercises ?? []).sort((a, b) => a.sortOrder - b.sortOrder);
        for (const e of exes) {
          doc.text(`   • ${e.name}: ${e.sets}x${e.reps} (descanso ${e.restSeconds}s)`, { indent: 20 });
        }
        doc.moveDown(0.5);
      }
    }

    // Exercise Progression (top 5 by log count)
    if (recentLogs.length > 0) {
      doc.moveDown(1);
      if (doc.y > 680) doc.addPage();

      doc.fillColor(dark).fontSize(18).font("Helvetica-Bold").text("Progressao de Exercicios");
      doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor(primary).lineWidth(1).stroke();
      doc.moveDown(0.5);

      // Group by exercise, show max weight progression
      const byExercise = new Map<string, ExerciseLog[]>();
      for (const log of recentLogs) {
        const arr = byExercise.get(log.exerciseName) ?? [];
        arr.push(log);
        byExercise.set(log.exerciseName, arr);
      }

      // Top 5 most logged exercises
      const sorted = [...byExercise.entries()]
        .sort((a, b) => b[1].length - a[1].length)
        .slice(0, 5);

      doc.fillColor(textColor).fontSize(11).font("Helvetica");
      for (const [name, logs] of sorted) {
        const maxW = Math.max(...logs.map(l => Number(l.weightKg)));
        const minW = Math.min(...logs.filter(l => Number(l.weightKg) > 0).map(l => Number(l.weightKg)));
        doc.font("Helvetica-Bold").text(`${name}  (${logs.length} registros)`);
        doc.font("Helvetica");
        if (maxW > 0) {
          doc.text(`   Carga: ${minW === maxW ? `${maxW} kg` : `${minW} → ${maxW} kg`}`, { indent: 20 });
        }
        doc.moveDown(0.3);
      }
    }

    // Weight History
    if (weightHistory.length > 0) {
      doc.moveDown(1);
      if (doc.y > 680) doc.addPage();

      doc.fillColor(dark).fontSize(18).font("Helvetica-Bold").text("Historico de Peso");
      doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor(primary).lineWidth(1).stroke();
      doc.moveDown(0.5);

      doc.fillColor(textColor).fontSize(11).font("Helvetica");
      for (const entry of weightHistory.slice(0, 10)) {
        doc.text(`${entry.date}  —  ${entry.weight} kg`);
      }
    }

    // Footer
    doc.moveDown(2);
    doc.fillColor("#999999").fontSize(9).font("Helvetica")
      .text("Este relatorio foi gerado automaticamente pelo AiraFit. Consulte sempre um profissional de saude.", 50, doc.y, { align: "center" });

    doc.end();
    return doc;
  }

  private static translateGoal(goal?: string | null): string {
    const map: Record<string, string> = {
      EMAGRECIMENTO: "Emagrecimento",
      GANHO_MASSA: "Ganho de massa muscular",
      MANUTENCAO: "Manutencao do peso",
      SAUDE_GERAL: "Saude geral",
      DIABETICO: "Controle diabetico",
    };
    return goal ? (map[goal] ?? goal) : "Nao definido";
  }
}
