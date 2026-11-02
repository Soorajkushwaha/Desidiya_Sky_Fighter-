import {
  INITIAL_SAVE_DATA,
  PLANETS,
  SPACESHIP_MAP,
  WEAPON_MAP,
  WEAPONS,
} from './campaignData';
import {
  ActiveBuffs,
  BossEntity,
  EnemyEntity,
  EnemyType,
  PlanetId,
  ProjectileSpec,
  SaveData,
  SpaceshipId,
  UpgradeStats,
  WeaponId,
} from './types';

export const PLAYFIELD_BOUNDS = {
  minX: -14.5,
  maxX: 14.5,
  minZ: -17.0,
  maxZ: 12.5,
};

export interface ComputedPlayerStats {
  maxHp: number;
  maxShield: number;
  moveSpeed: number;
  damageMultiplier: number;
  fireIntervalMultiplier: number;
  maxMissiles: number;
  specialDamage: number;
}

export function calculatePlayerStats(
  shipId: SpaceshipId,
  upgrades: UpgradeStats,
  buffs: ActiveBuffs,
): ComputedPlayerStats {
  const ship = SPACESHIP_MAP[shipId] ?? SPACESHIP_MAP.tejas_diya;
  const maxHp = Math.round(ship.baseHp + (upgrades.shieldStrength - 1) * 18);
  const maxShield = Math.round(ship.baseShield + (upgrades.shieldStrength - 1) * 22);
  const speedBuff = buffs.speedBoostTimer > 0 || buffs.ultimateSolarTimer > 0 ? 1.32 : 1.0;
  const moveSpeed = (ship.baseSpeed + (upgrades.engineSpeed - 1) * 1.4) * speedBuff;

  const dmgBuff =
    (buffs.doubleDamageTimer > 0 ? 2.0 : 1.0) *
    (buffs.ultimateSolarTimer > 0 ? 1.65 : 1.0);
  const damageMultiplier =
    ship.baseFirePower * (1 + (upgrades.damage - 1) * 0.16) * dmgBuff;

  const fireRateBuff = buffs.ultimateSolarTimer > 0 ? 0.68 : 1.0;
  const fireIntervalMultiplier =
    Math.max(0.45, 1 - (upgrades.fireRate - 1) * 0.055) * fireRateBuff;

  const maxMissiles = 3 + (upgrades.missileCapacity - 1);
  const specialDamage = Math.round(280 + (upgrades.specialPower - 1) * 55);

  return {
    maxHp,
    maxShield,
    moveSpeed,
    damageMultiplier,
    fireIntervalMultiplier,
    maxMissiles,
    specialDamage,
  };
}

export function getWeaponByLevel(level: number): WeaponId {
  const clamped = Math.max(1, Math.min(8, Math.round(level)));
  const found = WEAPONS.find((w) => w.level === clamped);
  return found ? found.id : 'basic_laser';
}

