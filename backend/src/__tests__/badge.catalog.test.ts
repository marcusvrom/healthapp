// Mock TypeORM to avoid import.meta issue in typeorm.config.ts
jest.mock('../config/typeorm.config', () => ({
  AppDataSource: { getRepository: jest.fn() },
}));

import { BADGE_CATALOG } from '../services/BadgeService';

describe('Badge Catalog', () => {
  it('should have 22 badge definitions', () => {
    expect(BADGE_CATALOG.length).toBe(22);
  });

  it('should have unique slugs', () => {
    const slugs = BADGE_CATALOG.map(b => b.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it('should have valid tiers only (bronze, silver, gold)', () => {
    const validTiers = ['bronze', 'silver', 'gold'];
    BADGE_CATALOG.forEach(b => {
      expect(validTiers).toContain(b.tier);
    });
  });

  it('should have valid categories', () => {
    const validCategories = ['milestone', 'streak', 'social', 'nutrition', 'workout', 'special'];
    BADGE_CATALOG.forEach(b => {
      expect(validCategories).toContain(b.category);
    });
  });

  it('should have non-empty name, description, and emoji for all badges', () => {
    BADGE_CATALOG.forEach(b => {
      expect(b.name.length).toBeGreaterThan(0);
      expect(b.description.length).toBeGreaterThan(0);
      expect(b.emoji.length).toBeGreaterThan(0);
    });
  });

  it('should have badges in all 6 categories', () => {
    const categories = new Set(BADGE_CATALOG.map(b => b.category));
    expect(categories.size).toBe(6);
  });

  it('should have at least one gold badge', () => {
    const goldBadges = BADGE_CATALOG.filter(b => b.tier === 'gold');
    expect(goldBadges.length).toBeGreaterThanOrEqual(1);
  });

  it('should have milestone badges for first-time activities', () => {
    const milestones = BADGE_CATALOG.filter(b => b.category === 'milestone');
    expect(milestones.length).toBeGreaterThanOrEqual(3);
    expect(milestones.some(b => b.slug === 'first-workout')).toBe(true);
    expect(milestones.some(b => b.slug === 'first-week')).toBe(true);
  });
});
