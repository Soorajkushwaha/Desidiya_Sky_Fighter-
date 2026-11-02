import * as THREE from 'three';
import { PLANET_MAP, SPACESHIP_MAP } from './campaignData';
import {
  EnemyType,
  PlanetId,
  PowerUpType,
  SpaceshipId,
} from './types';

/**
 * Generates a tileable procedural bump/panel texture on HTML5 Canvas.
 */
export function createHullPanelTexture(renderer: THREE.WebGLRenderer): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, 256, 256);

  ctx.strokeStyle = '#525252';
  ctx.lineWidth = 3;
  ctx.strokeRect(12, 12, 108, 232);
  ctx.strokeRect(136, 12, 108, 110);
  ctx.strokeRect(136, 134, 108, 110);

  ctx.fillStyle = '#9ca3af';
  for (let y = 24; y < 240; y += 36) {
    ctx.fillRect(22, y, 88, 6);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return tex;
}

/**
 * Generates a procedural planetary surface texture per PlanetId.
 */
export function createPlanetSurfaceTexture(
  planetId: PlanetId,
  renderer: THREE.WebGLRenderer,
): THREE.CanvasTexture {
  const cfg = PLANET_MAP[planetId];
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  const grad = ctx.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, cfg.primaryColor);
  grad.addColorStop(0.5, cfg.secondaryColor);
  grad.addColorStop(1, cfg.primaryColor);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 256);

  // Atmospheric bands & craters/continents
  for (let i = 0; i < 28; i++) {
    const y = (i / 28) * 256;
    ctx.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.18)';
    ctx.fillRect(0, y, 512, 4 + (i % 5) * 2);
  }

  for (let i = 0; i < 40; i++) {
    const cx = ((i * 97) % 480) + 16;
    const cy = ((i * 53) % 220) + 18;
    const rx = 14 + (i % 6) * 8;
    const ry = 6 + (i % 4) * 4;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    ctx.fillStyle =
      planetId === 'earth'
        ? i % 3 === 0
          ? 'rgba(16, 185, 129, 0.55)'
          : 'rgba(255, 255, 255, 0.25)'
        : planetId === 'venus' || planetId === 'sun'
          ? 'rgba(254, 240, 138, 0.32)'
          : 'rgba(255, 255, 255, 0.16)';
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return tex;
}

/**
 * Builds the player's composite 9-part 3D DesiDiya Sky Fighter spaceship.
 * Includes:
 * 1. Central sculpted fuselage
 * 2. Swept main wings (ExtrudeGeometry with bevel)
 * 3. Forward canards / winglets
 * 4. Cockpit glass canopy
 * 5. Golden DesiDiya Core emblem on dorsal spine
 * 6. Dual turbine engine nacelles
 * 7. Glowing dual engine exhaust plumes
 * 8. Golden & cyan energy trim conduits
 * 9. Translucent Energy Shield bubble
 */