export function generateWeaponProjectiles(
  weaponId: WeaponId,
  playerX: number,
  playerZ: number,
  damageMultiplier: number,
): ProjectileSpec[] {
  const cfg = WEAPON_MAP[weaponId] ?? WEAPON_MAP.basic_laser;
  const dmg = Math.max(1, Math.round(cfg.baseDamage * damageMultiplier));
  const spd = cfg.projectileSpeed;
  const z0 = playerZ - 1.5;

  switch (weaponId) {
    case 'basic_laser':
      return [
        {
          x: playerX,
          z: z0,
          vx: 0,
          vz: -spd,
          damage: dmg,
          radius: 0.42,
          colorHex: cfg.colorHex,
          weaponId,
        },
      ];

    case 'double_laser':
      return [
        {
          x: playerX - 0.65,
          z: z0,
          vx: 0,
          vz: -spd,
          damage: dmg,
          radius: 0.42,
          colorHex: cfg.colorHex,
          weaponId,
        },
        {
          x: playerX + 0.65,
          z: z0,
          vx: 0,
          vz: -spd,
          damage: dmg,
          radius: 0.42,
          colorHex: cfg.colorHex,
          weaponId,
        },
      ];

    case 'triple_laser':
      return [
        {
          x: playerX,
          z: z0 - 0.2,
          vx: 0,
          vz: -spd,
          damage: dmg,
          radius: 0.45,
          colorHex: cfg.colorHex,
          weaponId,
        },
        {
          x: playerX - 0.75,
          z: z0,
          vx: -6.5,
          vz: -spd * 0.98,
          damage: dmg,
          radius: 0.4,
          colorHex: cfg.colorHex,
          weaponId,
        },
        {
          x: playerX + 0.75,
          z: z0,
          vx: 6.5,
          vz: -spd * 0.98,
          damage: dmg,
          radius: 0.4,
          colorHex: cfg.colorHex,
          weaponId,
        },
      ];

    case 'plasma_blaster':
      return [
        {
          x: playerX - 0.55,
          z: z0,
          vx: -2.0,
          vz: -spd,
          damage: dmg,
          radius: 0.68,
          colorHex: cfg.colorHex,
          weaponId,
        },
        {
          x: playerX + 0.55,
          z: z0,
          vx: 2.0,
          vz: -spd,
          damage: dmg,
          radius: 0.68,
          colorHex: cfg.colorHex,
          weaponId,
        },
      ];

    case 'homing_missiles':
      return [
        {
          x: playerX - 0.5,
          z: z0,
          vx: 0,
          vz: -spd,
          damage: dmg,
          radius: 0.42,
          colorHex: 0x38bdf8,
          weaponId,
        },
        {
          x: playerX + 0.5,
          z: z0,
          vx: 0,
          vz: -spd,
          damage: dmg,
          radius: 0.42,
          colorHex: 0x38bdf8,
          weaponId,
        },
        {
          x: playerX - 1.1,
          z: z0 + 0.2,
          vx: -8,
          vz: -spd * 0.82,
          damage: Math.round(dmg * 1.35),
          radius: 0.55,
          colorHex: cfg.colorHex,
          weaponId,
          isHoming: true,
        },
        {
          x: playerX + 1.1,
          z: z0 + 0.2,
          vx: 8,
          vz: -spd * 0.82,
          damage: Math.round(dmg * 1.35),
          radius: 0.55,
          colorHex: cfg.colorHex,
          weaponId,
          isHoming: true,
        },
      ];

    case 'mega_beam':
      return [
        {
          x: playerX,
          z: z0 - 0.4,
          vx: 0,
          vz: -spd,
          damage: Math.round(dmg * 1.45),
          radius: 0.72,
          colorHex: cfg.colorHex,
          weaponId,
          isBeam: true,
          piercing: true,
        },
        {
          x: playerX - 0.85,
          z: z0,
          vx: -3,
          vz: -spd * 0.95,
          damage: Math.round(dmg * 0.85),
          radius: 0.42,
          colorHex: 0xfacc15,
          weaponId,
        },
        {
          x: playerX + 0.85,
          z: z0,
          vx: 3,
          vz: -spd * 0.95,
          damage: Math.round(dmg * 0.85),
          radius: 0.42,
          colorHex: 0xfacc15,
          weaponId,
        },
      ];

    case 'solar_flame': {
      const angles = [-0.28, -0.14, 0, 0.14, 0.28];
      return angles.map((ang, idx) => ({
        x: playerX + (idx - 2) * 0.42,
        z: z0,
        vx: Math.sin(ang) * spd,
        vz: -Math.cos(ang) * spd,
        damage: dmg,
        radius: idx === 2 ? 0.62 : 0.48,
        colorHex: idx % 2 === 0 ? 0xf59e0b : 0xfde047,
        weaponId,
      }));
    }

    case 'galaxy_blast': {
      const angles = [-0.33, -0.2, -0.09, 0, 0.09, 0.2, 0.33];
      const shots: ProjectileSpec[] = angles.map((ang, idx) => ({
        x: playerX + (idx - 3) * 0.35,
        z: z0,
        vx: Math.sin(ang) * spd,
        vz: -Math.cos(ang) * spd,
        damage: dmg,
        radius: idx === 3 ? 0.7 : 0.48,
        colorHex: idx === 3 ? 0xfffbeb : idx % 2 === 0 ? 0xfacc15 : 0x38bdf8,
        weaponId,
        piercing: idx === 3,
      }));
      shots.push(
        {
          x: playerX - 1.25,
          z: z0 + 0.2,
          vx: -10,
          vz: -spd * 0.85,
          damage: Math.round(dmg * 1.4),
          radius: 0.56,
          colorHex: 0xf97316,
          weaponId,
          isHoming: true,
        },
        {
          x: playerX + 1.25,
          z: z0 + 0.2,
          vx: 10,
          vz: -spd * 0.85,
          damage: Math.round(dmg * 1.4),
          radius: 0.56,
          colorHex: 0xf97316,
          weaponId,
          isHoming: true,
        },
      );
      return shots;
    }
  }
}

