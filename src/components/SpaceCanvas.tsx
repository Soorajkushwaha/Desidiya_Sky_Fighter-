import React, { useEffect, useImperativeHandle, useRef } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { soundEngine } from '../game/audio';
import {
  PLANET_MAP,
  PLANETS,
  POWERUP_INFO,
  WEAPON_MAP,
  WEAPONS,
} from '../game/campaignData';
import {
  buildBossMesh,
  buildCollectibleMesh,
  buildEnemyMesh,
  buildPlayerSpaceshipMesh,
  createHullPanelTexture,
  createPlanetSurfaceTexture,
} from '../game/models3d';
import {
  calculateMissionStars,
  calculatePlayerStats,
  checkCircleCollision,
  createEnemySpec,
  generateWeaponProjectiles,
  getWeaponByLevel,
  PLAYFIELD_BOUNDS,
  stepBossBehavior,
  stepEnemyMovement,
} from '../game/rules';
import {
  ActiveBuffs,
  AsteroidEntity,
  BossEntity,
  CollectibleEntity,
  EnemyEntity,
  GameState,
  HudSnapshot,
  MissionOutcome,
  PlanetId,
  PowerUpType,
  SaveData,
  WeaponId,
} from '../game/types';

export interface SpaceCanvasHandle {
  startMission: (planetId: PlanetId) => void;
  fireMissileVolley: () => void;
  triggerDiyaNova: () => void;
  activateEmergencyShield: () => void;
  cycleWeapon: () => void;
  triggerBossWaveNow: () => void;
}

interface SpaceCanvasProps {
  gameState: GameState;
  saveData: SaveData;
  illuminationProgress: number; // 0..100 when in illumination view
  onHudUpdate: (hud: HudSnapshot) => void;
  onMissionEnd: (
    outcome: MissionOutcome,
    stats: {
      planetId: PlanetId;
      score: number;
      coins: number;
      crystals: number;
      materials: number;
      stars: number;
      clearTime: number;
      enemiesDefeated: number;
      bossHpRemaining: number;
      waveReached: number;
    },
  ) => void;
  onTogglePause: () => void;
  onStartFromTitle: () => void;
}

interface ActiveProjectile {
  mesh: THREE.Mesh;
  x: number;
  z: number;
  vx: number;
  vz: number;
  damage: number;
  radius: number;
  isEnemy: boolean;
  isHoming?: boolean;
  piercing?: boolean;
  age: number;
}

const MAX_PARTICLES = 220;
const STAR_COUNT = 160;

// Pre-allocated scratch math objects outside render loop (zero GC)
const _dummyObj = new THREE.Object3D();
const _scratchColor = new THREE.Color();
const _rayPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const _raycaster = new THREE.Raycaster();
const _ndcVec = new THREE.Vector2();
const _intersectPt = new THREE.Vector3();