export function buildPlayerSpaceshipMesh(
  shipId: SpaceshipId,
  bumpTex: THREE.Texture,
): {
  group: THREE.Group;
  shieldMesh: THREE.Mesh;
  leftFlame: THREE.Mesh;
  rightFlame: THREE.Mesh;
  diyaCoreMesh: THREE.Mesh;
} {
  const cfg = SPACESHIP_MAP[shipId] ?? SPACESHIP_MAP.tejas_diya;
  const group = new THREE.Group();

  // Materials with >= 0.25 roughness delta between adjacent parts
  const hullMat = new THREE.MeshStandardMaterial({
    color: cfg.primaryHex,
    roughness: 0.68,
    metalness: 0.42,
    bumpMap: bumpTex,
    bumpScale: 0.03,
  });

  const goldTrimMat = new THREE.MeshStandardMaterial({
    color: cfg.trimHex,
    roughness: 0.22,
    metalness: 0.88,
    emissive: cfg.trimHex,
    emissiveIntensity: 0.28,
  });

  const canopyMat = new THREE.MeshPhysicalMaterial({
    color: 0x38bdf8,
    roughness: 0.12,
    metalness: 0.1,
    clearcoat: 1.0,
    emissive: 0x0284c7,
    emissiveIntensity: 0.35,
  });

  const energyMat = new THREE.MeshStandardMaterial({
    color: cfg.energyHex,
    roughness: 0.2,
    metalness: 0.5,
    emissive: cfg.energyHex,
    emissiveIntensity: 1.1,
  });

  // 1. Primary Fuselage (sculpted hexagonal nose + body)
  const bodyGeo = new THREE.ConeGeometry(0.68, 3.4, 6);
  bodyGeo.rotateX(-Math.PI / 2);
  bodyGeo.scale(1.0, 0.52, 1.0);
  const bodyMesh = new THREE.Mesh(bodyGeo, hullMat);
  bodyMesh.castShadow = true;
  bodyMesh.receiveShadow = true;
  group.add(bodyMesh);

  // 2. Extruded Swept Wings with bevel
  const wingShape = new THREE.Shape();
  const wingSpan = shipId === 'vajra_astral' ? 2.15 : shipId === 'garuda_solar' ? 1.95 : 1.85;
  const forwardSweep = shipId === 'garuda_solar' ? -0.45 : 0.45;
  wingShape.moveTo(0, 0.8);
  wingShape.lineTo(wingSpan, -0.45 - forwardSweep);
  wingShape.lineTo(wingSpan, -0.95 - forwardSweep * 0.5);
  wingShape.lineTo(0.45, -1.25);
  wingShape.lineTo(-0.45, -1.25);
  wingShape.lineTo(-wingSpan, -0.95 - forwardSweep * 0.5);
  wingShape.lineTo(-wingSpan, -0.45 - forwardSweep);
  wingShape.closePath();

  const wingGeo = new THREE.ExtrudeGeometry(wingShape, {
    depth: 0.12,
    bevelEnabled: true,
    bevelThickness: 0.04,
    bevelSize: 0.04,
    bevelSegments: 2,
  });
  wingGeo.rotateX(Math.PI / 2);
  const wingMesh = new THREE.Mesh(wingGeo, hullMat);
  wingMesh.position.y = -0.02;
  wingMesh.castShadow = true;
  group.add(wingMesh);

  // 3. Golden Trim Leading Edges & Winglets
  const trimBarGeo = new THREE.BoxGeometry(wingSpan * 1.85, 0.08, 0.16);
  const trimBar = new THREE.Mesh(trimBarGeo, goldTrimMat);
  trimBar.position.set(0, 0.06, 0.25);
  group.add(trimBar);

  const leftWingletGeo = new THREE.BoxGeometry(0.1, 0.52, 0.75);
  const leftWinglet = new THREE.Mesh(leftWingletGeo, goldTrimMat);
  leftWinglet.position.set(-wingSpan + 0.05, 0.2, 0.45);
  leftWinglet.rotation.z = 0.25;
  group.add(leftWinglet);

  const rightWinglet = new THREE.Mesh(leftWingletGeo, goldTrimMat);
  rightWinglet.position.set(wingSpan - 0.05, 0.2, 0.45);
  rightWinglet.rotation.z = -0.25;
  group.add(rightWinglet);

  // 4. Cockpit Canopy
  const canopyGeo = new THREE.CapsuleGeometry(0.28, 0.85, 8, 12);
  canopyGeo.rotateX(Math.PI / 2);
  canopyGeo.scale(1, 0.65, 1);
  const canopyMesh = new THREE.Mesh(canopyGeo, canopyMat);
  canopyMesh.position.set(0, 0.26, -0.25);
  group.add(canopyMesh);

  // 5. Golden DesiDiya Core Emblem & Brand Logo Plate on dorsal spine
  const diyaBaseGeo = new THREE.CylinderGeometry(0.32, 0.22, 0.14, 12);
  const diyaBase = new THREE.Mesh(diyaBaseGeo, goldTrimMat);
  diyaBase.position.set(0, 0.24, 0.55);
  group.add(diyaBase);

  const diyaFlameGeo = new THREE.OctahedronGeometry(0.22, 1);
  const diyaFlameMat = new THREE.MeshStandardMaterial({
    color: 0xfef047,
    emissive: 0xdc2626,
    emissiveIntensity: 1.8,
    roughness: 0.15,
    metalness: 0.2,
  });
  const diyaCoreMesh = new THREE.Mesh(diyaFlameGeo, diyaFlameMat);
  diyaCoreMesh.position.set(0, 0.38, 0.55);
  group.add(diyaCoreMesh);

  // Official DesiDiya crimson & gold dorsal insignia badge
  const insigniaGeo = new THREE.PlaneGeometry(0.95, 0.42);
  insigniaGeo.rotateX(-Math.PI / 2);
  const insigniaMat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  const texLoader = new THREE.TextureLoader();
  texLoader.load(
    '/assets/aistudio/logo_3e12495b.png',
    (logoTex) => {
      logoTex.colorSpace = THREE.SRGBColorSpace;
      insigniaMat.map = logoTex;
      insigniaMat.needsUpdate = true;
    },
    undefined,
    () => {},
  );
  const insigniaMesh = new THREE.Mesh(insigniaGeo, insigniaMat);
  insigniaMesh.position.set(0, 0.19, 0.92);
  group.add(insigniaMesh);

  // 6. Dual Engine Nacelles
  const nacelleGeo = new THREE.CylinderGeometry(0.24, 0.28, 1.35, 12);
  nacelleGeo.rotateX(Math.PI / 2);
  const leftNacelle = new THREE.Mesh(nacelleGeo, hullMat);
  leftNacelle.position.set(-0.52, 0.02, 0.95);
  group.add(leftNacelle);

  const rightNacelle = new THREE.Mesh(nacelleGeo, hullMat);
  rightNacelle.position.set(0.52, 0.02, 0.95);
  group.add(rightNacelle);

  // 7. Glowing Engine Exhaust Flames
  const flameGeo = new THREE.ConeGeometry(0.22, 1.15, 10);
  flameGeo.rotateX(Math.PI / 2);
  const flameMat = new THREE.MeshBasicMaterial({
    color: 0xfde047,
    transparent: true,
    opacity: 0.9,
  });
  const leftFlame = new THREE.Mesh(flameGeo, flameMat);
  leftFlame.position.set(-0.52, 0.02, 1.95);
  group.add(leftFlame);

  const rightFlame = new THREE.Mesh(flameGeo, flameMat);
  rightFlame.position.set(0.52, 0.02, 1.95);
  group.add(rightFlame);

  // 8. Energy Conduits & Weapon Barrels
  const barrelGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.85, 8);
  barrelGeo.rotateX(Math.PI / 2);
  const leftBarrel = new THREE.Mesh(barrelGeo, energyMat);
  leftBarrel.position.set(-0.85, -0.02, -0.65);
  group.add(leftBarrel);

  const rightBarrel = new THREE.Mesh(barrelGeo, energyMat);
  rightBarrel.position.set(0.85, -0.02, -0.65);
  group.add(rightBarrel);

  // 9. Energy Shield Bubble
  const shieldGeo = new THREE.SphereGeometry(1.9, 12, 8);
  const shieldMat = new THREE.MeshBasicMaterial({
    color: 0x38bdf8,
    transparent: true,
    opacity: 0.0,
    wireframe: true,
    depthWrite: false,
  });
  const shieldMesh = new THREE.Mesh(shieldGeo, shieldMat);
  shieldMesh.renderOrder = 5;
  group.add(shieldMesh);

  // Soft radial contact shadow plane underneath ship
  const shadowGeo = new THREE.CircleGeometry(1.6, 16);
  shadowGeo.rotateX(-Math.PI / 2);
  const shadowMat = new THREE.MeshBasicMaterial({
    color: 0x000000,
    transparent: true,
    opacity: 0.35,
    depthWrite: false,
  });
  const shadowDisc = new THREE.Mesh(shadowGeo, shadowMat);
  shadowDisc.position.set(0, -0.65, 0);
  group.add(shadowDisc);

  return { group, shieldMesh, leftFlame, rightFlame, diyaCoreMesh };
}