export function checkCircleCollision(
  ax: number,
  az: number,
  ar: number,
  bx: number,
  bz: number,
  br: number,
): boolean {
  const dx = ax - bx;
  const dz = az - bz;
  const rSum = ar + br;
  return dx * dx + dz * dz <= rSum * rSum;
}

export function createEnemySpec(
  id: number,
  type: EnemyType,
  x: number,
  z: number,
  planetOrder: number,
  elapsed: number,
): EnemyEntity {
  const scale = 1 + (planetOrder - 1) * 0.26;
  switch (type) {
    case 'drone':
      return {
        id,
        type,
        x,
        z,
        vx: 0,
        vz: 4.8,
        hp: Math.round(28 * scale),
        maxHp: Math.round(28 * scale),
        radius: 0.85,
        spawnTime: elapsed,
        fireCooldown: 1.6,
        telegraphTimer: 0,
        hitFlash: 0,
        phaseAngle: (id % 6) * 1.05,
        scoreValue: 80,
        coinDrop: 8,
        crystalChance: 0.1,
        koTimer: 0,
      };
    case 'fast_attack':
      return {
        id,
        type,
        x,
        z,
        vx: id % 2 === 0 ? 5.5 : -5.5,
        vz: 6.2,
        hp: Math.round(42 * scale),
        maxHp: Math.round(42 * scale),
        radius: 0.95,
        spawnTime: elapsed,
        fireCooldown: 1.25,
        telegraphTimer: 0,
        hitFlash: 0,
        phaseAngle: (id % 8) * 0.8,
        scoreValue: 130,
        coinDrop: 12,
        crystalChance: 0.15,
        koTimer: 0,
      };
    case 'heavy_armor':
      return {
        id,
        type,
        x,
        z,
        vx: 0,
        vz: 2.8,
        hp: Math.round(115 * scale),
        maxHp: Math.round(115 * scale),
        radius: 1.35,
        spawnTime: elapsed,
        fireCooldown: 1.8,
        telegraphTimer: 0,
        hitFlash: 0,
        phaseAngle: id * 0.5,
        scoreValue: 240,
        coinDrop: 22,
        crystalChance: 0.25,
        koTimer: 0,
      };
    case 'laser_turret':
      return {
        id,
        type,
        x,
        z,
        vx: 0,
        vz: 3.2,
        hp: Math.round(85 * scale),
        maxHp: Math.round(85 * scale),
        radius: 1.15,
        spawnTime: elapsed,
        fireCooldown: 2.1,
        telegraphTimer: 0,
        hitFlash: 0,
        phaseAngle: id * 1.2,
        scoreValue: 190,
        coinDrop: 18,
        crystalChance: 0.22,
        koTimer: 0,
      };
    case 'kamikaze':
      return {
        id,
        type,
        x,
        z,
        vx: 0,
        vz: 5.5,
        hp: Math.round(34 * scale),
        maxHp: Math.round(34 * scale),
        radius: 0.85,
        spawnTime: elapsed,
        fireCooldown: 99,
        telegraphTimer: 0.55,
        hitFlash: 0,
        phaseAngle: 0,
        scoreValue: 150,
        coinDrop: 14,
        crystalChance: 0.18,
        koTimer: 0,
      };
    case 'stealth':
      return {
        id,
        type,
        x,
        z,
        vx: 4.0,
        vz: 4.2,
        hp: Math.round(62 * scale),
        maxHp: Math.round(62 * scale),
        radius: 1.0,
        spawnTime: elapsed,
        fireCooldown: 1.5,
        telegraphTimer: 0,
        hitFlash: 0,
        phaseAngle: id * 0.9,
        scoreValue: 210,
        coinDrop: 20,
        crystalChance: 0.28,
        isStealthed: false,
        koTimer: 0,
      };
    case 'battleship':
      return {
        id,
        type,
        x,
        z,
        vx: 1.8,
        vz: 1.9,
        hp: Math.round(240 * scale),
        maxHp: Math.round(240 * scale),
        radius: 1.85,
        spawnTime: elapsed,
        fireCooldown: 1.6,
        telegraphTimer: 0,
        hitFlash: 0,
        phaseAngle: id * 0.4,
        scoreValue: 420,
        coinDrop: 40,
        crystalChance: 0.45,
        koTimer: 0,
      };
    case 'elite_darkness':
      return {
        id,
        type,
        x,
        z,
        vx: 5.0,
        vz: 4.4,
        hp: Math.round(135 * scale),
        maxHp: Math.round(135 * scale),
        radius: 1.2,
        spawnTime: elapsed,
        fireCooldown: 1.3,
        telegraphTimer: 0,
        hitFlash: 0,
        phaseAngle: id * 1.1,
        scoreValue: 320,
        coinDrop: 32,
        crystalChance: 0.38,
        koTimer: 0,
      };
  }
}