export const SpaceCanvas = React.forwardRef<SpaceCanvasHandle, SpaceCanvasProps>(
  (
    {
      gameState,
      saveData,
      illuminationProgress,
      onHudUpdate,
      onMissionEnd,
      onTogglePause,
      onStartFromTitle,
    },
    ref,
  ) => {
    const mountRef = useRef<HTMLDivElement | null>(null);

    // Refs to keep latest props accessible inside single WebGL loop
    const gameStateRef = useRef<GameState>(gameState);
    gameStateRef.current = gameState;

    const saveDataRef = useRef<SaveData>(saveData);
    saveDataRef.current = saveData;

    const illuminationRef = useRef<number>(illuminationProgress);
    illuminationRef.current = illuminationProgress;

    const callbacksRef = useRef({
      onHudUpdate,
      onMissionEnd,
      onTogglePause,
      onStartFromTitle,
    });
    callbacksRef.current = {
      onHudUpdate,
      onMissionEnd,
      onTogglePause,
      onStartFromTitle,
    };

    // Imperative trigger queue for mobile/HUD action buttons
    const actionsRef = useRef({
      startPlanet: null as PlanetId | null,
      fireMissile: false,
      triggerNova: false,
      activateShield: false,
      cycleWeapon: false,
      summonBoss: false,
    });

    useImperativeHandle(ref, () => ({
      startMission: (planetId: PlanetId) => {
        actionsRef.current.startPlanet = planetId;
      },
      fireMissileVolley: () => {
        actionsRef.current.fireMissile = true;
      },
      triggerDiyaNova: () => {
        actionsRef.current.triggerNova = true;
      },
      activateEmergencyShield: () => {
        actionsRef.current.activateShield = true;
      },
      cycleWeapon: () => {
        actionsRef.current.cycleWeapon = true;
      },
      triggerBossWaveNow: () => {
        actionsRef.current.summonBoss = true;
      },
    }));

    useEffect(() => {
      const container = mountRef.current;
      if (!container) return;

      // 1. Software WebGL detection from GPU renderer string
      const isSoftwareGl = (() => {
        const probeCanvas = document.createElement('canvas');
        const gl = probeCanvas.getContext('webgl2') || probeCanvas.getContext('webgl');
        if (!gl) return true;
        const ext = gl.getExtension('WEBGL_debug_renderer_info');
        const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
        const gpu = String(gl.getParameter(param));
        gl.getExtension('WEBGL_lose_context')?.loseContext();
        return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
      })();

      const quality = saveDataRef.current.graphicsQuality;
      const renderer = new THREE.WebGLRenderer({
        antialias: !isSoftwareGl && quality !== 'low',
        powerPreference: 'high-performance',
      });
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.12;
      const maxDpr = quality === 'low' ? 1 : quality === 'medium' ? 1.5 : 2;
      renderer.setPixelRatio(
        isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, maxDpr),
      );
      renderer.shadowMap.enabled = !isSoftwareGl && quality === 'high';
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;

      const initialRect = container.getBoundingClientRect();
      const initW = initialRect.width || window.innerWidth;
      const initH = initialRect.height || window.innerHeight;
      renderer.setSize(initW, initH);
      renderer.domElement.dataset.testid = 'space-webgl-canvas';
      renderer.domElement.style.display = 'block';
      renderer.domElement.style.width = '100%';
      renderer.domElement.style.height = '100%';
      container.innerHTML = '';
      container.appendChild(renderer.domElement);

      // WebGL context loss guard
      const onContextLost = (e: Event) => e.preventDefault();
      renderer.domElement.addEventListener('webglcontextlost', onContextLost);

      // 2. Scene, Studio Environment & Camera
      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0x050814);
      scene.fog = new THREE.FogExp2(0x050814, 0.012);

      const pmremGenerator = new THREE.PMREMGenerator(renderer);
      scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
      pmremGenerator.dispose();

      const camera = new THREE.PerspectiveCamera(48, initW / initH, 0.5, 220);
      camera.position.set(0, 26, 15);
      camera.lookAt(0, 0, -2);

      // 3-Point Warm/Cool Studio Lighting
      const hemiLight = new THREE.HemisphereLight(0x7dd3fc, 0x1e1b4b, 0.85);
      scene.add(hemiLight);

      const keyLight = new THREE.DirectionalLight(0xfffbeb, 2.2);
      keyLight.position.set(12, 28, 14);
      if (!isSoftwareGl) {
        keyLight.castShadow = true;
        keyLight.shadow.mapSize.set(1024, 1024);
        keyLight.shadow.camera.near = 5;
        keyLight.shadow.camera.far = 65;
        const d = 18;
        keyLight.shadow.camera.left = -d;
        keyLight.shadow.camera.right = d;
        keyLight.shadow.camera.top = d;
        keyLight.shadow.camera.bottom = -d;
        keyLight.shadow.bias = -0.0005;
      }
      scene.add(keyLight);

      const rimLight = new THREE.DirectionalLight(0xf59e0b, 1.35);
      rimLight.position.set(-14, 12, -18);
      scene.add(rimLight);

      const diyaPointLight = new THREE.PointLight(0xfacc15, 2.5, 18);
      diyaPointLight.position.set(0, 2.5, 5);
      scene.add(diyaPointLight);

      // Shared textures & geometries
      const hullBumpTex = createHullPanelTexture(renderer);
      const planetTexCache = new Map<PlanetId, THREE.CanvasTexture>();
      const getPlanetTex = (pid: PlanetId) => {
        if (!planetTexCache.has(pid)) {
          planetTexCache.set(pid, createPlanetSurfaceTexture(pid, renderer));
        }
        return planetTexCache.get(pid)!;
      };

      // 3. Background Starfield (InstancedMesh)
      const starGeo = new THREE.OctahedronGeometry(0.14, 0);
      const starMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
      const starField = new THREE.InstancedMesh(starGeo, starMat, STAR_COUNT);
      starField.frustumCulled = false;
      const starPositions = new Float32Array(STAR_COUNT * 3);
      const starSpeeds = new Float32Array(STAR_COUNT);
      for (let i = 0; i < STAR_COUNT; i++) {
        starPositions[i * 3] = (Math.random() - 0.5) * 48;
        starPositions[i * 3 + 1] = -4 - Math.random() * 14;
        starPositions[i * 3 + 2] = (Math.random() - 0.5) * 48;
        starSpeeds[i] = 6 + Math.random() * 14;
        const s = 0.6 + Math.random() * 1.4;
        _dummyObj.position.set(
          starPositions[i * 3],
          starPositions[i * 3 + 1],
          starPositions[i * 3 + 2],
        );
        _dummyObj.scale.setScalar(s);
        _dummyObj.updateMatrix();
        starField.setMatrixAt(i, _dummyObj.matrix);
        _scratchColor.setHex(
          i % 5 === 0 ? 0xfde047 : i % 3 === 0 ? 0x7dd3fc : 0xffffff,
        );
        starField.setColorAt(i, _scratchColor);
      }
      starField.instanceMatrix.needsUpdate = true;
      if (starField.instanceColor) starField.instanceColor.needsUpdate = true;
      scene.add(starField);

      // 4. Planetary Backdrop Sphere & Atmosphere Ring
      const planetBackdropGroup = new THREE.Group();
      planetBackdropGroup.position.set(0, -24, -18);
      scene.add(planetBackdropGroup);

      const planetSphereGeo = new THREE.SphereGeometry(16.5, 36, 28);
      const planetSphereMat = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        map: getPlanetTex('venus'),
        roughness: 0.75,
        metalness: 0.15,
      });
      const planetSphereMesh = new THREE.Mesh(planetSphereGeo, planetSphereMat);
      planetBackdropGroup.add(planetSphereMesh);

      const atmoGeo = new THREE.SphereGeometry(17.2, 32, 24);
      const atmoMat = new THREE.MeshBasicMaterial({
        color: 0xf59e0b,
        transparent: true,
        opacity: 0.18,
        side: THREE.BackSide,
      });
      const atmoMesh = new THREE.Mesh(atmoGeo, atmoMat);
      planetBackdropGroup.add(atmoMesh);

      const planetRingGeo = new THREE.RingGeometry(19.5, 26.5, 48);
      planetRingGeo.rotateX(Math.PI / 2.3);
      const planetRingMat = new THREE.MeshStandardMaterial({
        color: 0xfde68a,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.65,
        roughness: 0.4,
      });
      const planetRingMesh = new THREE.Mesh(planetRingGeo, planetRingMat);
      planetRingMesh.visible = false;
      planetBackdropGroup.add(planetRingMesh);

      // 5. 3D Solar System Illumination Diorama Group (visible during 'illumination' state)
      const solarSystemGroup = new THREE.Group();
      solarSystemGroup.visible = false;
      scene.add(solarSystemGroup);

      const sunCoreMesh = new THREE.Mesh(
        new THREE.SphereGeometry(3.2, 32, 24),
        new THREE.MeshStandardMaterial({
          color: 0xfacc15,
          emissive: 0xf59e0b,
          emissiveIntensity: 2.2,
          roughness: 0.2,
        }),
      );
      solarSystemGroup.add(sunCoreMesh);

      const dioramaPlanets: Array<{
        id: PlanetId;
        mesh: THREE.Mesh;
        halo: THREE.Mesh;
        orbitRadius: number;
        angle: number;
        speed: number;
      }> = [];

      PLANETS.filter((p) => p.id !== 'sun').forEach((p, idx) => {
        const orbitR = 5.2 + idx * 2.15;
        const orbitLineGeo = new THREE.RingGeometry(orbitR - 0.04, orbitR + 0.04, 64);
        orbitLineGeo.rotateX(-Math.PI / 2);
        const orbitLine = new THREE.Mesh(
          orbitLineGeo,
          new THREE.MeshBasicMaterial({
            color: 0xfde047,
            transparent: true,
            opacity: 0.22,
            side: THREE.DoubleSide,
          }),
        );
        solarSystemGroup.add(orbitLine);

        const pSize =
          p.id === 'jupiter' || p.id === 'saturn'
            ? 0.95
            : p.id === 'uranus' || p.id === 'neptune'
              ? 0.72
              : 0.56;
        const pMat = new THREE.MeshStandardMaterial({
          color: 0xffffff,
          map: getPlanetTex(p.id),
          emissive: p.atmosphereHex,
          emissiveIntensity: 0.1,
          roughness: 0.5,
        });
        const pMesh = new THREE.Mesh(new THREE.SphereGeometry(pSize, 20, 16), pMat);

        if (p.hasRings) {
          const rMesh = new THREE.Mesh(
            new THREE.RingGeometry(pSize * 1.35, pSize * 2.0, 24),
            new THREE.MeshBasicMaterial({
              color: p.accentHex,
              side: THREE.DoubleSide,
              transparent: true,
              opacity: 0.7,
            }),
          );
          rMesh.rotation.x = Math.PI / 2.4;
          pMesh.add(rMesh);
        }

        const haloMesh = new THREE.Mesh(
          new THREE.SphereGeometry(pSize * 1.45, 16, 12),
          new THREE.MeshBasicMaterial({
            color: p.atmosphereHex,
            transparent: true,
            opacity: 0.0,
          }),
        );
        pMesh.add(haloMesh);

        solarSystemGroup.add(pMesh);
        dioramaPlanets.push({
          id: p.id,
          mesh: pMesh,
          halo: haloMesh,
          orbitRadius: orbitR,
          angle: idx * 0.95,
          speed: 0.45 - idx * 0.04,
        });
      });

      // 6. Zero-GC Pooled Particle System (InstancedMesh)
      const particleGeo = new THREE.DodecahedronGeometry(0.22, 0);
      const particleMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
      const particleMesh = new THREE.InstancedMesh(
        particleGeo,
        particleMat,
        MAX_PARTICLES,
      );
      particleMesh.frustumCulled = false;
      scene.add(particleMesh);

      const partX = new Float32Array(MAX_PARTICLES);
      const partY = new Float32Array(MAX_PARTICLES);
      const partZ = new Float32Array(MAX_PARTICLES);
      const partVx = new Float32Array(MAX_PARTICLES);
      const partVy = new Float32Array(MAX_PARTICLES);
      const partVz = new Float32Array(MAX_PARTICLES);
      const partLife = new Float32Array(MAX_PARTICLES);
      const partMaxLife = new Float32Array(MAX_PARTICLES);
      const partScale = new Float32Array(MAX_PARTICLES);
      let particleCursor = 0;

      for (let i = 0; i < MAX_PARTICLES; i++) {
        _dummyObj.position.set(0, -999, 0);
        _dummyObj.scale.setScalar(0.001);
        _dummyObj.updateMatrix();
        particleMesh.setMatrixAt(i, _dummyObj.matrix);
      }
      particleMesh.instanceMatrix.needsUpdate = true;

      const spawnParticleBurst = (
        x: number,
        y: number,
        z: number,
        colorHex: number,
        count: number,
        speed = 9,
        scale = 1.0,
      ) => {
        const mult =
          saveDataRef.current.graphicsQuality === 'low'
            ? 0.5
            : saveDataRef.current.graphicsQuality === 'medium'
              ? 0.75
              : 1.0;
        const actualCount = Math.max(2, Math.round(count * mult));
        _scratchColor.setHex(colorHex);
        for (let i = 0; i < actualCount; i++) {
          const idx = particleCursor;
          particleCursor = (particleCursor + 1) % MAX_PARTICLES;
          const angle = Math.random() * Math.PI * 2;
          const spd = (0.3 + Math.random() * 0.7) * speed;
          partX[idx] = x;
          partY[idx] = y;
          partZ[idx] = z;
          partVx[idx] = Math.cos(angle) * spd;
          partVy[idx] = (Math.random() - 0.3) * spd * 0.6;
          partVz[idx] = Math.sin(angle) * spd;
          partMaxLife[idx] = 0.28 + Math.random() * 0.35;
          partLife[idx] = partMaxLife[idx];
          partScale[idx] = scale * (0.6 + Math.random() * 0.9);
          particleMesh.setColorAt(idx, _scratchColor);
        }
        if (particleMesh.instanceColor) particleMesh.instanceColor.needsUpdate = true;
      };

      // 7. Gameplay Actor Containers & State
      const worldActorsGroup = new THREE.Group();
      scene.add(worldActorsGroup);

      let currentBuiltShipId = saveDataRef.current.selectedShip;
      let playerRig = buildPlayerSpaceshipMesh(currentBuiltShipId, hullBumpTex);
      worldActorsGroup.add(playerRig.group);

      let playerX = 0;
      let playerZ = 8.5;
      let targetPlayerX = 0;
      let targetPlayerZ = 8.5;
      let playerVx = 0;
      let playerBankAngle = 0;
      let playerHitFlash = 0;

      let currentPlanetId: PlanetId = saveDataRef.current.selectedPlanet || 'venus';
      let currentWeaponId: WeaponId = saveDataRef.current.selectedWeapon || 'basic_laser';
      let weaponTierLevel = WEAPON_MAP[currentWeaponId]?.level ?? 1;

      let hp = 120;
      let maxHp = 120;
      let shield = 80;
      let maxShield = 80;
      let lives = 2;
      let score = 0;
      let coinsEarned = 0;
      let crystalsEarned = 0;
      let materialsEarned = 0;
      let missiles = 3;
      let maxMissiles = 3;
      let missileCooldown = 0;
      let specialCharge = 65; // Starts partially charged so player can test quickly
      let shieldSkillCooldown = 0;

      let wave = 1;
      const totalWaves = 5; // Waves 1-4 squadrons + Wave 5 Boss
      let waveTimer = 0;
      let enemiesDefeated = 0;
      let totalEnemiesSpawned = 0;
      let missionElapsed = 0;
      let fireTimer = 0;
      let asteroidTimer = 1.8;
      let hitstopTimer = 0;
      let cameraTrauma = 0;
      let announcement = '';
      let announcementTimer = 0;
      let outcomeTriggered = false;

      const activeBuffs: ActiveBuffs = {
        doubleDamageTimer: 0,
        speedBoostTimer: 0,
        invincibilityTimer: 0,
        ultimateSolarTimer: 0,
      };

      const activeProjectiles: ActiveProjectile[] = [];
      const activeEnemies: Array<{ entity: EnemyEntity; mesh: THREE.Group }> = [];
      const activeAsteroids: Array<{ entity: AsteroidEntity; mesh: THREE.Mesh }> = [];
      const activeCollectibles: Array<{
        entity: CollectibleEntity;
        mesh: THREE.Group;
      }> = [];

      let bossRig: {
        group: THREE.Group;
        coreMesh: THREE.Mesh;
        ringMesh: THREE.Mesh;
        shieldDome: THREE.Mesh;
      } | null = null;

      const bossEntity: BossEntity = {
        active: false,
        planetId: 'venus',
        name: 'Venus Inferno Destroyer',
        x: 0,
        z: -24,
        targetX: 0,
        targetZ: -10.5,
        hp: 1400,
        maxHp: 1400,
        phase: 1,
        radius: 3.1,
        attackTimer: 2.0,
        patternIndex: 0,
        telegraphTimer: 0,
        telegraphType: 'radial',
        hitFlash: 0,
        introProgress: 0,
        defeatTimer: 0,
        shieldHp: 0,
        maxShieldHp: 0,
      };

      const projectileGeo = new THREE.CapsuleGeometry(0.16, 0.75, 4, 8);
      projectileGeo.rotateX(Math.PI / 2);
      const enemyBulletGeo = new THREE.SphereGeometry(0.32, 8, 8);
      const asteroidGeo = new THREE.DodecahedronGeometry(1.0, 1);

      let nextEntityId = 1;

      const clearAllEntities = () => {
        activeProjectiles.forEach((p) => worldActorsGroup.remove(p.mesh));
        activeProjectiles.length = 0;

        activeEnemies.forEach((e) => worldActorsGroup.remove(e.mesh));
        activeEnemies.length = 0;

        activeAsteroids.forEach((a) => worldActorsGroup.remove(a.mesh));
        activeAsteroids.length = 0;

        activeCollectibles.forEach((c) => worldActorsGroup.remove(c.mesh));
        activeCollectibles.length = 0;

        if (bossRig) {
          worldActorsGroup.remove(bossRig.group);
          bossRig = null;
        }
        bossEntity.active = false;
      };

      const applyPlanetEnvironment = (pid: PlanetId) => {
        const pCfg = PLANET_MAP[pid] ?? PLANET_MAP.venus;
        scene.background = new THREE.Color(pCfg.fogHex);
        scene.fog = new THREE.FogExp2(pCfg.fogHex, 0.012);
        planetSphereMat.map = getPlanetTex(pid);
        planetSphereMat.needsUpdate = true;
        atmoMat.color.setHex(pCfg.atmosphereHex);
        planetRingMesh.visible = Boolean(pCfg.hasRings);
        planetRingMat.color.setHex(pCfg.accentHex);
        rimLight.color.setHex(pCfg.atmosphereHex);
      };

      const spawnEnemyWave = (waveNum: number, pid: PlanetId) => {
        const pCfg = PLANET_MAP[pid] ?? PLANET_MAP.venus;
        const pool = pCfg.enemyPool;
        const count = 4 + waveNum * 2;
        for (let i = 0; i < count; i++) {
          const etype = pool[(waveNum + i) % pool.length];
          const spreadX = ((i - (count - 1) / 2) / Math.max(1, count - 1)) * 18;
          const staggerZ = -18 - Math.abs(i - (count - 1) / 2) * 2.2 - (i % 2) * 1.5;
          const spec = createEnemySpec(
            nextEntityId++,
            etype,
            spreadX,
            staggerZ,
            pCfg.order,
            missionElapsed,
          );
          const mesh = buildEnemyMesh(etype);
          mesh.position.set(spec.x, 0, spec.z);
          worldActorsGroup.add(mesh);
          activeEnemies.push({ entity: spec, mesh });
          totalEnemiesSpawned++;
        }
        announcement = `WAVE ${waveNum} / ${totalWaves - 1} — ${pCfg.name} SECTOR`;
        announcementTimer = 2.4;
      };

      const spawnPlanetBoss = (pid: PlanetId) => {
        const pCfg = PLANET_MAP[pid] ?? PLANET_MAP.venus;
        if (bossRig) {
          worldActorsGroup.remove(bossRig.group);
        }
        bossRig = buildBossMesh(pid);
        bossRig.group.position.set(0, 0, -24);
        worldActorsGroup.add(bossRig.group);

        bossEntity.active = true;
        bossEntity.planetId = pid;
        bossEntity.name = pCfg.bossName;
        bossEntity.x = 0;
        bossEntity.z = -24;
        bossEntity.targetX = 0;
        bossEntity.targetZ = -10.5;
        bossEntity.hp = pCfg.bossHp;
        bossEntity.maxHp = pCfg.bossHp;
        bossEntity.phase = 1;
        bossEntity.attackTimer = 2.0;
        bossEntity.patternIndex = 0;
        bossEntity.telegraphTimer = 0;
        bossEntity.introProgress = 0;
        bossEntity.defeatTimer = 0;
        // Sun Boss and later bosses have an energy shield core
        bossEntity.maxShieldHp = pid === 'sun' ? 1800 : pCfg.order >= 4 ? 650 : 0;
        bossEntity.shieldHp = bossEntity.maxShieldHp;

        announcement = `WARNING: ${pCfg.bossName.toUpperCase()} APPROACHING!`;
        announcementTimer = 3.2;
        soundEngine.playBossWarning();
      };

      const resetAndStartMission = (pid: PlanetId) => {
        clearAllEntities();
        currentPlanetId = pid;
        applyPlanetEnvironment(pid);

        const save = saveDataRef.current;
        if (currentBuiltShipId !== save.selectedShip) {
          worldActorsGroup.remove(playerRig.group);
          currentBuiltShipId = save.selectedShip;
          playerRig = buildPlayerSpaceshipMesh(currentBuiltShipId, hullBumpTex);
          worldActorsGroup.add(playerRig.group);
        }

        currentWeaponId = save.selectedWeapon;
        weaponTierLevel = WEAPON_MAP[currentWeaponId]?.level ?? save.weaponLevel ?? 1;

        activeBuffs.doubleDamageTimer = 0;
        activeBuffs.speedBoostTimer = 0;
        activeBuffs.invincibilityTimer = 2.0; // Spawn protection
        activeBuffs.ultimateSolarTimer = 0;

        const stats = calculatePlayerStats(save.selectedShip, save.upgrades, activeBuffs);
        maxHp = stats.maxHp;
        hp = stats.maxHp;
        maxShield = stats.maxShield;
        shield = stats.maxShield;
        lives = 2;
        missiles = stats.maxMissiles;
        maxMissiles = stats.maxMissiles;
        missileCooldown = 0;
        specialCharge = 70;
        shieldSkillCooldown = 0;

        playerX = 0;
        playerZ = 8.5;
        targetPlayerX = 0;
        targetPlayerZ = 8.5;
        playerRig.group.position.set(playerX, 0, playerZ);
        playerRig.group.rotation.set(0, 0, 0);

        score = 0;
        coinsEarned = 0;
        crystalsEarned = 0;
        materialsEarned = 0;
        wave = 1;
        waveTimer = 0;
        enemiesDefeated = 0;
        totalEnemiesSpawned = 0;
        missionElapsed = 0;
        outcomeTriggered = false;

        spawnEnemyWave(1, pid);
        soundEngine.startPlanetMusic(pid);
      };

      // Initialize environment for initial planet
      applyPlanetEnvironment(currentPlanetId);

      // 8. Unified Input Handling (Keyboard + Touch/Mouse Drag)
      const keysPressed = new Set<string>();
      let pointerDragging = false;

      const screenToPlayfield = (clientX: number, clientY: number) => {
        const rect = renderer.domElement.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) return;
        _ndcVec.x = ((clientX - rect.left) / rect.width) * 2 - 1;
        _ndcVec.y = -((clientY - rect.top) / rect.height) * 2 + 1;
        _raycaster.setFromCamera(_ndcVec, camera);
        if (_raycaster.ray.intersectPlane(_rayPlane, _intersectPt)) {
          targetPlayerX = THREE.MathUtils.clamp(
            _intersectPt.x,
            PLAYFIELD_BOUNDS.minX,
            PLAYFIELD_BOUNDS.maxX,
          );
          targetPlayerZ = THREE.MathUtils.clamp(
            _intersectPt.z - 1.2, // slight forward offset so thumb doesn't cover ship
            PLAYFIELD_BOUNDS.minZ + 3,
            PLAYFIELD_BOUNDS.maxZ,
          );
        }
      };

      const onKeyDown = (e: KeyboardEvent) => {
        if (
          e.target instanceof HTMLInputElement ||
          e.target instanceof HTMLTextAreaElement
        ) {
          return;
        }
        const code = e.code;
        if (gameStateRef.current === 'title') {
          if (code === 'Enter' || code === 'Space') {
            e.preventDefault();
            callbacksRef.current.onStartFromTitle();
          }
          return;
        }

        if (code === 'Escape' || code === 'KeyP') {
          e.preventDefault();
          callbacksRef.current.onTogglePause();
          return;
        }

        if (gameStateRef.current !== 'playing') return;

        if (!keysPressed.has(code)) {
          // Edge-triggered one-shot abilities
          if (code === 'KeyX') {
            actionsRef.current.fireMissile = true;
          } else if (code === 'ShiftLeft' || code === 'ShiftRight' || code === 'KeyE') {
            actionsRef.current.triggerNova = true;
          } else if (code === 'KeyC') {
            actionsRef.current.activateShield = true;
          } else if (code === 'KeyQ') {
            actionsRef.current.cycleWeapon = true;
          }
        }
        keysPressed.add(code);
      };

      const onKeyUp = (e: KeyboardEvent) => {
        keysPressed.delete(e.code);
      };

      const onPointerDown = (e: PointerEvent) => {
        if (gameStateRef.current !== 'playing') return;
        pointerDragging = true;
        screenToPlayfield(e.clientX, e.clientY);
      };

      const onPointerMove = (e: PointerEvent) => {
        if (!pointerDragging || gameStateRef.current !== 'playing') return;
        screenToPlayfield(e.clientX, e.clientY);
      };

      const onPointerUp = () => {
        pointerDragging = false;
      };

      const onBlur = () => {
        keysPressed.clear();
        pointerDragging = false;
      };

      window.addEventListener('keydown', onKeyDown);
      window.addEventListener('keyup', onKeyUp);
      window.addEventListener('blur', onBlur);
      renderer.domElement.addEventListener('pointerdown', onPointerDown);
      window.addEventListener('pointermove', onPointerMove);
      window.addEventListener('pointerup', onPointerUp);

      // ResizeObserver for crisp responsive viewport
      const resizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const { width, height } = entry.contentRect;
          if (width > 0 && height > 0) {
            camera.aspect = width / height;
            camera.updateProjectionMatrix();
            renderer.setSize(width, height);
          }
        }
      });
      resizeObserver.observe(container);

      // Helper to spawn collectibles/powerups on enemy death
      const spawnDropsAt = (x: number, z: number, coinVal: number, crystalChance: number) => {
        const cMesh = buildCollectibleMesh('coin');
        cMesh.position.set(x - 0.35, 0, z);
        worldActorsGroup.add(cMesh);
        activeCollectibles.push({
          entity: {
            id: nextEntityId++,
            kind: 'coin',
            x: x - 0.35,
            z,
            vx: (Math.random() - 0.5) * 2.5,
            vz: 3.6,
            value: coinVal,
            age: 0,
          },
          mesh: cMesh,
        });

        if (Math.random() < crystalChance) {
          const crMesh = buildCollectibleMesh('crystal');
          crMesh.position.set(x + 0.4, 0, z);
          worldActorsGroup.add(crMesh);
          activeCollectibles.push({
            entity: {
              id: nextEntityId++,
              kind: 'crystal',
              x: x + 0.4,
              z,
              vx: (Math.random() - 0.5) * 2.5,
              vz: 3.8,
              value: 2,
              age: 0,
            },
            mesh: crMesh,
          });
        }

        // Power-up drop chance (24%)
        if (Math.random() < 0.24) {
          const pTypes: PowerUpType[] = [
            'shield',
            'repair',
            'laser_upgrade',
            'missile_upgrade',
            'double_damage',
            'speed_boost',
            'mega_bomb',
            'invincibility',
            'extra_life',
            'ultimate_solar',
          ];
          const chosen = pTypes[Math.floor(Math.random() * pTypes.length)];
          const pMesh = buildCollectibleMesh('powerup', chosen);
          pMesh.position.set(x, 0, z + 0.3);
          worldActorsGroup.add(pMesh);
          activeCollectibles.push({
            entity: {
              id: nextEntityId++,
              kind: 'powerup',
              powerUpType: chosen,
              x,
              z: z + 0.3,
              vx: 0,
              vz: 3.4,
              value: 1,
              age: 0,
            },
            mesh: pMesh,
          });
        }
      };

      // Pre-warm shaders on hardware GPU
      if (!isSoftwareGl) {
        renderer.compile(scene, camera);
      }

      // 9. Paced Animation Loop (afterDraw on software WebGL, rAF on hardware GPU)
      let frameId = 0;
      let isUnmounted = false;
      let lastTime = performance.now();
      let lastHudEmitTime = 0;

      function afterDraw(cb: () => void) {
        const gl = renderer.getContext() as WebGL2RenderingContext;
        if (gl && typeof gl.fenceSync === 'function') {
          const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
          gl.flush();
          const poll = () => {
            if (isUnmounted) return;
            const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
            if (state === gl.UNSIGNALED) {
              frameId = window.setTimeout(poll, 5);
            } else {
              if (sync) gl.deleteSync(sync);
              frameId = window.setTimeout(cb, 80);
            }
          };
          frameId = window.setTimeout(poll, 5);
        } else {
          frameId = window.setTimeout(cb, 80);
        }
      }

      function tick() {
        if (isUnmounted) return;
        const now = performance.now();
        const rawDt = (now - lastTime) / 1000;
        lastTime = now;
        const dt = Math.min(Math.max(rawDt, 0.001), 0.05);

        // Process queued imperative actions
        if (actionsRef.current.startPlanet) {
          const pid = actionsRef.current.startPlanet;
          actionsRef.current.startPlanet = null;
          resetAndStartMission(pid);
        }

        // Sync selected ship & planet in title state
        const state = gameStateRef.current;
        const save = saveDataRef.current;

        if (state === 'title') {
          solarSystemGroup.visible = false;
          worldActorsGroup.visible = true;
          planetBackdropGroup.visible = true;
          planetBackdropGroup.position.set(6.5, -23, -18);

          if (currentBuiltShipId !== save.selectedShip) {
            worldActorsGroup.remove(playerRig.group);
            currentBuiltShipId = save.selectedShip;
            playerRig = buildPlayerSpaceshipMesh(currentBuiltShipId, hullBumpTex);
            worldActorsGroup.add(playerRig.group);
          }
          if (currentPlanetId !== save.selectedPlanet) {
            currentPlanetId = save.selectedPlanet;
            applyPlanetEnvironment(currentPlanetId);
          }

          // Hero Showcase Stage in Title Screen (ship positioned on right-center while title sits in left negative space)
          const t = now * 0.001;
          playerRig.group.position.set(
            3.8 + Math.sin(t * 1.4) * 0.65,
            2.2 + Math.cos(t * 1.9) * 0.35,
            4.5,
          );
          playerRig.group.rotation.set(
            0.18 + Math.sin(t * 1.1) * 0.08,
            -0.42 + Math.sin(t * 0.7) * 0.22,
            0.22 + Math.cos(t * 1.3) * 0.12,
          );
          playerRig.diyaCoreMesh.rotation.y += dt * 3.2;
          const flamePulse = 0.85 + Math.sin(t * 24) * 0.25;
          playerRig.leftFlame.scale.set(1, flamePulse, 1);
          playerRig.rightFlame.scale.set(1, flamePulse, 1);

          camera.position.lerp(new THREE.Vector3(0, 14.5, 14.5), 1 - Math.exp(-4 * dt));
          camera.lookAt(1.6, 0.5, 0);
        } else if (state === 'illumination') {
          // Grand Solar System 100% Illumination 3D Diorama
          worldActorsGroup.visible = false;
          planetBackdropGroup.visible = false;
          solarSystemGroup.visible = true;

          const t = now * 0.001;
          const prog = illuminationRef.current; // 0..100
          sunCoreMesh.rotation.y += dt * 0.6;
          const sunScale = 1 + (prog / 100) * 0.35 + Math.sin(t * 4) * 0.04;
          sunCoreMesh.scale.setScalar(sunScale);

          dioramaPlanets.forEach((dp, idx) => {
            dp.angle += dp.speed * dt;
            dp.mesh.position.set(
              Math.cos(dp.angle) * dp.orbitRadius,
              Math.sin(t * 1.5 + idx) * 0.25,
              Math.sin(dp.angle) * dp.orbitRadius,
            );
            dp.mesh.rotation.y += dt * 1.2;

            const threshold = ((idx + 1) / (dioramaPlanets.length + 1)) * 95;
            const isLit = prog >= threshold;
            const mat = dp.mesh.material as THREE.MeshStandardMaterial;
            mat.emissiveIntensity = isLit ? 0.95 : 0.08;
            const haloMat = dp.halo.material as THREE.MeshBasicMaterial;
            haloMat.opacity = isLit ? 0.32 + Math.sin(t * 5 + idx) * 0.08 : 0.0;
          });

          camera.position.set(Math.sin(t * 0.22) * 4, 22, 24 + Math.cos(t * 0.22) * 3);
          camera.lookAt(0, 0, 0);
        } else if (state === 'playing') {
          solarSystemGroup.visible = false;
          worldActorsGroup.visible = true;
          planetBackdropGroup.visible = true;
          planetBackdropGroup.position.set(0, -25, -18);

          // Hitstop & camera trauma decay
          if (hitstopTimer > 0) {
            hitstopTimer = Math.max(0, hitstopTimer - dt);
          }
          const simDt = hitstopTimer > 0 ? dt * 0.12 : dt;
          missionElapsed += simDt;

          cameraTrauma = Math.max(0, cameraTrauma - dt * 1.8);
          const shake = cameraTrauma * cameraTrauma * 0.65;
          const desiredCamX = playerX * 0.18 + (Math.random() - 0.5) * shake;
          const desiredCamY = 26.5;
          const desiredCamZ = 14.8 + (Math.random() - 0.5) * shake;
          camera.position.lerp(
            new THREE.Vector3(desiredCamX, desiredCamY, desiredCamZ),
            1 - Math.exp(-8 * dt),
          );
          camera.lookAt(playerX * 0.12, 0, -2.5);

          // Update buff timers
          if (activeBuffs.doubleDamageTimer > 0) {
            activeBuffs.doubleDamageTimer = Math.max(0, activeBuffs.doubleDamageTimer - simDt);
          }
          if (activeBuffs.speedBoostTimer > 0) {
            activeBuffs.speedBoostTimer = Math.max(0, activeBuffs.speedBoostTimer - simDt);
          }
          if (activeBuffs.invincibilityTimer > 0) {
            activeBuffs.invincibilityTimer = Math.max(0, activeBuffs.invincibilityTimer - simDt);
          }
          if (activeBuffs.ultimateSolarTimer > 0) {
            activeBuffs.ultimateSolarTimer = Math.max(0, activeBuffs.ultimateSolarTimer - simDt);
          }
          if (missileCooldown > 0) {
            missileCooldown = Math.max(0, missileCooldown - simDt);
          }
          if (shieldSkillCooldown > 0) {
            shieldSkillCooldown = Math.max(0, shieldSkillCooldown - simDt);
          }
          if (announcementTimer > 0) {
            announcementTimer = Math.max(0, announcementTimer - dt);
            if (announcementTimer <= 0) announcement = '';
          }

          const stats = calculatePlayerStats(save.selectedShip, save.upgrades, activeBuffs);
          maxHp = stats.maxHp;
          maxShield = stats.maxShield;
          maxMissiles = stats.maxMissiles;

          // Passive shield & Diya Nova charge regeneration
          shield = Math.min(maxShield, shield + simDt * 2.2);
          specialCharge = Math.min(100, specialCharge + simDt * 3.5);

          // Keyboard movement
          let moveX = 0;
          let moveZ = 0;
          if (keysPressed.has('ArrowLeft') || keysPressed.has('KeyA')) moveX -= 1;
          if (keysPressed.has('ArrowRight') || keysPressed.has('KeyD')) moveX += 1;
          if (keysPressed.has('ArrowUp') || keysPressed.has('KeyW')) moveZ -= 1;
          if (keysPressed.has('ArrowDown') || keysPressed.has('KeyS')) moveZ += 1;

          if (moveX !== 0 || moveZ !== 0) {
            const len = Math.hypot(moveX, moveZ);
            targetPlayerX = THREE.MathUtils.clamp(
              playerX + (moveX / len) * stats.moveSpeed * simDt,
              PLAYFIELD_BOUNDS.minX,
              PLAYFIELD_BOUNDS.maxX,
            );
            targetPlayerZ = THREE.MathUtils.clamp(
              playerZ + (moveZ / len) * stats.moveSpeed * simDt,
              PLAYFIELD_BOUNDS.minZ + 3,
              PLAYFIELD_BOUNDS.maxZ,
            );
          }

          const prevX = playerX;
          const posDamp = 1 - Math.exp(-14 * simDt);
          playerX += (targetPlayerX - playerX) * posDamp;
          playerZ += (targetPlayerZ - playerZ) * posDamp;
          playerVx = (playerX - prevX) / Math.max(0.001, simDt);

          // Smooth banking roll & pitch animation
          const desiredBank = THREE.MathUtils.clamp(-playerVx * 0.032, -0.52, 0.52);
          playerBankAngle += (desiredBank - playerBankAngle) * (1 - Math.exp(-12 * simDt));
          playerRig.group.position.set(playerX, 0, playerZ);
          playerRig.group.rotation.set(0, 0, playerBankAngle);
          playerRig.diyaCoreMesh.rotation.y += simDt * 4.5;

          const thrusterScale =
            (activeBuffs.speedBoostTimer > 0 ? 1.45 : 1.0) +
            Math.sin(now * 0.03) * 0.22;
          playerRig.leftFlame.scale.set(1, thrusterScale, 1);
          playerRig.rightFlame.scale.set(1, thrusterScale, 1);
          diyaPointLight.position.set(playerX, 2.2, playerZ);

          // Shield bubble visual
          const shieldMat = playerRig.shieldMesh.material as THREE.MeshBasicMaterial;
          if (activeBuffs.invincibilityTimer > 0 || activeBuffs.ultimateSolarTimer > 0) {
            shieldMat.color.setHex(0xfde047);
            shieldMat.opacity = 0.38 + Math.sin(now * 0.015) * 0.12;
          } else if (shield > 15) {
            shieldMat.color.setHex(0x38bdf8);
            shieldMat.opacity = 0.14;
          } else {
            shieldMat.opacity = 0.0;
          }

          // Handle Weapon Cycle
          if (actionsRef.current.cycleWeapon) {
            actionsRef.current.cycleWeapon = false;
            weaponTierLevel = (weaponTierLevel % 8) + 1;
            currentWeaponId = getWeaponByLevel(weaponTierLevel);
            announcement = `EQUIPPED: ${WEAPON_MAP[currentWeaponId].name.toUpperCase()}`;
            announcementTimer = 1.6;
          }

          // Handle Summon Boss shortcut
          if (actionsRef.current.summonBoss && !bossEntity.active) {
            actionsRef.current.summonBoss = false;
            wave = totalWaves;
            spawnPlanetBoss(currentPlanetId);
          }

          // Handle Dedicated Homing Missile Volley [X]
          if (actionsRef.current.fireMissile) {
            actionsRef.current.fireMissile = false;
            if (missiles > 0 && missileCooldown <= 0) {
              missiles--;
              missileCooldown = 0.85;
              soundEngine.playMissileLaunch();
              const mDmg = Math.round(65 * stats.damageMultiplier);
              [-1.1, -0.4, 0.4, 1.1].forEach((offsetX) => {
                const mMat = new THREE.MeshBasicMaterial({ color: 0xf97316 });
                const mMesh = new THREE.Mesh(projectileGeo, mMat);
                mMesh.position.set(playerX + offsetX, 0, playerZ - 1.2);
                mMesh.scale.setScalar(1.3);
                worldActorsGroup.add(mMesh);
                activeProjectiles.push({
                  mesh: mMesh,
                  x: playerX + offsetX,
                  z: playerZ - 1.2,
                  vx: offsetX * 5,
                  vz: -36,
                  damage: mDmg,
                  radius: 0.65,
                  isEnemy: false,
                  isHoming: true,
                  age: 0,
                });
              });
            }
          }

          // Handle Emergency Shield Skill [C]
          if (actionsRef.current.activateShield) {
            actionsRef.current.activateShield = false;
            if (shieldSkillCooldown <= 0) {
              shieldSkillCooldown = 10.0;
              shield = Math.min(maxShield, shield + 60);
              activeBuffs.invincibilityTimer = Math.max(activeBuffs.invincibilityTimer, 3.5);
              soundEngine.playPickup(true);
              spawnParticleBurst(playerX, 0.5, playerZ, 0x38bdf8, 22, 12, 1.2);
              announcement = 'DIYA AEGIS SHIELD ACTIVATED!';
              announcementTimer = 1.8;
            }
          }

          // Handle Special Weapon: Diya Solar Nova [Shift]
          if (actionsRef.current.triggerNova) {
            actionsRef.current.triggerNova = false;
            if (specialCharge >= 100) {
              specialCharge = 0;
              soundEngine.playSpecialDiyaNova();
              cameraTrauma = Math.min(1, cameraTrauma + 0.75);
              hitstopTimer = 0.06;
              spawnParticleBurst(playerX, 0.5, playerZ - 4, 0xfde047, 45, 22, 1.8);
              announcement = 'DIYA SOLAR NOVA UNLEASHED!';
              announcementTimer = 2.2;

              // Clear enemy bullets and damage all enemies & boss
              for (let i = activeProjectiles.length - 1; i >= 0; i--) {
                if (activeProjectiles[i].isEnemy) {
                  worldActorsGroup.remove(activeProjectiles[i].mesh);
                  activeProjectiles.splice(i, 1);
                }
              }
              activeEnemies.forEach(({ entity }) => {
                entity.hp -= stats.specialDamage;
                entity.hitFlash = 0.25;
              });
              if (bossEntity.active) {
                if (bossEntity.shieldHp > 0) {
                  bossEntity.shieldHp = Math.max(
                    0,
                    bossEntity.shieldHp - stats.specialDamage,
                  );
                } else {
                  bossEntity.hp = Math.max(0, bossEntity.hp - stats.specialDamage * 0.85);
                }
                bossEntity.hitFlash = 0.3;
              }
            }
          }

          // Primary Weapon Firing (Auto-fire or Spacebar)
          const activeWepId =
            activeBuffs.ultimateSolarTimer > 0 ? 'galaxy_blast' : currentWeaponId;
          const wepCfg = WEAPON_MAP[activeWepId] ?? WEAPON_MAP.basic_laser;
          const fireInterval = wepCfg.fireInterval * stats.fireIntervalMultiplier;
          fireTimer -= simDt;
          const wantsFire = save.autoFire || keysPressed.has('Space');
          if (wantsFire && fireTimer <= 0) {
            fireTimer = fireInterval;
            const specs = generateWeaponProjectiles(
              activeWepId,
              playerX,
              playerZ,
              stats.damageMultiplier,
            );
            soundEngine.playLaser(wepCfg.level);
            for (const sp of specs) {
              const pMat = new THREE.MeshBasicMaterial({ color: sp.colorHex });
              const pMesh = new THREE.Mesh(projectileGeo, pMat);
              pMesh.position.set(sp.x, 0, sp.z);
              if (sp.isBeam) pMesh.scale.set(1.3, 1, 2.2);
              worldActorsGroup.add(pMesh);
              activeProjectiles.push({
                mesh: pMesh,
                x: sp.x,
                z: sp.z,
                vx: sp.vx,
                vz: sp.vz,
                damage: sp.damage,
                radius: sp.radius,
                isEnemy: false,
                isHoming: sp.isHoming,
                piercing: sp.piercing,
                age: 0,
              });
            }
          }

          // Spawn Asteroids periodically
          asteroidTimer -= simDt;
          if (asteroidTimer <= 0 && !bossEntity.active) {
            asteroidTimer = 2.4 + Math.random() * 1.8;
            const ax = (Math.random() - 0.5) * 24;
            const radius = 0.85 + Math.random() * 0.65;
            const aMat = new THREE.MeshStandardMaterial({
              color: PLANET_MAP[currentPlanetId].surfaceHex,
              roughness: 0.85,
              metalness: 0.2,
            });
            const aMesh = new THREE.Mesh(asteroidGeo, aMat);
            aMesh.scale.setScalar(radius);
            aMesh.position.set(ax, 0, -20);
            worldActorsGroup.add(aMesh);
            activeAsteroids.push({
              entity: {
                id: nextEntityId++,
                x: ax,
                z: -20,
                vx: (Math.random() - 0.5) * 2.2,
                vz: 4.5 + Math.random() * 3.0,
                radius,
                hp: Math.round(45 * radius),
                maxHp: Math.round(45 * radius),
                rotSpeedX: (Math.random() - 0.5) * 3,
                rotSpeedY: (Math.random() - 0.5) * 3,
                hitFlash: 0,
              },
              mesh: aMesh,
            });
          }

          // Wave Progression
          if (!bossEntity.active && activeEnemies.length === 0) {
            waveTimer += simDt;
            if (waveTimer >= 1.1) {
              waveTimer = 0;
              if (wave < totalWaves - 1) {
                wave++;
                spawnEnemyWave(wave, currentPlanetId);
              } else {
                wave = totalWaves;
                spawnPlanetBoss(currentPlanetId);
              }
            }
          }

          // Update Projectiles
          for (let i = activeProjectiles.length - 1; i >= 0; i--) {
            const proj = activeProjectiles[i];
            proj.age += simDt;

            // Homing steering toward nearest enemy or boss
            if (proj.isHoming && !proj.isEnemy) {
              let bestTargetX = proj.x;
              let bestTargetZ = proj.z - 10;
              let bestDist = 999;
              for (const { entity: en } of activeEnemies) {
                if (en.koTimer > 0) continue;
                const d = Math.hypot(en.x - proj.x, en.z - proj.z);
                if (d < bestDist) {
                  bestDist = d;
                  bestTargetX = en.x;
                  bestTargetZ = en.z;
                }
              }
              if (bossEntity.active && bestDist > 20) {
                bestTargetX = bossEntity.x;
                bestTargetZ = bossEntity.z;
                bestDist = 10;
              }
              if (bestDist < 40) {
                const dx = bestTargetX - proj.x;
                const dz = bestTargetZ - proj.z;
                const len = Math.hypot(dx, dz) || 1;
                const spd = Math.hypot(proj.vx, proj.vz) || 42;
                proj.vx += ((dx / len) * spd - proj.vx) * 8 * simDt;
                proj.vz += ((dz / len) * spd - proj.vz) * 8 * simDt;
              }
            }

            proj.x += proj.vx * simDt;
            proj.z += proj.vz * simDt;
            proj.mesh.position.set(proj.x, 0, proj.z);

            if (
              proj.z < -24 ||
              proj.z > 18 ||
              proj.x < -20 ||
              proj.x > 20 ||
              proj.age > 5
            ) {
              worldActorsGroup.remove(proj.mesh);
              activeProjectiles.splice(i, 1);
              continue;
            }

            if (proj.isEnemy) {
              // Check hit against player
              if (
                checkCircleCollision(proj.x, proj.z, proj.radius, playerX, playerZ, 0.95)
              ) {
                worldActorsGroup.remove(proj.mesh);
                activeProjectiles.splice(i, 1);
                if (
                  activeBuffs.invincibilityTimer <= 0 &&
                  activeBuffs.ultimateSolarTimer <= 0
                ) {
                  const dmg = proj.damage;
                  if (shield >= dmg) {
                    shield -= dmg;
                  } else {
                    const rem = dmg - shield;
                    shield = 0;
                    hp = Math.max(0, hp - rem);
                  }
                  playerHitFlash = 0.2;
                  cameraTrauma = Math.min(1, cameraTrauma + 0.38);
                  soundEngine.playHit();
                  spawnParticleBurst(playerX, 0.3, playerZ, 0xef4444, 12, 8, 0.9);
                }
              }
            } else {
              // Player projectile vs Enemies
              let consumed = false;
              for (let j = activeEnemies.length - 1; j >= 0; j--) {
                const { entity: en } = activeEnemies[j];
                if (en.koTimer > 0) continue;
                if (
                  checkCircleCollision(proj.x, proj.z, proj.radius, en.x, en.z, en.radius)
                ) {
                  en.hp -= proj.damage;
                  en.hitFlash = 0.08;
                  soundEngine.playHit();
                  spawnParticleBurst(proj.x, 0.2, proj.z, 0xfde047, 5, 6, 0.65);
                  if (!proj.piercing) {
                    consumed = true;
                    break;
                  }
                }
              }

              // Player projectile vs Asteroids
              if (!consumed) {
                for (let j = activeAsteroids.length - 1; j >= 0; j--) {
                  const { entity: ast, mesh: aMesh } = activeAsteroids[j];
                  if (
                    checkCircleCollision(
                      proj.x,
                      proj.z,
                      proj.radius,
                      ast.x,
                      ast.z,
                      ast.radius,
                    )
                  ) {
                    ast.hp -= proj.damage;
                    spawnParticleBurst(proj.x, 0.2, proj.z, 0xf97316, 4, 5, 0.6);
                    if (ast.hp <= 0) {
                      soundEngine.playExplosion(false);
                      spawnParticleBurst(ast.x, 0.2, ast.z, 0xf59e0b, 14, 10, 1.0);
                      spawnDropsAt(ast.x, ast.z, 10, 0.25);
                      score += 60;
                      worldActorsGroup.remove(aMesh);
                      activeAsteroids.splice(j, 1);
                    }
                    if (!proj.piercing) {
                      consumed = true;
                      break;
                    }
                  }
                }
              }

              // Player projectile vs Boss
              if (
                !consumed &&
                bossEntity.active &&
                bossEntity.introProgress >= 0.9 &&
                bossEntity.defeatTimer <= 0 &&
                checkCircleCollision(
                  proj.x,
                  proj.z,
                  proj.radius,
                  bossEntity.x,
                  bossEntity.z,
                  bossEntity.radius,
                )
              ) {
                if (bossEntity.shieldHp > 0) {
                  bossEntity.shieldHp = Math.max(0, bossEntity.shieldHp - proj.damage);
                  spawnParticleBurst(proj.x, 0.4, proj.z, 0xa855f7, 6, 7, 0.75);
                } else {
                  bossEntity.hp = Math.max(0, bossEntity.hp - proj.damage);
                  spawnParticleBurst(proj.x, 0.4, proj.z, 0xfacc15, 6, 7, 0.75);
                }
                bossEntity.hitFlash = 0.06;
                specialCharge = Math.min(100, specialCharge + 0.6);
                if (!proj.piercing) {
                  consumed = true;
                }
              }

              if (consumed) {
                worldActorsGroup.remove(proj.mesh);
                activeProjectiles.splice(i, 1);
              }
            }
          }

          // Update Enemies
          let activeCrowdShooters = 0;
          for (let i = activeEnemies.length - 1; i >= 0; i--) {
            const { entity: en, mesh } = activeEnemies[i];

            if (en.hp <= 0 && en.koTimer <= 0) {
              en.koTimer = 0.28; // KO topple transition
              score += en.scoreValue;
              enemiesDefeated++;
              specialCharge = Math.min(100, specialCharge + 5);
              hitstopTimer = Math.max(hitstopTimer, 0.03);
              cameraTrauma = Math.min(1, cameraTrauma + 0.22);
              soundEngine.playExplosion(en.type === 'battleship');
              spawnParticleBurst(en.x, 0.3, en.z, 0xf59e0b, 18, 12, 1.15);
              spawnDropsAt(en.x, en.z, en.coinDrop, en.crystalChance);
            }

            if (en.koTimer > 0) {
              en.koTimer -= simDt;
              mesh.rotation.z += simDt * 8;
              mesh.rotation.x += simDt * 5;
              mesh.scale.multiplyScalar(Math.max(0.1, 1 - simDt * 3.2));
              if (en.koTimer <= 0) {
                worldActorsGroup.remove(mesh);
                activeEnemies.splice(i, 1);
              }
              continue;
            }

            stepEnemyMovement(en, playerX, playerZ, simDt, missionElapsed);
            mesh.position.set(en.x, 0, en.z);
            mesh.rotation.z = THREE.MathUtils.clamp(-en.vx * 0.05, -0.45, 0.45);

            // Visual hit flash or kamikaze telegraph
            if (en.hitFlash > 0) {
              en.hitFlash = Math.max(0, en.hitFlash - simDt);
              mesh.scale.set(1.12, 0.88, 1.12);
            } else if (en.telegraphTimer > 0) {
              const pulse = 1 + Math.sin(now * 0.04) * 0.18;
              mesh.scale.setScalar(pulse);
            } else {
              mesh.scale.lerp(new THREE.Vector3(1, 1, 1), 1 - Math.exp(-12 * simDt));
            }

            // Enemy shooting (token pool capped at 4 simultaneous crowd shooters)
            en.fireCooldown -= simDt;
            if (
              en.fireCooldown <= 0 &&
              en.type !== 'kamikaze' &&
              en.z > -15 &&
              en.z < 4 &&
              activeCrowdShooters < 4
            ) {
              activeCrowdShooters++;
              en.fireCooldown = en.type === 'battleship' ? 1.3 : 2.1 + Math.random() * 0.8;
              const aimDx = playerX - en.x;
              const aimDz = playerZ - en.z;
              const len = Math.hypot(aimDx, aimDz) || 1;
              const bSpeed = 13.5;

              const bMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });
              const bMesh = new THREE.Mesh(enemyBulletGeo, bMat);
              bMesh.position.set(en.x, 0, en.z + 0.8);
              worldActorsGroup.add(bMesh);
              activeProjectiles.push({
                mesh: bMesh,
                x: en.x,
                z: en.z + 0.8,
                vx: (aimDx / len) * bSpeed,
                vz: (aimDz / len) * bSpeed,
                damage: 14,
                radius: 0.36,
                isEnemy: true,
                age: 0,
              });
            }

            // Enemy body collision with player
            if (checkCircleCollision(en.x, en.z, en.radius, playerX, playerZ, 0.95)) {
              en.hp = 0;
              if (
                activeBuffs.invincibilityTimer <= 0 &&
                activeBuffs.ultimateSolarTimer <= 0
              ) {
                const crashDmg = 24;
                if (shield >= crashDmg) {
                  shield -= crashDmg;
                } else {
                  hp = Math.max(0, hp - (crashDmg - shield));
                  shield = 0;
                }
                cameraTrauma = Math.min(1, cameraTrauma + 0.45);
              }
            }

            // Despawn if off bottom of playfield
            if (en.z > 16.5) {
              worldActorsGroup.remove(mesh);
              activeEnemies.splice(i, 1);
            }
          }

          // Update Asteroids
          for (let i = activeAsteroids.length - 1; i >= 0; i--) {
            const { entity: ast, mesh } = activeAsteroids[i];
            ast.x += ast.vx * simDt;
            ast.z += ast.vz * simDt;
            mesh.position.set(ast.x, 0, ast.z);
            mesh.rotation.x += ast.rotSpeedX * simDt;
            mesh.rotation.y += ast.rotSpeedY * simDt;

            if (checkCircleCollision(ast.x, ast.z, ast.radius, playerX, playerZ, 0.95)) {
              worldActorsGroup.remove(mesh);
              activeAsteroids.splice(i, 1);
              soundEngine.playExplosion(false);
              spawnParticleBurst(ast.x, 0.2, ast.z, 0xf97316, 14, 10, 1.0);
              if (
                activeBuffs.invincibilityTimer <= 0 &&
                activeBuffs.ultimateSolarTimer <= 0
              ) {
                const dmg = 22;
                if (shield >= dmg) shield -= dmg;
                else {
                  hp = Math.max(0, hp - (dmg - shield));
                  shield = 0;
                }
                cameraTrauma = Math.min(1, cameraTrauma + 0.4);
              }
              continue;
            }

            if (ast.z > 17) {
              worldActorsGroup.remove(mesh);
              activeAsteroids.splice(i, 1);
            }
          }

          // Update Boss
          if (bossEntity.active && bossRig) {
            if (bossEntity.hp <= 0 && bossEntity.defeatTimer <= 0) {
              bossEntity.defeatTimer = 1.6;
              score += 2500 * PLANET_MAP[currentPlanetId].order;
              hitstopTimer = 0.08;
              cameraTrauma = 1.0;
              soundEngine.playExplosion(true);
              announcement = `${bossEntity.name.toUpperCase()} DESTROYED!`;
              announcementTimer = 3.0;
              // Clear enemy projectiles
              for (let i = activeProjectiles.length - 1; i >= 0; i--) {
                if (activeProjectiles[i].isEnemy) {
                  worldActorsGroup.remove(activeProjectiles[i].mesh);
                  activeProjectiles.splice(i, 1);
                }
              }
            }

            if (bossEntity.defeatTimer > 0) {
              bossEntity.defeatTimer -= dt;
              if (Math.random() < 0.45) {
                spawnParticleBurst(
                  bossEntity.x + (Math.random() - 0.5) * 5,
                  0.5,
                  bossEntity.z + (Math.random() - 0.5) * 3,
                  0xfacc15,
                  16,
                  14,
                  1.4,
                );
                soundEngine.playExplosion(false);
              }
              bossRig.group.rotation.z += dt * 1.5;
              bossRig.group.scale.multiplyScalar(Math.max(0.2, 1 - dt * 0.45));

              if (bossEntity.defeatTimer <= 0 && !outcomeTriggered) {
                outcomeTriggered = true;
                worldActorsGroup.remove(bossRig.group);
                bossRig = null;
                bossEntity.active = false;
                const stars = calculateMissionStars(
                  hp / Math.max(1, maxHp),
                  enemiesDefeated / Math.max(1, totalEnemiesSpawned),
                  true,
                );
                soundEngine.playIlluminationFanfare();
                callbacksRef.current.onMissionEnd('victory', {
                  planetId: currentPlanetId,
                  score,
                  coins: coinsEarned,
                  crystals: crystalsEarned,
                  materials: materialsEarned,
                  stars,
                  clearTime: Math.round(missionElapsed),
                  enemiesDefeated,
                  bossHpRemaining: 0,
                  waveReached: totalWaves,
                });
              }
            } else {
              const bossDecision = stepBossBehavior(
                bossEntity,
                playerX,
                simDt,
                missionElapsed,
              );
              bossRig.group.position.set(bossEntity.x, 0, bossEntity.z);
              bossRig.ringMesh.rotation.z += simDt * (1.5 + bossEntity.phase * 0.8);
              bossRig.coreMesh.rotation.y -= simDt * 2.5;

              const shieldDomeMat = bossRig.shieldDome.material as THREE.MeshBasicMaterial;
              shieldDomeMat.opacity =
                bossEntity.shieldHp > 0
                  ? 0.25 + Math.sin(now * 0.01) * 0.08
                  : 0.0;

              if (bossEntity.telegraphTimer > 0) {
                // Telegraph windup glow pulse
                const s = 1 + Math.sin(now * 0.05) * 0.25;
                bossRig.coreMesh.scale.setScalar(s);
              } else {
                bossRig.coreMesh.scale.setScalar(1);
              }

              if (bossDecision.shouldFirePattern) {
                const pat = bossDecision.pattern;
                const count =
                  pat === 'radial'
                    ? 7 + bossEntity.phase * 2
                    : pat === 'solar_flare'
                      ? 9
                      : 5;
                for (let k = 0; k < count; k++) {
                  const spread = ((k - (count - 1) / 2) / Math.max(1, count - 1)) * 1.1;
                  const vx = Math.sin(spread) * 14;
                  const vz = Math.cos(spread) * 14;
                  const bColor =
                    pat === 'solar_flare'
                      ? 0xf59e0b
                      : pat === 'beam'
                        ? 0x38bdf8
                        : 0xef4444;
                  const bMat = new THREE.MeshBasicMaterial({ color: bColor });
                  const bMesh = new THREE.Mesh(enemyBulletGeo, bMat);
                  bMesh.position.set(bossEntity.x, 0, bossEntity.z + 1.8);
                  worldActorsGroup.add(bMesh);
                  activeProjectiles.push({
                    mesh: bMesh,
                    x: bossEntity.x,
                    z: bossEntity.z + 1.8,
                    vx,
                    vz,
                    damage: 16 + bossEntity.phase * 3,
                    radius: 0.42,
                    isEnemy: true,
                    age: 0,
                  });
                }
              }
            }
          }

          // Update Collectibles & Power-Ups (magnet pull when close)
          for (let i = activeCollectibles.length - 1; i >= 0; i--) {
            const { entity: col, mesh } = activeCollectibles[i];
            col.age += simDt;
            const distToPlayer = Math.hypot(playerX - col.x, playerZ - col.z);
            if (distToPlayer < 5.2) {
              const pull = (1 - distToPlayer / 5.2) * 22;
              col.vx = ((playerX - col.x) / Math.max(0.1, distToPlayer)) * pull;
              col.vz = ((playerZ - col.z) / Math.max(0.1, distToPlayer)) * pull;
            }
            col.x += col.vx * simDt;
            col.z += col.vz * simDt;
            mesh.position.set(col.x, 0, col.z);
            mesh.rotation.y += simDt * 3.2;

            if (distToPlayer < 1.55) {
              if (col.kind === 'coin') {
                coinsEarned += col.value;
                score += col.value * 5;
                soundEngine.playPickup(false);
              } else if (col.kind === 'crystal') {
                crystalsEarned += col.value;
                score += 50;
                soundEngine.playPickup(true);
              } else if (col.kind === 'material') {
                materialsEarned += col.value;
                soundEngine.playPickup(true);
              } else if (col.kind === 'powerup' && col.powerUpType) {
                soundEngine.playPickup(true);
                const pInfo = POWERUP_INFO[col.powerUpType];
                announcement = `POWER-UP: ${pInfo.label.toUpperCase()}`;
                announcementTimer = 2.0;
                spawnParticleBurst(playerX, 0.4, playerZ, pInfo.colorHex, 16, 10, 1.1);

                switch (col.powerUpType) {
                  case 'shield':
                    shield = Math.min(maxShield, shield + 50);
                    break;
                  case 'repair':
                    hp = Math.min(maxHp, hp + 45);
                    break;
                  case 'laser_upgrade':
                    weaponTierLevel = Math.min(8, weaponTierLevel + 1);
                    currentWeaponId = getWeaponByLevel(weaponTierLevel);
                    break;
                  case 'missile_upgrade':
                    missiles = Math.min(maxMissiles, missiles + 3);
                    break;
                  case 'double_damage':
                    activeBuffs.doubleDamageTimer = 12;
                    break;
                  case 'speed_boost':
                    activeBuffs.speedBoostTimer = 10;
                    break;
                  case 'mega_bomb':
                    activeEnemies.forEach(({ entity: en }) => {
                      en.hp -= 180;
                    });
                    cameraTrauma = Math.min(1, cameraTrauma + 0.65);
                    break;
                  case 'invincibility':
                    activeBuffs.invincibilityTimer = 8;
                    break;
                  case 'extra_life':
                    lives = Math.min(5, lives + 1);
                    break;
                  case 'ultimate_solar':
                    activeBuffs.ultimateSolarTimer = 10;
                    specialCharge = 100;
                    break;
                }
              }
              worldActorsGroup.remove(mesh);
              activeCollectibles.splice(i, 1);
              continue;
            }

            if (col.z > 17) {
              worldActorsGroup.remove(mesh);
              activeCollectibles.splice(i, 1);
            }
          }

          // Check Player Defeat / Extra Life
          if (hp <= 0 && !outcomeTriggered) {
            if (lives > 1) {
              lives--;
              hp = maxHp;
              shield = maxShield;
              activeBuffs.invincibilityTimer = 3.5;
              announcement = `RESERVE WING DEPLOYED! (${lives} LIVES REMAINING)`;
              announcementTimer = 2.4;
              soundEngine.playExplosion(true);
              spawnParticleBurst(playerX, 0.5, playerZ, 0xfde047, 30, 15, 1.3);
            } else {
              outcomeTriggered = true;
              soundEngine.playExplosion(true);
              spawnParticleBurst(playerX, 0.5, playerZ, 0xef4444, 40, 16, 1.5);
              const bossPct = bossEntity.active
                ? Math.round((bossEntity.hp / Math.max(1, bossEntity.maxHp)) * 100)
                : 100;
              callbacksRef.current.onMissionEnd('defeat', {
                planetId: currentPlanetId,
                score,
                coins: coinsEarned,
                crystals: crystalsEarned,
                materials: materialsEarned,
                stars: 0,
                clearTime: Math.round(missionElapsed),
                enemiesDefeated,
                bossHpRemaining: bossPct,
                waveReached: wave,
              });
            }
          }

          // Throttled HUD state emission (~10Hz) so React never re-renders at 60Hz
          if (now - lastHudEmitTime >= 95) {
            lastHudEmitTime = now;
            const pCfg = PLANET_MAP[currentPlanetId] ?? PLANET_MAP.venus;
            const wCfg = WEAPON_MAP[currentWeaponId] ?? WEAPON_MAP.basic_laser;
            callbacksRef.current.onHudUpdate({
              hp: Math.round(hp),
              maxHp: Math.round(maxHp),
              shield: Math.round(shield),
              maxShield: Math.round(maxShield),
              lives,
              score: Math.round(score),
              highScore: Math.max(save.highScore, Math.round(score)),
              coinsEarned,
              crystalsEarned,
              materialsEarned,
              weaponLevel: weaponTierLevel,
              weaponName: wCfg.name,
              weaponId: currentWeaponId,
              missiles,
              maxMissiles,
              missileCooldown,
              specialCharge: Math.round(specialCharge),
              shieldSkillCooldown,
              planetId: currentPlanetId,
              planetName: pCfg.name,
              wave,
              totalWaves,
              objectiveText: bossEntity.active
                ? `DEFEAT ${bossEntity.name.toUpperCase()}`
                : `CLEAR ENEMY SQUADRONS (WAVE ${wave}/${totalWaves - 1})`,
              bossActive: bossEntity.active,
              bossName: bossEntity.name,
              bossHp: Math.round(bossEntity.hp),
              bossMaxHp: Math.round(bossEntity.maxHp),
              bossPhase: bossEntity.phase,
              bossShieldHp: Math.round(bossEntity.shieldHp),
              bossMaxShieldHp: Math.round(bossEntity.maxShieldHp),
              activeBuffs: { ...activeBuffs },
              enemiesDefeated,
              totalEnemiesSpawned,
              elapsedTime: Math.round(missionElapsed),
              announcement,
            });
          }
        }

        // Ambient animations (stars, planet spin, pooled particles)
        planetSphereMesh.rotation.y += dt * 0.08;
        if (planetRingMesh.visible) {
          planetRingMesh.rotation.z += dt * 0.05;
        }

        for (let i = 0; i < STAR_COUNT; i++) {
          starPositions[i * 3 + 2] += starSpeeds[i] * dt;
          if (starPositions[i * 3 + 2] > 24) {
            starPositions[i * 3 + 2] = -24;
            starPositions[i * 3] = (Math.random() - 0.5) * 48;
          }
          _dummyObj.position.set(
            starPositions[i * 3],
            starPositions[i * 3 + 1],
            starPositions[i * 3 + 2],
          );
          _dummyObj.scale.setScalar(0.8);
          _dummyObj.updateMatrix();
          starField.setMatrixAt(i, _dummyObj.matrix);
        }
        starField.instanceMatrix.needsUpdate = true;

        let anyParticleUpdated = false;
        for (let i = 0; i < MAX_PARTICLES; i++) {
          if (partLife[i] > 0) {
            anyParticleUpdated = true;
            partLife[i] -= dt;
            if (partLife[i] <= 0) {
              _dummyObj.position.set(0, -999, 0);
              _dummyObj.scale.setScalar(0.001);
            } else {
              partX[i] += partVx[i] * dt;
              partY[i] += partVy[i] * dt;
              partZ[i] += partVz[i] * dt;
              const ratio = partLife[i] / Math.max(0.01, partMaxLife[i]);
              _dummyObj.position.set(partX[i], partY[i], partZ[i]);
              _dummyObj.scale.setScalar(partScale[i] * ratio);
            }
            _dummyObj.updateMatrix();
            particleMesh.setMatrixAt(i, _dummyObj.matrix);
          }
        }
        if (anyParticleUpdated) {
          particleMesh.instanceMatrix.needsUpdate = true;
        }

        renderer.render(scene, camera);

        if (isSoftwareGl) {
          afterDraw(tick);
        } else {
          frameId = requestAnimationFrame(tick);
        }
      }

      frameId = requestAnimationFrame(tick);

      return () => {
        isUnmounted = true;
        cancelAnimationFrame(frameId);
        clearTimeout(frameId);
        resizeObserver.disconnect();
        window.removeEventListener('keydown', onKeyDown);
        window.removeEventListener('keyup', onKeyUp);
        window.removeEventListener('blur', onBlur);
        renderer.domElement.removeEventListener('pointerdown', onPointerDown);
        window.removeEventListener('pointermove', onPointerMove);
        window.removeEventListener('pointerup', onPointerUp);
        renderer.domElement.removeEventListener('webglcontextlost', onContextLost);
        soundEngine.stopMusic();
        renderer.dispose();
      };
    }, []);

    return (
      <div
        ref={mountRef}
        className="fixed inset-0 w-full h-full overflow-hidden select-none touch-none"
      />
    );
  },
);