/**
 * Builds composite 4-7 part 3D Enemy Spacecraft per EnemyType.
 */
export function buildEnemyMesh(type: EnemyType): THREE.Group {
  const group = new THREE.Group();

  const colorMap: Record<EnemyType, { hull: number; accent: number; emissive: number }> = {
    drone: { hull: 0x334155, accent: 0xf97316, emissive: 0xef4444 },
    fast_attack: { hull: 0x1e293b, accent: 0xfacc15, emissive: 0xf59e0b },
    heavy_armor: { hull: 0x3f3f46, accent: 0xef4444, emissive: 0xdc2626 },
    laser_turret: { hull: 0x1e1b4b, accent: 0x38bdf8, emissive: 0x06b6d4 },
    kamikaze: { hull: 0x7f1d1d, accent: 0xfde047, emissive: 0xffedd5 },
    stealth: { hull: 0x0f172a, accent: 0xa855f7, emissive: 0x9333ea },
    battleship: { hull: 0x27272a, accent: 0xf59e0b, emissive: 0xea580c },
    elite_darkness: { hull: 0x09090b, accent: 0x818cf8, emissive: 0x6366f1 },
  };

  const palette = colorMap[type];
  const hullMat = new THREE.MeshStandardMaterial({
    color: palette.hull,
    roughness: 0.65,
    metalness: 0.5,
  });
  const accentMat = new THREE.MeshStandardMaterial({
    color: palette.accent,
    roughness: 0.25,
    metalness: 0.85,
  });
  const coreMat = new THREE.MeshStandardMaterial({
    color: palette.emissive,
    emissive: palette.emissive,
    emissiveIntensity: 1.4,
    roughness: 0.15,
  });

  if (type === 'battleship') {
    // Multi-part heavy dreadnought cruiser
    const mainHull = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.65, 3.2), hullMat);
    group.add(mainHull);
    const bridge = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.55, 1.2), accentMat);
    bridge.position.set(0, 0.48, -0.4);
    group.add(bridge);
    const wingPods = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.3, 1.4), hullMat);
    wingPods.position.set(0, 0, 0.2);
    group.add(wingPods);
    const turretL = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.32, 0.4, 8), coreMat);
    turretL.position.set(-1.1, 0.35, 0.7);
    group.add(turretL);
    const turretR = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.32, 0.4, 8), coreMat);
    turretR.position.set(1.1, 0.35, 0.7);
    group.add(turretR);
  } else if (type === 'laser_turret') {
    // Octagonal orbital platform + rotating ring + central emitter
    const base = new THREE.Mesh(new THREE.CylinderGeometry(1.05, 1.05, 0.35, 8), hullMat);
    group.add(base);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.85, 0.12, 8, 16), accentMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.18;
    group.add(ring);
    const core = new THREE.Mesh(new THREE.SphereGeometry(0.42, 12, 12), coreMat);
    core.position.y = 0.25;
    group.add(core);
  } else if (type === 'heavy_armor') {
    // Bulky twin-pronged gunship
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.55, 2.1), hullMat);
    group.add(body);
    const shieldPlate = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.45, 0.4), accentMat);
    shieldPlate.position.set(0, 0, 0.95);
    group.add(shieldPlate);
    const reactor = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.5, 10), coreMat);
    reactor.position.set(0, 0.2, 0);
    group.add(reactor);
  } else {
    // Sleek forward-pointing enemy fighter (faces +Z toward player)
    const noseGeo = new THREE.ConeGeometry(0.55, 2.0, 5);
    noseGeo.rotateX(Math.PI / 2);
    noseGeo.scale(1, 0.5, 1);
    const nose = new THREE.Mesh(noseGeo, hullMat);
    group.add(nose);

    const wingSpan = type === 'fast_attack' || type === 'elite_darkness' ? 2.1 : 1.55;
    const wings = new THREE.Mesh(new THREE.BoxGeometry(wingSpan, 0.1, 0.65), accentMat);
    wings.position.set(0, 0, -0.2);
    group.add(wings);

    const cockpit = new THREE.Mesh(new THREE.SphereGeometry(0.26, 10, 8), coreMat);
    cockpit.position.set(0, 0.18, 0.15);
    group.add(cockpit);

    const finL = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.45, 0.55), hullMat);
    finL.position.set(-wingSpan * 0.48, 0.15, -0.25);
    group.add(finL);
    const finR = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.45, 0.55), hullMat);
    finR.position.set(wingSpan * 0.48, 0.15, -0.25);
    group.add(finR);
  }

  return group;
}