/**
 * Implements 8 distinct enemy movement policies as required by ultra-mode gameplay craft.
 */
export function stepEnemyMovement(
  enemy: EnemyEntity,
  playerX: number,
  playerZ: number,
  dt: number,
  elapsed: number,
): void {
  const age = elapsed - enemy.spawnTime;

  switch (enemy.type) {
    case 'drone': {
      // Policy 1: Formation harmonic sweep
      enemy.vx = Math.sin(age * 2.4 + enemy.phaseAngle) * 3.8;
      enemy.x += enemy.vx * dt;
      enemy.z += enemy.vz * dt;
      break;
    }
    case 'fast_attack': {
      // Policy 2: Wide high-frequency sine flanker
      enemy.vx = Math.cos(age * 3.8 + enemy.phaseAngle) * 7.5;
      enemy.x += enemy.vx * dt;
      enemy.z += enemy.vz * dt;
      break;
    }
    case 'heavy_armor': {
      // Policy 3: Slow advancing juggernaut that tracks player X slowly
      const dx = playerX - enemy.x;
      enemy.vx = Math.max(-2.6, Math.min(2.6, dx * 0.8));
      enemy.x += enemy.vx * dt;
      enemy.z += enemy.vz * dt;
      break;
    }
    case 'laser_turret': {
      // Policy 4: Area-denial turret that descends to mid-upper band (-9..-5) and hovers horizontally
      if (enemy.z < -6.5) {
        enemy.z += enemy.vz * dt;
      } else {
        enemy.z += enemy.vz * 0.25 * dt;
      }
      enemy.vx = Math.sin(age * 1.6 + enemy.phaseAngle) * 4.2;
      enemy.x += enemy.vx * dt;
      break;
    }
    case 'kamikaze': {
      // Policy 5: Line-of-Sight Charger with telegraph windup before high-speed dive
      if (enemy.z < -7.5) {
        enemy.z += enemy.vz * dt;
        enemy.vx = (playerX - enemy.x) * 1.8;
        enemy.x += enemy.vx * dt;
      } else if (enemy.telegraphTimer > 0) {
        // Hold & flash before diving
        enemy.telegraphTimer = Math.max(0, enemy.telegraphTimer - dt);
        const aimDx = playerX - enemy.x;
        const aimDz = Math.max(3, playerZ - enemy.z);
        const len = Math.hypot(aimDx, aimDz) || 1;
        enemy.vx = (aimDx / len) * 14.5;
        enemy.vz = (aimDz / len) * 14.5;
      } else {
        enemy.x += enemy.vx * dt;
        enemy.z += enemy.vz * dt;
      }
      break;
    }
    case 'stealth': {
      // Policy 6: Phase-cloaking sniper that alternates visibility and strafes
      const cycle = (age + enemy.phaseAngle) % 3.6;
      enemy.isStealthed = cycle > 1.8 && cycle < 3.0;
      enemy.vx = Math.cos(age * 2.8 + enemy.phaseAngle) * 6.2;
      enemy.x += enemy.vx * dt;
      enemy.z += enemy.vz * 0.85 * dt;
      break;
    }
    case 'battleship': {
      // Policy 7: Heavy broadside cruiser that patrols upper-mid screen before slow advance
      if (enemy.z < -8.0) {
        enemy.z += enemy.vz * dt;
      } else {
        enemy.z += enemy.vz * 0.35 * dt;
      }
      enemy.vx = Math.sin(age * 1.1 + enemy.phaseAngle) * 5.0;
      enemy.x += enemy.vx * dt;
      break;
    }
    case 'elite_darkness': {
      // Policy 8: Figure-eight void orbiter
      enemy.vx = Math.cos(age * 3.1 + enemy.phaseAngle) * 8.2;
      const vzMod = Math.sin(age * 6.2 + enemy.phaseAngle) * 2.4;
      enemy.x += enemy.vx * dt;
      enemy.z += (enemy.vz * 0.75 + vzMod) * dt;
      break;
    }
  }

  enemy.x = Math.max(PLAYFIELD_BOUNDS.minX + 1, Math.min(PLAYFIELD_BOUNDS.maxX - 1, enemy.x));
}

