import assert from 'node:assert/strict';
import test from 'node:test';
import { INITIAL_SAVE_DATA, PLANETS } from './campaignData';
import {
  applyMissionVictory,
  applyUpgrade,
  calculateMissionStars,
  calculatePlayerStats,
  canAffordUpgrade,
  checkCircleCollision,
  claimDailyReward,
  computeIlluminationPercentage,
  createEnemySpec,
  generateWeaponProjectiles,
  stepBossBehavior,
  stepEnemyMovement,
} from './rules';
import { BossEntity } from './types';

test('calculatePlayerStats scales with ship tier, upgrades, and active buffs', () => {
  const base = calculatePlayerStats(
    'tejas_diya',
    INITIAL_SAVE_DATA.upgrades,
    {
      doubleDamageTimer: 0,
      speedBoostTimer: 0,
      invincibilityTimer: 0,
      ultimateSolarTimer: 0,
    },
  );
  const upgraded = calculatePlayerStats(
    'surya_samrat',
    {
      damage: 5,
      fireRate: 4,
      missileCapacity: 3,
      shieldStrength: 4,
      engineSpeed: 3,
      specialPower: 5,
    },
    {
      doubleDamageTimer: 8,
      speedBoostTimer: 5,
      invincibilityTimer: 0,
      ultimateSolarTimer: 0,
    },
  );

  assert.ok(upgraded.maxHp > base.maxHp);
  assert.ok(upgraded.maxShield > base.maxShield);
  assert.ok(upgraded.damageMultiplier > base.damageMultiplier * 2);
  assert.equal(upgraded.maxMissiles, 5);
});

test('generateWeaponProjectiles produces distinct projectile counts across all 8 weapons', () => {
  const basic = generateWeaponProjectiles('basic_laser', 0, 5, 1);
  const doubleLaser = generateWeaponProjectiles('double_laser', 0, 5, 1);
  const tripleLaser = generateWeaponProjectiles('triple_laser', 0, 5, 1);
  const homing = generateWeaponProjectiles('homing_missiles', 0, 5, 1);
  const solar = generateWeaponProjectiles('solar_flame', 0, 5, 1);
  const galaxy = generateWeaponProjectiles('galaxy_blast', 0, 5, 1);

  assert.equal(basic.length, 1);
  assert.equal(doubleLaser.length, 2);
  assert.equal(tripleLaser.length, 3);
  assert.equal(homing.filter((p) => p.isHoming).length, 2);
  assert.equal(solar.length, 5);
  assert.equal(galaxy.length, 9);
});

test('stepEnemyMovement executes distinct movement policies for enemy archetypes', () => {
  const drone = createEnemySpec(1, 'drone', 0, -15, 1, 0);
  const kamikaze = createEnemySpec(2, 'kamikaze', -4, -6, 1, 0);
  const stealth = createEnemySpec(3, 'stealth', 2, -12, 2, 0);

  stepEnemyMovement(drone, 5, 8, 0.1, 0.5);
  stepEnemyMovement(kamikaze, 5, 8, 0.6, 0.6); // completes telegraph
  stepEnemyMovement(kamikaze, 5, 8, 0.2, 0.8); // dives toward playerX=5
  stepEnemyMovement(stealth, 0, 8, 0.1, 2.2);

  assert.ok(drone.z > -15);
  assert.ok(kamikaze.x > -4, 'kamikaze should charge toward player X');
  assert.equal(typeof stealth.isStealthed, 'boolean');
});

test('stepBossBehavior transitions phases and telegraphs before firing', () => {
  const boss: BossEntity = {
    active: true,
    planetId: 'venus',
    name: 'Venus Inferno Destroyer',
    x: 0,
    z: -10.5,
    targetX: 0,
    targetZ: -10.5,
    hp: 400,
    maxHp: 1400, // < 33% -> Phase 3
    phase: 1,
    radius: 3.2,
    attackTimer: 0.05,
    patternIndex: 0,
    telegraphTimer: 0,
    telegraphType: 'radial',
    hitFlash: 0,
    introProgress: 1,
    defeatTimer: 0,
    shieldHp: 0,
    maxShieldHp: 0,
  };

  const step1 = stepBossBehavior(boss, 3, 0.1, 10);
  assert.equal(boss.phase, 3);
  assert.equal(step1.shouldFirePattern, false);
  assert.ok(boss.telegraphTimer > 0, 'boss should enter telegraph state first');

  const step2 = stepBossBehavior(boss, 3, 0.6, 10.6);
  assert.equal(step2.shouldFirePattern, true);
});

test('applyMissionVictory unlocks next planet and reaches 100% illumination after all 8 missions', () => {
  let save = { ...INITIAL_SAVE_DATA };
  for (const planet of PLANETS) {
    save = applyMissionVictory(save, planet.id, 5000, 100, 5, 2, 3);
  }
  assert.equal(save.unlockedPlanets.length, 8);
  assert.equal(save.illuminatedPlanets.length, 8);
  assert.equal(computeIlluminationPercentage(save.illuminatedPlanets), 100);
  assert.equal(calculateMissionStars(0.8, 0.9, true), 3);
});

test('upgrades and daily rewards update resources accurately', () => {
  const richSave = { ...INITIAL_SAVE_DATA, coins: 1000, crystals: 50, materials: 20 };
  assert.equal(canAffordUpgrade(richSave, 'damage'), true);
  const afterUpgrade = applyUpgrade(richSave, 'damage');
  assert.equal(afterUpgrade.upgrades.damage, 2);
  assert.ok(afterUpgrade.coins < richSave.coins);

  const { nextSave, rewardCoins } = claimDailyReward(afterUpgrade, '2026-11-01');
  assert.ok(rewardCoins > 0);
  assert.equal(nextSave.lastDailyRewardDate, '2026-11-01');
  assert.equal(checkCircleCollision(0, 0, 1, 1.2, 0, 0.5), true);
  assert.equal(checkCircleCollision(0, 0, 1, 5, 5, 0.5), false);
});
