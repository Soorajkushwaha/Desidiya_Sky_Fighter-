export type Difficulty = 'easy' | 'medium' | 'hard';

export interface DifficultyConfig {
  id: Difficulty;
  label: string;
  hint: string;
  enemyCountMul: number;
  enemyHpMul: number;
  enemySpeedMul: number;
  enemyFireCooldownMul: number; // >1 = fires less often
  enemyBulletSpeedMul: number;
  maxShooters: number;
  damageTakenMul: number;
  bossHpMul: number;
  lives: number;
  scoreMul: number;
}

export const DIFFICULTIES: Record<Difficulty, DifficultyConfig> = {
  easy: {
    id: 'easy', label: 'Easy', hint: 'Slower foes · 3 lives',
    enemyCountMul: 0.75, enemyHpMul: 0.7, enemySpeedMul: 0.8, enemyFireCooldownMul: 1.5,
    enemyBulletSpeedMul: 0.8, maxShooters: 2, damageTakenMul: 0.6, bossHpMul: 0.7, lives: 3, scoreMul: 0.8,
  },
  medium: {
    id: 'medium', label: 'Medium', hint: 'Balanced · 2 lives',
    enemyCountMul: 1, enemyHpMul: 1, enemySpeedMul: 1, enemyFireCooldownMul: 1,
    enemyBulletSpeedMul: 1, maxShooters: 4, damageTakenMul: 1, bossHpMul: 1, lives: 2, scoreMul: 1,
  },
  hard: {
    id: 'hard', label: 'Hard', hint: 'Swarms · 1 life · x1.5 score',
    enemyCountMul: 1.4, enemyHpMul: 1.4, enemySpeedMul: 1.25, enemyFireCooldownMul: 0.65,
    enemyBulletSpeedMul: 1.25, maxShooters: 6, damageTakenMul: 1.4, bossHpMul: 1.4, lives: 1, scoreMul: 1.5,
  },
};

const KEY = 'desidiya_sky_fighter_difficulty';

export function loadDifficulty(): Difficulty {
  try {
    const v = localStorage.getItem(KEY);
    if (v === 'easy' || v === 'medium' || v === 'hard') return v;
  } catch { /* ignore */ }
  return 'medium';
}

let current: Difficulty = typeof window !== 'undefined' ? loadDifficulty() : 'medium';

export function getDifficulty(): DifficultyConfig {
  return DIFFICULTIES[current];
}

export function setDifficulty(d: Difficulty) {
  current = d;
  try { localStorage.setItem(KEY, d); } catch { /* ignore */ }
}
