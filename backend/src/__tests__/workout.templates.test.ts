// Mock TypeORM to avoid import.meta issue in typeorm.config.ts
jest.mock('../config/typeorm.config', () => ({
  AppDataSource: { getRepository: jest.fn() },
}));

import { WORKOUT_TEMPLATES } from '../controllers/WorkoutController';

describe('Workout Templates', () => {
  it('should have at least 10 templates', () => {
    expect(WORKOUT_TEMPLATES.length).toBeGreaterThanOrEqual(10);
  });

  it('should have unique slugs', () => {
    const slugs = WORKOUT_TEMPLATES.map(t => t.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it('should have non-empty name, description, and category', () => {
    WORKOUT_TEMPLATES.forEach(t => {
      expect(t.name.length).toBeGreaterThan(0);
      expect(t.description.length).toBeGreaterThan(0);
      expect(t.category.length).toBeGreaterThan(0);
    });
  });

  it('should have at least 2 exercises per template', () => {
    WORKOUT_TEMPLATES.forEach(t => {
      expect(t.exercises.length).toBeGreaterThanOrEqual(2);
    });
  });

  it('should have valid exercise data (sets > 0, reps non-empty)', () => {
    WORKOUT_TEMPLATES.forEach(t => {
      t.exercises.forEach(e => {
        expect(e.name.length).toBeGreaterThan(0);
        expect(e.sets).toBeGreaterThan(0);
        expect(e.reps.length).toBeGreaterThan(0);
        expect(e.restSeconds).toBeGreaterThanOrEqual(0);
      });
    });
  });

  it('should have estimatedMinutes between 10 and 120', () => {
    WORKOUT_TEMPLATES.forEach(t => {
      expect(t.estimatedMinutes).toBeGreaterThanOrEqual(10);
      expect(t.estimatedMinutes).toBeLessThanOrEqual(120);
    });
  });
});
