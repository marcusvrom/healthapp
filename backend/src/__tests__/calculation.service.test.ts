import { CalculationService } from '../services/CalculationService';
import { Gender, ActivityFactor, PrimaryGoal } from '../entities/HealthProfile';

describe('CalculationService', () => {
  // ── BMR tests ──────────────────────────────────────────────────────────────
  describe('calculateBMR', () => {
    it('should calculate BMR for a male using Mifflin-St Jeor', () => {
      // 80kg, 175cm, 30y, male: 10*80 + 6.25*175 - 5*30 + 5 = 800 + 1093.75 - 150 + 5 = 1748.75
      const bmr = CalculationService.calculateBMR(80, 175, 30, Gender.MALE);
      expect(bmr).toBe(1748.75);
    });

    it('should calculate BMR for a female', () => {
      // 60kg, 165cm, 25y, female: 10*60 + 6.25*165 - 5*25 - 161 = 600 + 1031.25 - 125 - 161 = 1345.25
      const bmr = CalculationService.calculateBMR(60, 165, 25, Gender.FEMALE);
      expect(bmr).toBe(1345.25);
    });

    it('should calculate BMR for gender OTHER as average of male/female constants', () => {
      // base = 10*70 + 6.25*170 - 5*28 = 700 + 1062.5 - 140 = 1622.5
      // OTHER: base + (5 + -161)/2 = 1622.5 - 78 = 1544.5
      const bmr = CalculationService.calculateBMR(70, 170, 28, Gender.OTHER);
      expect(bmr).toBe(1544.5);
    });

    it('should return positive BMR for reasonable inputs', () => {
      const bmr = CalculationService.calculateBMR(50, 150, 60, Gender.FEMALE);
      expect(bmr).toBeGreaterThan(0);
    });
  });

  // ── TEE tests ──────────────────────────────────────────────────────────────
  describe('calculateTEE', () => {
    it('should multiply BMR by sedentary factor (1.2)', () => {
      const tee = CalculationService.calculateTEE(1700, ActivityFactor.SEDENTARY);
      expect(tee).toBe(2040);
    });

    it('should multiply BMR by very active factor (1.725)', () => {
      const tee = CalculationService.calculateTEE(1700, ActivityFactor.VERY_ACTIVE);
      expect(tee).toBe(2932.5);
    });

    it('should multiply BMR by extra active factor (1.9)', () => {
      const tee = CalculationService.calculateTEE(1500, ActivityFactor.EXTRA_ACTIVE);
      expect(tee).toBe(2850);
    });
  });

  // ── Exercise calories ──────────────────────────────────────────────────────
  describe('calculateExerciseCalories', () => {
    it('should calculate MET-based calorie expenditure', () => {
      // MET=6, 80kg, 60min: 6 * 80 * 1 = 480
      const kcal = CalculationService.calculateExerciseCalories({
        met: 6, weightKg: 80, durationMinutes: 60, hypertrophyScore: 0,
      });
      expect(kcal).toBe(480);
    });

    it('should handle 30 min duration correctly', () => {
      // MET=8, 70kg, 30min: 8 * 70 * 0.5 = 280
      const kcal = CalculationService.calculateExerciseCalories({
        met: 8, weightKg: 70, durationMinutes: 30, hypertrophyScore: 5,
      });
      expect(kcal).toBe(280);
    });
  });

  // ── Water calculation ──────────────────────────────────────────────────────
  describe('calculateDailyWater', () => {
    it('should compute 35ml per kg', () => {
      expect(CalculationService.calculateDailyWater(70)).toBe(2450);
      expect(CalculationService.calculateDailyWater(80)).toBe(2800);
    });
  });

  // ── Water reminders ────────────────────────────────────────────────────────
  describe('distributeWaterReminders', () => {
    it('should distribute water evenly across day slots', () => {
      const reminders = CalculationService.distributeWaterReminders(2400, '07:00', '23:00', 60);
      expect(reminders.length).toBeGreaterThan(0);
      const totalMl = reminders.reduce((s, r) => s + r.volumeMl, 0);
      expect(totalMl).toBe(2400);
    });

    it('should start 15 min after wakeup', () => {
      const reminders = CalculationService.distributeWaterReminders(2000, '06:00', '22:00', 60);
      expect(reminders[0].time).toBe('06:15');
    });

    it('should return single block for edge case where sleep <= wakeup', () => {
      const reminders = CalculationService.distributeWaterReminders(2000, '22:00', '22:30', 60);
      expect(reminders.length).toBe(1);
      expect(reminders[0].volumeMl).toBe(2000);
    });
  });

  // ── Time utilities ─────────────────────────────────────────────────────────
  describe('timeToMinutes / minutesToTime', () => {
    it('should convert time string to minutes', () => {
      expect(CalculationService.timeToMinutes('00:00')).toBe(0);
      expect(CalculationService.timeToMinutes('07:30')).toBe(450);
      expect(CalculationService.timeToMinutes('23:59')).toBe(1439);
    });

    it('should convert minutes to time string', () => {
      expect(CalculationService.minutesToTime(0)).toBe('00:00');
      expect(CalculationService.minutesToTime(450)).toBe('07:30');
      expect(CalculationService.minutesToTime(1439)).toBe('23:59');
    });

    it('should handle overflow past midnight', () => {
      expect(CalculationService.minutesToTime(1500)).toBe('01:00');
    });
  });

  // ── resolveWeightBase ──────────────────────────────────────────────────────
  describe('resolveWeightBase', () => {
    it('should return target weight when provided', () => {
      expect(CalculationService.resolveWeightBase(100, 175, 75)).toBe(75);
    });

    it('should return actual weight when BMI <= 25', () => {
      // 70kg, 175cm: BMI = 70 / (1.75^2) = 22.86 → use actual
      expect(CalculationService.resolveWeightBase(70, 175)).toBe(70);
    });

    it('should return PCA when BMI > 25', () => {
      // 100kg, 175cm: BMI = 100 / 3.0625 = 32.65 → overweight
      // PI = 25 * 1.75^2 = 76.5625
      // PCA = 76.5625 + 0.25 * (100 - 76.5625) = 76.5625 + 5.859375 = 82.421875 → 82.42
      const result = CalculationService.resolveWeightBase(100, 175);
      expect(result).toBeCloseTo(82.42, 1);
    });
  });

  // ── Full metabolic result ──────────────────────────────────────────────────
  describe('computeMetabolicResult', () => {
    it('should return a complete metabolic result with all fields', () => {
      const result = CalculationService.computeMetabolicResult(
        80, 175, 30, Gender.MALE, ActivityFactor.MODERATELY_ACTIVE
      );
      expect(result.bmr).toBeGreaterThan(0);
      expect(result.tee).toBeGreaterThan(result.bmr);
      expect(result.macros.proteinG).toBeGreaterThan(0);
      expect(result.macros.carbsG).toBeGreaterThan(0);
      expect(result.macros.fatG).toBeGreaterThan(0);
      expect(result.waterMlTotal).toBe(2800); // 80 * 35
      expect(result.exerciseCalories).toBe(0);
    });

    it('should apply goal caloric adjustment for emagrecimento (-500)', () => {
      const maintenance = CalculationService.computeMetabolicResult(
        80, 175, 30, Gender.MALE, ActivityFactor.MODERATELY_ACTIVE
      );
      const cutting = CalculationService.computeMetabolicResult(
        80, 175, 30, Gender.MALE, ActivityFactor.MODERATELY_ACTIVE,
        [], PrimaryGoal.EMAGRECIMENTO
      );
      expect(cutting.dailyCaloricTarget).toBe(maintenance.dailyCaloricTarget - 500);
    });

    it('should apply goal caloric adjustment for ganho_massa (+400)', () => {
      const maintenance = CalculationService.computeMetabolicResult(
        80, 175, 30, Gender.MALE, ActivityFactor.MODERATELY_ACTIVE
      );
      const bulking = CalculationService.computeMetabolicResult(
        80, 175, 30, Gender.MALE, ActivityFactor.MODERATELY_ACTIVE,
        [], PrimaryGoal.GANHO_MASSA
      );
      expect(bulking.dailyCaloricTarget).toBe(maintenance.dailyCaloricTarget + 400);
    });
  });

  // ── Goal labels ────────────────────────────────────────────────────────────
  describe('getGoalLabel', () => {
    it('should return human-readable label', () => {
      expect(CalculationService.getGoalLabel(PrimaryGoal.EMAGRECIMENTO)).toBe('Emagrecimento');
      expect(CalculationService.getGoalLabel(PrimaryGoal.DIABETICO)).toBe('Diabéticos');
    });
  });
});