/**
 * Builds the giant multi-part 3D Planetary Boss dreadnought per PlanetId.
 */
export function buildBossMesh(planetId: PlanetId): {
  group: THREE.Group;
  coreMesh: THREE.Mesh;
  ringMesh: THREE.Mesh;
  shieldDome: THREE.Mesh;
} {
  const cfg = PLANET_MAP[planetId];
  const group = new THREE.Group();

  const hullMat = new THREE.MeshStandardMaterial({
    color: cfg.surfaceHex,
    roughness: 0.55,
    metalness: 0.65,
  });

  const armorMat = new THREE.MeshStandardMaterial({
    color: cfg.atmosphereHex,
    roughness: 0.25,
    metalness: 0.85,
  });

  const coreMat = new THREE.MeshStandardMaterial({
    color: cfg.accentHex,
    emissive: planetId === 'sun' ? 0x9333ea : cfg.atmosphereHex,
    emissiveIntensity: 1.8,
    roughness: 0.12,
  });

  // 1. Massive Central Citadel Hull
  const hullGeo = new THREE.CylinderGeometry(2.4, 2.8, 1.2, 8);
  const hullMesh = new THREE.Mesh(hullGeo, hullMat);
  group.add(hullMesh);

  // 2. Swept Dreadnought Pincer Wings
  const wingGeo = new THREE.BoxGeometry(7.2, 0.55, 2.2);
  const wingMesh = new THREE.Mesh(wingGeo, armorMat);
  wingMesh.position.set(0, -0.05, -0.2);
  group.add(wingMesh);

  // 3. Forward Siege Mandibles (Left & Right)
  const mandibleGeo = new THREE.ConeGeometry(0.65, 2.8, 6);
  mandibleGeo.rotateX(Math.PI / 2);
  const leftMandible = new THREE.Mesh(mandibleGeo, armorMat);
  leftMandible.position.set(-2.6, 0, 1.5);
  group.add(leftMandible);

  const rightMandible = new THREE.Mesh(mandibleGeo, armorMat);
  rightMandible.position.set(2.6, 0, 1.5);
  group.add(rightMandible);

  // 4. Quad Heavy Weapon Turrets
  const turretGeo = new THREE.CylinderGeometry(0.4, 0.5, 0.65, 8);
  [-3.1, -1.5, 1.5, 3.1].forEach((tx) => {
    const turret = new THREE.Mesh(turretGeo, hullMat);
    turret.position.set(tx, 0.45, 0.5);
    group.add(turret);
  });

  // 5. Rotating Energy Halo Ring
  const ringGeo = new THREE.TorusGeometry(2.1, 0.18, 10, 28);
  ringGeo.rotateX(Math.PI / 2);
  const ringMesh = new THREE.Mesh(ringGeo, coreMat);
  ringMesh.position.y = 0.68;
  group.add(ringMesh);

  // 6. Glowing Boss Reactor Core
  const coreGeo = new THREE.OctahedronGeometry(1.05, 1);
  const coreMesh = new THREE.Mesh(coreGeo, coreMat);
  coreMesh.position.set(0, 0.75, 0);
  group.add(coreMesh);

  // 7. Boss Energy Shield Dome (especially prominent for Mission 8 Solar Darkness Titan)
  const shieldGeo = new THREE.SphereGeometry(4.2, 24, 18);
  const shieldMat = new THREE.MeshBasicMaterial({
    color: planetId === 'sun' ? 0xa855f7 : cfg.accentHex,
    transparent: true,
    opacity: 0.0,
    wireframe: true,
    depthWrite: false,
  });
  const shieldDome = new THREE.Mesh(shieldGeo, shieldMat);
  group.add(shieldDome);

  return { group, coreMesh, ringMesh, shieldDome };
}