export function stepBossBehavior(
  boss: BossEntity,
  playerX: number,
  dt: number,
  elapsed: number,
): { shouldFirePattern: boolean; pattern: 'beam' | 'radial' | 'missiles' | 'solar_flare' } {
  if (!boss.active || boss.defeatTimer > 0) {
    return { shouldFirePattern: false, pattern: 'radial' };
  }

  // Advance intro entrance
  if (boss.introProgress < 1) {
    boss.introProgress = Math.min(1, boss.introProgress + dt * 0.65);
    boss.z = -24 + boss.introProgress * 13.5; // settles around z = -10.5
    return { shouldFirePattern: false, pattern: 'radial' };
  }

  // Determine Boss Phase from HP ratio
  const hpRatio = boss.hp / Math.max(1, boss.maxHp);
  if (hpRatio <= 0.33) {
    boss.phase = 3;
  } else if (hpRatio <= 0.66) {
    boss.phase = 2;
  } else {
    boss.phase = 1;
  }

  // Smooth lateral figure-8 / tracking patrol
  const speedMult = boss.phase === 3 ? 1.55 : boss.phase === 2 ? 1.25 : 1.0;
  const patrolX =
    Math.sin(elapsed * 1.15 * speedMult) * 7.5 +
    Math.cos(elapsed * 0.55) * 2.2 +
    (playerX - boss.x) * 0.15;
  boss.targetX = Math.max(-10.5, Math.min(10.5, patrolX));
  boss.targetZ = -10.5 + Math.sin(elapsed * 1.7) * 1.4;

  const damp = 1 - Math.exp(-3.5 * dt);
  boss.x += (boss.targetX - boss.x) * damp;
  boss.z += (boss.targetZ - boss.z) * damp;

  const patterns: Array<'beam' | 'radial' | 'missiles' | 'solar_flare'> =
    boss.planetId === 'sun'
      ? ['solar_flare', 'radial', 'beam', 'missiles']
      : ['radial', 'missiles', 'beam', 'solar_flare'];

  const currentPattern = patterns[boss.patternIndex % patterns.length];

  if (boss.telegraphTimer > 0) {
    boss.telegraphTimer -= dt;
    if (boss.telegraphTimer <= 0) {
      boss.telegraphTimer = 0;
      boss.patternIndex = (boss.patternIndex + 1) % patterns.length;
      const baseCooldown = boss.phase === 3 ? 1.45 : boss.phase === 2 ? 1.85 : 2.3;
      boss.attackTimer = baseCooldown;
      return { shouldFirePattern: true, pattern: boss.telegraphType };
    }
    return { shouldFirePattern: false, pattern: boss.telegraphType };
  }

  boss.attackTimer -= dt;
  if (boss.attackTimer <= 0) {
    boss.telegraphType = currentPattern;
    boss.telegraphTimer = 0.55; // Visible & audible telegraph windup before boss attack
  }

  return { shouldFirePattern: false, pattern: currentPattern };
}

