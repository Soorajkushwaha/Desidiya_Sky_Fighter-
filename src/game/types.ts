export type GameState = 'title' | 'playing' | 'paused' | 'gameover' | 'illumination';

export type MissionOutcome = 'none' | 'victory' | 'defeat';

export type PlanetId =
  | 'venus'
  | 'earth'
  | 'mars'
  | 'jupiter'
  | 'saturn'
  | 'uranus'
  | 'neptune'
  | 'sun';

export type WeaponId =
  | 'basic_laser'
  | 'double_laser'
  | 'triple_laser'
  | 'plasma_blaster'
  | 'homing_missiles'
  | 'mega_beam'
  | 'solar_flame'
  | 'galaxy_blast';

export type SpaceshipId =
  | 'tejas_diya'
  | 'garuda_solar'
  | 'vajra_astral'
  | 'surya_samrat';

export type EnemyType =
  | 'drone'
  | 'fast_attack'
  | 'heavy_armor'
  | 'laser_turret'
  | 'kamikaze'
  | 'stealth'
  | 'battleship'
  | 'elite_darkness';

export type PowerUpType =
  | 'shield'
  | 'repair'
  | 'laser_upgrade'
  | 'missile_upgrade'
  | 'double_damage'
  | 'speed_boost'
  | 'mega_bomb'
  | 'invincibility'
  | 'extra_life'
  | 'ultimate_solar';

export type GraphicsQuality = 'low' | 'medium' | 'high';

export interface UpgradeStats {
  damage: number;          // Level 1..10
  fireRate: number;        // Level 1..10
  missileCapacity: number; // Level 1..10
  shieldStrength: number;  // Level 1..10
  engineSpeed: number;     // Level 1..10
  specialPower: number;    // Level 1..10
}

export interface PlanetConfig {
  id: PlanetId;
  order: number;
  name: string;
  subtitle: string;
  bossName: string;
  bossTitle: string;
  environmentDesc: string;
  hazardDesc: string;
  primaryColor: string;
  secondaryColor: string;
  atmosphereHex: number;
  surfaceHex: number;
  accentHex: number;
  fogHex: number;
  hasRings?: boolean;
  bossHp: number;
  recommendedPower: number;
  rewardCoins: number;
  rewardCrystals: number;
  rewardMaterials: number;
  enemyPool: EnemyType[];
}

export interface SpaceshipConfig {
  id: SpaceshipId;
  name: string;
  tagline: string;
  description: string;
  unlockCostCoins: number;
  unlockCostCrystals: number;
  unlockMaterials: number;
  baseHp: number;
  baseShield: number;
  baseSpeed: number;
  baseFirePower: number;
  primaryHex: number;
  trimHex: number;
  energyHex: number;
  startingWeapon: WeaponId;
}

export interface WeaponConfig {
  id: WeaponId;
  level: number; // 1..8
  name: string;
  description: string;
  fireInterval: number; // seconds
  baseDamage: number;
  projectileSpeed: number;
  colorHex: number;
  unlockCoins: number;
  unlockCrystals: number;
}

export interface ProjectileSpec {
  x: number;
  z: number;
  vx: number;
  vz: number;
  damage: number;
  radius: number;
  colorHex: number;
  weaponId: WeaponId;
  isHoming?: boolean;
  isBeam?: boolean;
  piercing?: boolean;
}

export interface EnemyEntity {
  id: number;
  type: EnemyType;
  x: number;
  z: number;
  vx: number;
  vz: number;
  hp: number;
  maxHp: number;
  radius: number;
  spawnTime: number;
  fireCooldown: number;
  telegraphTimer: number; // >0 when winding up a heavy attack
  hitFlash: number;
  phaseAngle: number;
  scoreValue: number;
  coinDrop: number;
  crystalChance: number;
  isStealthed?: boolean;
  koTimer: number; // >0 when defeated & toppling/exploding
}

export interface BossEntity {
  active: boolean;
  planetId: PlanetId;
  name: string;
  x: number;
  z: number;
  targetX: number;
  targetZ: number;
  hp: number;
  maxHp: number;
  phase: 1 | 2 | 3;
  radius: number;
  attackTimer: number;
  patternIndex: number;
  telegraphTimer: number;
  telegraphType: 'beam' | 'radial' | 'missiles' | 'solar_flare';
  hitFlash: number;
  introProgress: number; // 0..1 cinematic entrance
  defeatTimer: number;   // >0 during boss destruction sequence
  shieldHp: number;
  maxShieldHp: number;
}

export interface CollectibleEntity {
  id: number;
  kind: 'coin' | 'crystal' | 'material' | 'powerup';
  powerUpType?: PowerUpType;
  x: number;
  z: number;
  vx: number;
  vz: number;
  value: number;
  age: number;
}

export interface AsteroidEntity {
  id: number;
  x: number;
  z: number;
  vx: number;
  vz: number;
  radius: number;
  hp: number;
  maxHp: number;
  rotSpeedX: number;
  rotSpeedY: number;
  hitFlash: number;
}

export interface ActiveBuffs {
  doubleDamageTimer: number;
  speedBoostTimer: number;
  invincibilityTimer: number;
  ultimateSolarTimer: number;
}

export interface SaveData {
  coins: number;
  crystals: number;
  xp: number;
  materials: number;
  selectedShip: SpaceshipId;
  unlockedShips: SpaceshipId[];
  selectedWeapon: WeaponId;
  unlockedWeapons: WeaponId[];
  weaponLevel: number; // 1..8
  upgrades: UpgradeStats;
  unlockedPlanets: PlanetId[];
  illuminatedPlanets: PlanetId[];
  planetStars: Record<PlanetId, number>;
  planetBestScores: Record<PlanetId, number>;
  highScore: number;
  selectedPlanet: PlanetId;
  lastDailyRewardDate: string;
  dailyStreak: number;
  graphicsQuality: GraphicsQuality;
  soundEnabled: boolean;
  musicEnabled: boolean;
  autoFire: boolean;
}

export interface HudSnapshot {
  hp: number;
  maxHp: number;
  shield: number;
  maxShield: number;
  lives: number;
  score: number;
  highScore: number;
  coinsEarned: number;
  crystalsEarned: number;
  materialsEarned: number;
  weaponLevel: number;
  weaponName: string;
  weaponId: WeaponId;
  missiles: number;
  maxMissiles: number;
  missileCooldown: number;
  specialCharge: number; // 0..100 Diya Nova charge
  shieldSkillCooldown: number;
  planetId: PlanetId;
  planetName: string;
  wave: number;
  totalWaves: number;
  objectiveText: string;
  bossActive: boolean;
  bossName: string;
  bossHp: number;
  bossMaxHp: number;
  bossPhase: number;
  bossShieldHp: number;
  bossMaxShieldHp: number;
  activeBuffs: ActiveBuffs;
  enemiesDefeated: number;
  totalEnemiesSpawned: number;
  elapsedTime: number;
  announcement: string;
}