/**
 * Builds distinct 3D Collectible & Power-Up meshes.
 */
export function buildCollectibleMesh(
  kind: 'coin' | 'crystal' | 'material' | 'powerup',
  powerUpType?: PowerUpType,
): THREE.Group {
  const group = new THREE.Group();

  if (kind === 'coin') {
    const coinGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.12, 16);
    coinGeo.rotateX(Math.PI / 2);
    const coinMat = new THREE.MeshStandardMaterial({
      color: 0xfacc15,
      metalness: 0.9,
      roughness: 0.2,
      emissive: 0xf59e0b,
      emissiveIntensity: 0.5,
    });
    group.add(new THREE.Mesh(coinGeo, coinMat));
    return group;
  }

  if (kind === 'crystal') {
    const crysGeo = new THREE.OctahedronGeometry(0.48, 0);
    const crysMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      metalness: 0.3,
      roughness: 0.15,
      emissive: 0x0284c7,
      emissiveIntensity: 0.9,
    });
    group.add(new THREE.Mesh(crysGeo, crysMat));
    return group;
  }

  if (kind === 'material') {
    const matGeo = new THREE.DodecahedronGeometry(0.45, 0);
    const matMat = new THREE.MeshStandardMaterial({
      color: 0xa855f7,
      metalness: 0.75,
      roughness: 0.25,
      emissive: 0x7e22ce,
      emissiveIntensity: 0.6,
    });
    group.add(new THREE.Mesh(matGeo, matMat));
    return group;
  }

  // Power-up capsule with rotating outer ring
  const ringMat = new THREE.MeshStandardMaterial({
    color: 0xfde047,
    metalness: 0.85,
    roughness: 0.2,
    emissive: 0xf59e0b,
    emissiveIntensity: 0.6,
  });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.08, 8, 18), ringMat);
  ring.rotation.x = Math.PI / 2;
  group.add(ring);

  const coreColor =
    powerUpType === 'repair' || powerUpType === 'extra_life'
      ? 0x10b981
      : powerUpType === 'shield' || powerUpType === 'speed_boost'
        ? 0x38bdf8
        : powerUpType === 'double_damage' || powerUpType === 'mega_bomb'
          ? 0xef4444
          : 0xfacc15;

  const coreMat = new THREE.MeshStandardMaterial({
    color: coreColor,
    emissive: coreColor,
    emissiveIntensity: 1.2,
    roughness: 0.2,
  });
  const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.38, 1), coreMat);
  group.add(core);

  return group;
}