export function calculateMissionStars(
  hpRatio: number,
  enemiesDefeatedRatio: number,
  bossDefeated: boolean,
): number {
  if (!bossDefeated) return 0;
  let stars = 1;
  if (enemiesDefeatedRatio >= 0.65 || hpRatio >= 0.45) stars += 1;
  if (hpRatio >= 0.6 && enemiesDefeatedRatio >= 0.75) stars += 1;
  return Math.min(3, stars);
}

export function computeIlluminationPercentage(illuminatedPlanets: PlanetId[]): number {
  const unique = new Set(illuminatedPlanets);
  return Math.min(100, Math.round((unique.size / PLANETS.length) * 100));
}

export function getUpgradeCost(
  statKey: keyof UpgradeStats,
  currentLevel: number,
): { coins: number; crystals: number; materials: number } {
  const baseCoins: Record<keyof UpgradeStats, number> = {
    damage: 140,
    fireRate: 130,
    missileCapacity: 150,
    shieldStrength: 120,
    engineSpeed: 110,
    specialPower: 160,
  };
  const mult = Math.pow(1.45, Math.max(0, currentLevel - 1));
  return {
    coins: Math.round(baseCoins[statKey] * mult),
    crystals: currentLevel >= 3 ? Math.round((currentLevel - 1) * 5) : 0,
    materials: currentLevel >= 4 ? Math.round((currentLevel - 2) * 3) : 0,
  };
}

export function canAffordUpgrade(save: SaveData, statKey: keyof UpgradeStats): boolean {
  const lvl = save.upgrades[statKey];
  if (lvl >= 10) return false;
  const cost = getUpgradeCost(statKey, lvl);
  return (
    save.coins >= cost.coins &&
    save.crystals >= cost.crystals &&
    save.materials >= cost.materials
  );
}

export function applyUpgrade(save: SaveData, statKey: keyof UpgradeStats): SaveData {
  if (!canAffordUpgrade(save, statKey)) return save;
  const lvl = save.upgrades[statKey];
  const cost = getUpgradeCost(statKey, lvl);
  return {
    ...save,
    coins: save.coins - cost.coins,
    crystals: save.crystals - cost.crystals,
    materials: save.materials - cost.materials,
    upgrades: {
      ...save.upgrades,
      [statKey]: lvl + 1,
    },
  };
}

