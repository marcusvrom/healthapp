import { AppDataSource } from "../config/typeorm.config";
import { WeeklyCheckIn } from "../entities/WeeklyCheckIn";
import { HealthProfile, PrimaryGoal } from "../entities/HealthProfile";

export interface CopilotInsight {
  type: "warning" | "success" | "tip" | "info";
  title: string;
  message: string;
  action?: string;
}

function checkInRepo() {
  return AppDataSource.getRepository(WeeklyCheckIn);
}

function profileRepo() {
  return AppDataSource.getRepository(HealthProfile);
}

export class CopilotService {
  /**
   * Returns personalised insights for a user based on their recent check-ins
   * and health profile. The stagnation rule is the centrepiece:
   *
   *  • Weight-loss goal + 2 consecutive high-adherence (≥ 4) check-ins
   *    where weight didn't drop  →  suggest reducing calories or adding exercise.
   *
   * The service also provides positive reinforcement, trend summaries, and
   * reminders when no recent check-in exists.
   */
  static async getInsights(userId: string): Promise<CopilotInsight[]> {
    const insights: CopilotInsight[] = [];

    // Fetch last 4 check-ins for the user, newest first
    const checkIns = await checkInRepo().find({
      where: { userId },
      order: { date: "DESC" },
      take: 4,
    });

    const profile = await profileRepo().findOne({ where: { userId } });

    // ── No check-ins yet ─────────────────────────────────────────────────────
    if (checkIns.length === 0) {
      insights.push({
        type: "info",
        title: "Sem check-ins registrados",
        message:
          "Faça seu primeiro check-in semanal para que o Copiloto possa analisar sua evolução e oferecer recomendações personalizadas.",
        action: "Fazer Check-in Agora",
      });
      return insights;
    }

    const latest = checkIns[0]!;

    // ── Check-in overdue (> 8 days since last) ────────────────────────────────
    const daysSinceLast = CopilotService.daysBetween(
      latest.date,
      new Date().toISOString().slice(0, 10)
    );
    if (daysSinceLast >= 8) {
      insights.push({
        type: "warning",
        title: "Check-in em atraso!",
        message: `Seu último check-in foi há ${daysSinceLast} dias. Registre seu peso agora para manter o acompanhamento preciso.`,
        action: "Fazer Check-in",
      });
    }

    // ── Stagnation detection (requires at least 2 check-ins) ─────────────────
    if (checkIns.length >= 2) {
      const prev = checkIns[1]!;
      const isWeightLossGoal =
        !profile || profile.primaryGoal === PrimaryGoal.EMAGRECIMENTO;

      const bothHighAdherence =
        latest.adherenceScore >= 4 && prev.adherenceScore >= 4;
      const weightDropped =
        Number(latest.currentWeight) < Number(prev.currentWeight) - 0.2;

      if (isWeightLossGoal && bothHighAdherence && !weightDropped) {
        const weightDiff =
          Number(latest.currentWeight) - Number(prev.currentWeight);
        const diffText =
          weightDiff === 0
            ? "manteve o mesmo peso"
            : `ganhou ${weightDiff.toFixed(1)} kg`;

        insights.push({
          type: "warning",
          title: "Adaptação Metabólica Detectada",
          message: `Você seguiu o plano com alta adesão nas últimas 2 semanas (${prev.adherenceScore}★ e ${latest.adherenceScore}★), mas ${diffText}. Isso é sinal de adaptação metabólica — seu corpo se ajustou à ingestão calórica atual.`,
          action: "Ver Sugestões",
        });

        // Sub-recommendations
        insights.push({
          type: "tip",
          title: "Sugestão: Reduza ~100 kcal do GET",
          message:
            "Tente reduzir sua ingestão calórica diária em 100 kcal por 2 semanas. Isso geralmente é suficiente para retomar o déficit sem comprometer massa muscular.",
        });

        insights.push({
          type: "tip",
          title: "Sugestão: Adicionar gasto calórico",
          message:
            "Inclua 20-30 min de cardio moderado (caminhada rápida, bike, elíptico) em 2 dias adicionais por semana para aumentar o gasto calórico sem alterar a dieta.",
        });
      }
    }

    // ── Positive: streak of good adherence ────────────────────────────────────
    if (checkIns.length >= 3) {
      const highAdherenceCount = checkIns
        .slice(0, 3)
        .filter((c) => c.adherenceScore >= 4).length;
      if (highAdherenceCount === 3) {
        insights.push({
          type: "success",
          title: "Consistência Exemplar!",
          message:
            "Você manteve alta adesão ao plano por 3 semanas consecutivas. Essa consistência é o maior diferencial para resultados duradouros.",
        });
      }
    }

    // ── Positive reinforcement for weight progress ────────────────────────────
    if (checkIns.length >= 2) {
      const first = checkIns[checkIns.length - 1]!;
      const totalDelta = Number(latest.currentWeight) - Number(first.currentWeight);
      const goal = profile?.primaryGoal;

      if (goal === PrimaryGoal.EMAGRECIMENTO && totalDelta < -0.5) {
        insights.push({
          type: "success",
          title: `Você perdeu ${Math.abs(totalDelta).toFixed(1)} kg!`,
          message: `Desde o seu primeiro check-in você evoluiu ${Math.abs(totalDelta).toFixed(1)} kg em direção ao seu objetivo. Continue assim!`,
        });
      } else if (goal === PrimaryGoal.GANHO_MASSA && totalDelta > 0.5) {
        insights.push({
          type: "success",
          title: `Ganho de ${totalDelta.toFixed(1)} kg registrado!`,
          message: `Você avançou ${totalDelta.toFixed(1)} kg no seu processo de ganho de massa. Monitore a qualidade do ganho com circunferência abdominal.`,
        });
      }
    }

    // ── Adherence drop alert ───────────────────────────────────────────────────
    if (checkIns.length >= 2) {
      const prev = checkIns[1]!;
      const adherenceDrop =
        prev.adherenceScore - latest.adherenceScore;
      if (adherenceDrop >= 2) {
        insights.push({
          type: "warning",
          title: "Queda de Adesão",
          message: `Sua adesão caiu de ${prev.adherenceScore}★ para ${latest.adherenceScore}★. Revise possíveis obstáculos: restrições muito rígidas, rotina sobrecarregada ou falta de variedade nas refeições.`,
        });
      }
    }

    // ── Default positive message when no issues found ─────────────────────────
    if (insights.length === 0 || insights.every((i) => i.type !== "warning")) {
      if (latest.adherenceScore >= 4) {
        insights.push({
          type: "success",
          title: "Tudo nos conformes!",
          message: `Último check-in com ${latest.adherenceScore}★ de adesão. Continue seguindo o plano e registre seu próximo check-in em 7 dias.`,
        });
      } else {
        insights.push({
          type: "tip",
          title: "Dica de Consistência",
          message:
            "Tente preparar suas refeições com antecedência (meal prep) para facilitar a adesão ao plano nos dias mais corridos.",
        });
      }
    }

    return insights;
  }

  private static daysBetween(a: string, b: string): number {
    const msPerDay = 1000 * 60 * 60 * 24;
    return Math.floor(
      (new Date(b).getTime() - new Date(a).getTime()) / msPerDay
    );
  }
}