export function applyMissionVictory(
  save: SaveData,
  planetId: PlanetId,
  score: number,
  coinsCollected: number,
  crystalsCollected: number,
  materialsCollected: number,
  stars: number,
): SaveData {
  const planetIndex = PLANETS.findIndex((p) => p.id === planetId);
  const planetCfg = PLANETS[planetIndex] ?? PLANETS[0];

  const unlockedSet = new Set<PlanetId>(save.unlockedPlanets);
  unlockedSet.add(planetId);
  if (planetIndex >= 0 && planetIndex + 1 < PLANETS.length) {
    unlockedSet.add(PLANETS[planetIndex + 1].id);
  }

  const illuminatedSet = new Set<PlanetId>(save.illuminatedPlanets);
  illuminatedSet.add(planetId);

  const prevStars = save.planetStars[planetId] ?? 0;
  const prevBest = save.planetBestScores[planetId] ?? 0;
  const totalMissionCoins = coinsCollected + planetCfg.rewardCoins;
  const totalMissionCrystals = crystalsCollected + planetCfg.rewardCrystals;
  const totalMissionMaterials = materialsCollected + planetCfg.rewardMaterials;
  const finalScore = score + planetCfg.rewardCoins * 5;

  return {
    ...save,
    coins: save.coins + totalMissionCoins,
    crystals: save.crystals + totalMissionCrystals,
    materials: save.materials + totalMissionMaterials,
    xp: save.xp + 250 * planetCfg.order,
    unlockedPlanets: PLANETS.map((p) => p.id).filter((id) => unlockedSet.has(id)),
    illuminatedPlanets: PLANETS.map((p) => p.id).filter((id) => illuminatedSet.has(id)),
    planetStars: {
      ...save.planetStars,
      [planetId]: Math.max(prevStars, stars),
    },
    planetBestScores: {
      ...save.planetBestScores,
      [planetId]: Math.max(prevBest, finalScore),
    },
    highScore: Math.max(save.highScore, finalScore),
  };
}

export function canClaimDailyReward(save: SaveData, todayIsoDate: string): boolean {
  return save.lastDailyRewardDate !== todayIsoDate;
}

export function claimDailyReward(
  save: SaveData,
  todayIsoDate: string,
): { nextSave: SaveData; rewardCoins: number; rewardCrystals: number } {
  if (!canClaimDailyReward(save, todayIsoDate)) {
    return { nextSave: save, rewardCoins: 0, rewardCrystals: 0 };
  }
  const nextStreak = (save.dailyStreak % 7) + 1;
  const rewardCoins = 200 + nextStreak * 75;
  const rewardCrystals = 8 + nextStreak * 3;
  return {
    nextSave: {
      ...save,
      coins: save.coins + rewardCoins,
      crystals: save.crystals + rewardCrystals,
      lastDailyRewardDate: todayIsoDate,
      dailyStreak: nextStreak,
    },
    rewardCoins,
    rewardCrystals,
  };
}

const STORAGE_KEY = 'desidiya_sky_fighter_save_v1';

export function loadSaveData(): SaveData {
  if (typeof window === 'undefined') return INITIAL_SAVE_DATA;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return INITIAL_SAVE_DATA;
    const parsed = JSON.parse(raw) as Partial<SaveData>;
    return {
      ...INITIAL_SAVE_DATA,
      ...parsed,
      upgrades: {
        ...INITIAL_SAVE_DATA.upgrades,
        ...(parsed.upgrades ?? {}),
      },
      planetStars: {
        ...INITIAL_SAVE_DATA.planetStars,
        ...(parsed.planetStars ?? {}),
      },
      planetBestScores: {
        ...INITIAL_SAVE_DATA.planetBestScores,
        ...(parsed.planetBestScores ?? {}),
      },
    };
  } catch {
    return INITIAL_SAVE_DATA;
  }
}

export function persistSaveData(save: SaveData): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(save));
  } catch {
    // ignore storage quota errors
  }
}
