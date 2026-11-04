import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActiveModalTab, CommandModals } from './components/CommandModals';
import { GameHud } from './components/GameHud';
import { SpaceCanvas, SpaceCanvasHandle } from './components/SpaceCanvas';
import { soundEngine } from './game/audio';
import {
  BRAND_LOGO_URL,
  BRAND_SLOGAN,
  BRAND_TITLE,
  BRAND_URL,
  PLANET_MAP,
  PLANETS,
  SPACESHIP_MAP,
} from './game/campaignData';
import {
  applyMissionVictory,
  computeIlluminationPercentage,
  loadSaveData,
  persistSaveData,
} from './game/rules';
import {
  GameState,
  HudSnapshot,
  MissionOutcome,
  PlanetId,
  SaveData,
} from './game/types';
import { Difficulty, DIFFICULTIES, loadDifficulty, setDifficulty } from './game/difficulty';

const INITIAL_HUD: HudSnapshot = {
  hp: 120,
  maxHp: 120,
  shield: 80,
  maxShield: 80,
  lives: 2,
  score: 0,
  highScore: 0,
  coinsEarned: 0,
  crystalsEarned: 0,
  materialsEarned: 0,
  weaponLevel: 1,
  weaponName: 'Basic Laser Cannon',
  weaponId: 'basic_laser',
  missiles: 3,
  maxMissiles: 3,
  missileCooldown: 0,
  specialCharge: 70,
  shieldSkillCooldown: 0,
  planetId: 'venus',
  planetName: 'VENUS',
  wave: 1,
  totalWaves: 5,
  objectiveText: 'CLEAR ENEMY SQUADRONS (WAVE 1/4)',
  bossActive: false,
  bossName: 'Venus Inferno Destroyer',
  bossHp: 1400,
  bossMaxHp: 1400,
  bossPhase: 1,
  bossShieldHp: 0,
  bossMaxShieldHp: 0,
  activeBuffs: {
    doubleDamageTimer: 0,
    speedBoostTimer: 0,
    invincibilityTimer: 0,
    ultimateSolarTimer: 0,
  },
  enemiesDefeated: 0,
  totalEnemiesSpawned: 0,
  elapsedTime: 0,
  announcement: '',
};

export default function App() {
  const [saveData, setSaveData] = useState<SaveData>(() => loadSaveData());
  const [gameState, setGameState] = useState<GameState>('title');
  const [activeModal, setActiveModal] = useState<ActiveModalTab>('none');
  const [hud, setHud] = useState<HudSnapshot>(INITIAL_HUD);
  const [missionOutcome, setMissionOutcome] = useState<MissionOutcome>('none');
  const [endStats, setEndStats] = useState({
    planetId: 'venus' as PlanetId,
    score: 0,
    coins: 0,
    crystals: 0,
    materials: 0,
    stars: 0,
    clearTime: 0,
    enemiesDefeated: 0,
    bossHpRemaining: 100,
    waveReached: 1,
  });

  // Solar System Illumination animation state (0..100)
  const [illuminationProgress, setIlluminationProgress] = useState<number>(100);
  const canvasRef = useRef<SpaceCanvasHandle | null>(null);
  const [difficulty, setDifficultyState] = useState<Difficulty>(() => loadDifficulty());
  const chooseDifficulty = useCallback((d: Difficulty) => {
    setDifficulty(d);
    setDifficultyState(d);
  }, []);
  const diffCfg = DIFFICULTIES[difficulty];

  const updateSave = useCallback((next: SaveData) => {
    setSaveData(next);
    persistSaveData(next);
  }, []);

  // Sync document.body.dataset.state for ultra-mode verification contract
  useEffect(() => {
    const mappedState =
      gameState === 'illumination' ? 'gameover' : gameState;
    document.body.dataset.state = mappedState;
  }, [gameState]);

  const startPlanetMission = useCallback(
    (planetId: PlanetId) => {
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
      setActiveModal('none');
      setMissionOutcome('none');
      setGameState('playing');
      document.body.dataset.state = 'playing';
      canvasRef.current?.startMission(planetId);
    },
    [],
  );

  // Support ?autostart=1 query param to skip straight to playing
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('autostart') === '1') {
      const timer = window.setTimeout(() => {
        startPlanetMission(saveData.selectedPlanet || 'venus');
      }, 60);
      return () => window.clearTimeout(timer);
    }
  }, []);

  // Animate Solar System Illumination progress from 0 to 100 when entering 'illumination'
  useEffect(() => {
    if (gameState !== 'illumination') return;
    setIlluminationProgress(0);
    soundEngine.playIlluminationFanfare();
    const interval = window.setInterval(() => {
      setIlluminationProgress((prev) => {
        if (prev >= 100) {
          window.clearInterval(interval);
          return 100;
        }
        return prev + 2;
      });
    }, 65);
    return () => window.clearInterval(interval);
  }, [gameState]);

  const handleMissionEnd = useCallback(
    (
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
    ) => {
      setMissionOutcome(outcome);
      setEndStats(stats);

      if (outcome === 'victory') {
        const nextSave = applyMissionVictory(
          saveData,
          stats.planetId,
          stats.score,
          stats.coins,
          stats.crystals,
          stats.materials,
          stats.stars,
        );
        updateSave(nextSave);
        if (stats.planetId === 'sun') {
          setGameState('illumination');
          return;
        }
      }
      setGameState('gameover');
    },
    [saveData, updateSave],
  );

  const handleTogglePause = useCallback(() => {
    setGameState((prev) => {
      if (prev === 'playing') {
        soundEngine.stopMusic();
        return 'paused';
      }
      if (prev === 'paused') {
        soundEngine.startPlanetMusic(saveData.selectedPlanet);
        return 'playing';
      }
      return prev;
    });
  }, [saveData.selectedPlanet]);

  // Auto-pause when the tab/app is hidden (phone lock, app switch)
  useEffect(() => {
    const onVis = () => {
      if (document.hidden) {
        setGameState((prev) => {
          if (prev === 'playing') {
            soundEngine.stopMusic();
            return 'paused';
          }
          return prev;
        });
      }
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  // Block pinch-zoom / double-tap zoom / pull-to-refresh while playing
  useEffect(() => {
    const prevent = (e: Event) => e.preventDefault();
    const onTouchMove = (e: TouchEvent) => {
      if (document.body.dataset.state === 'playing' || e.touches.length > 1) e.preventDefault();
    };
    document.addEventListener('gesturestart', prevent);
    document.addEventListener('dblclick', prevent);
    document.addEventListener('touchmove', onTouchMove, { passive: false });
    return () => {
      document.removeEventListener('gesturestart', prevent);
      document.removeEventListener('dblclick', prevent);
      document.removeEventListener('touchmove', onTouchMove);
    };
  }, []);

  const currentPlanetCfg = PLANET_MAP[saveData.selectedPlanet] ?? PLANET_MAP.venus;
  const currentShipCfg = SPACESHIP_MAP[saveData.selectedShip] ?? SPACESHIP_MAP.tejas_diya;
  const campaignIlluminationPct = computeIlluminationPercentage(saveData.illuminatedPlanets);

  return (
    <main className="relative w-screen h-screen overflow-hidden bg-slate-950 text-slate-100 select-none">
      {/* Persistent 3D WebGL Space Shooter Viewport */}
      <SpaceCanvas
        ref={canvasRef}
        gameState={gameState}
        saveData={saveData}
        illuminationProgress={illuminationProgress}
        onHudUpdate={setHud}
        onMissionEnd={handleMissionEnd}
        onTogglePause={handleTogglePause}
        onStartFromTitle={() => startPlanetMission(saveData.selectedPlanet)}
      />

      {/* STATE 1: TITLE SCREEN (Official DesiDiya Logo + Concise How-To-Play + Unobstructed 3D Showcase) */}
      {gameState === 'title' && (
        <div
          className="dsf-title fixed inset-0 z-10 flex flex-col justify-between p-5 sm:p-9 pointer-events-none overflow-y-auto"
          style={{
            paddingTop: 'max(1.25rem, env(safe-area-inset-top))',
            paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))',
          }}
          data-testid="title-screen"
        >
          {/* Left-Third Brand Lockup & Quick-Start Guide */}
          <div className="max-w-md pointer-events-auto my-auto space-y-4">
            {/* Official DesiDiya Brand Logo + Sky Fighter Title */}
            <div className="space-y-2">
              <img
                src={BRAND_LOGO_URL}
                alt="DesiDiya - Naye Bharat ki Roshani"
                referrerPolicy="no-referrer"
                className="h-20 sm:h-24 w-auto object-contain drop-shadow-lg"
                data-testid="desidiya-brand-logo"
              />
              <h1 className="text-2xl sm:text-3xl font-bold tracking-wider text-white">
                SKY FIGHTER 3D
              </h1>
            </div>

            {/* Brief Game Info & How to Play Starter Box */}
            <div
              className="rounded-xl p-3.5 border border-amber-500/35 space-y-2"
              style={{ backgroundColor: 'rgba(10, 15, 32, 0.86)' }}
              data-testid="starter-howto-box"
            >
              <div className="flex items-center justify-between text-xs font-mono text-amber-300">
                <span>HOW TO PLAY · QUICK BRIEF</span>
                <span>SECTOR 0{currentPlanetCfg.order}: {currentPlanetCfg.name}</span>
              </div>
              <p className="text-xs text-slate-200 leading-relaxed">
                Fly the <strong className="text-amber-300">{currentShipCfg.name}</strong> across 8 Solar System planets, defeat each Planet Boss, and ignite the Sun for 100% Illumination.
              </p>
              <div className="grid grid-cols-2 gap-1.5 text-[11px] text-slate-300 pt-1 border-t border-slate-800/90">
                <div>• <strong>Move:</strong> Drag or WASD/Arrows</div>
                <div>• <strong>Shoot:</strong> Auto-Fire / Space</div>
                <div>• <strong>Missiles:</strong> Tap [X] Button</div>
                <div>• <strong>Diya Nova:</strong> Tap [Shift] at 100%</div>
              </div>
            </div>

            {/* Difficulty Mode Selector (remembered in localStorage) */}
            <div className="space-y-1.5" data-testid="difficulty-selector">
              <div className="text-[11px] font-mono text-amber-300 tracking-wider">
                DIFFICULTY · {diffCfg.hint}
              </div>
              <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Difficulty">
                {(['easy', 'medium', 'hard'] as Difficulty[]).map((d) => {
                  const active = d === difficulty;
                  const tone =
                    d === 'easy' ? '#10B981' : d === 'medium' ? '#F59E0B' : '#EF4444';
                  return (
                    <button
                      key={d}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      data-difficulty={d}
                      onClick={() => chooseDifficulty(d)}
                      className="py-2.5 rounded-xl border text-sm font-bold tracking-wide transition-all cursor-pointer"
                      style={{
                        borderColor: active ? tone : 'rgba(100,116,139,0.6)',
                        color: active ? '#0b1020' : '#e2e8f0',
                        backgroundColor: active ? tone : 'rgba(8, 12, 26, 0.9)',
                        boxShadow: active ? `0 0 18px ${tone}88` : 'none',
                      }}
                    >
                      {DIFFICULTIES[d].label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Primary Actions (<= 3 Clean Buttons: Play, How to Play, More) */}
            <div className="flex flex-wrap items-center gap-2.5 pt-1">
              <button
                type="button"
                data-start="true"
                onClick={(e) => {
                  e.currentTarget.blur();
                  startPlanetMission(saveData.selectedPlanet);
                }}
                className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-base sm:text-sm tracking-wide transition-colors whitespace-nowrap shrink-0 cursor-pointer shadow-lg shadow-amber-500/30"
              >
                Launch {currentPlanetCfg.name} Mission
              </button>

              <button
                type="button"
                onClick={() => setActiveModal('howto')}
                className="px-4 py-3 rounded-xl border border-amber-500/45 text-amber-200 hover:bg-amber-500/15 font-semibold text-xs transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                style={{ backgroundColor: 'rgba(8, 12, 26, 0.9)' }}
              >
                How to Play
              </button>

              <button
                type="button"
                onClick={() => setActiveModal('map')}
                className="px-4 py-3 rounded-xl border border-slate-700 text-slate-200 hover:bg-slate-800 font-semibold text-xs transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                style={{ backgroundColor: 'rgba(8, 12, 26, 0.9)' }}
              >
                More (Map, Hangar & Shop)
              </button>
            </div>
          </div>

          {/* Bottom Safe Margin: Flat Inline Status & Official Website Link */}
          <div className="flex flex-wrap items-center justify-between gap-4 text-xs text-slate-400 pointer-events-auto">
            <span>
              Solar Illumination {campaignIlluminationPct}% · {saveData.coins} Coins · {saveData.crystals} Crystals
            </span>
            <a
              href={BRAND_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-amber-400/90 hover:text-amber-300 transition-colors"
            >
              {BRAND_TITLE} · desidiya.com
            </a>
          </div>
        </div>
      )}

      {/* STATE 2: PLAYING HUD */}
      {gameState === 'playing' && (
        <GameHud
          hud={hud}
          soundEnabled={saveData.soundEnabled}
          onToggleSound={() => {
            const next = !saveData.soundEnabled;
            soundEngine.setSettings(next, saveData.musicEnabled);
            updateSave({ ...saveData, soundEnabled: next });
          }}
          onPause={handleTogglePause}
          onFireMissile={() => canvasRef.current?.fireMissileVolley()}
          onTriggerNova={() => canvasRef.current?.triggerDiyaNova()}
          onActivateShield={() => canvasRef.current?.activateEmergencyShield()}
          onCycleWeapon={() => canvasRef.current?.cycleWeapon()}
          onSummonBoss={() => canvasRef.current?.triggerBossWaveNow()}
        />
      )}

      {/* STATE 3: PAUSED MODAL */}
      {gameState === 'paused' && (
        <div
          className="fixed inset-0 z-20 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(4, 7, 18, 0.82)' }}
          role="dialog"
          aria-modal="true"
          aria-label="Mission Paused"
        >
          <div
            className="w-full max-w-md rounded-2xl border border-amber-500/40 p-6 text-center space-y-4"
            style={{
              backgroundColor: 'rgba(10, 15, 32, 0.96)',
              boxShadow: '0 24px 60px rgba(0, 0, 0, 0.85)',
            }}
          >
            <img
              src={BRAND_LOGO_URL}
              alt="DesiDiya"
              referrerPolicy="no-referrer"
              className="h-12 w-auto object-contain mx-auto"
            />
            <div>
              <div className="text-xs font-mono text-amber-400 uppercase">
                SECTOR {hud.planetName} · WAVE {hud.wave}/{hud.totalWaves} · {diffCfg.label.toUpperCase()}
              </div>
              <h2 className="text-2xl font-bold text-white mt-0.5">MISSION PAUSED</h2>
            </div>

            <div className="grid grid-cols-3 gap-2 py-3 border-y border-slate-800 font-mono tabular-nums">
              <div>
                <div className="text-[10px] text-slate-400">SCORE</div>
                <div className="text-base font-bold text-amber-300">{hud.score}</div>
              </div>
              <div>
                <div className="text-[10px] text-slate-400">HULL HP</div>
                <div className="text-base font-bold text-emerald-400">
                  {hud.hp}/{hud.maxHp}
                </div>
              </div>
              <div>
                <div className="text-[10px] text-slate-400">COINS</div>
                <div className="text-base font-bold text-sky-300">{hud.coinsEarned}</div>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={handleTogglePause}
                className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm transition-colors cursor-pointer"
              >
                Resume Mission
              </button>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setActiveModal('howto')}
                  className="py-2 rounded-xl border border-amber-500/40 text-xs font-semibold text-amber-200 hover:bg-amber-500/15 cursor-pointer"
                >
                  How to Play
                </button>
                <button
                  type="button"
                  onClick={() => setActiveModal('shop')}
                  className="py-2 rounded-xl border border-sky-500/40 text-xs font-semibold text-sky-200 hover:bg-sky-500/15 cursor-pointer"
                >
                  Upgrades & Hangar
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => startPlanetMission(hud.planetId)}
                  className="py-2 rounded-xl border border-slate-700 text-xs font-semibold text-slate-200 hover:bg-slate-800 cursor-pointer"
                >
                  Restart Mission
                </button>
                <button
                  type="button"
                  onClick={() => {
                    soundEngine.stopMusic();
                    setGameState('title');
                  }}
                  className="py-2 rounded-xl border border-slate-700 text-xs font-semibold text-slate-300 hover:bg-slate-800 cursor-pointer"
                >
                  Return to Title
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* STATE 4: VICTORY OR DEFEAT MODAL ('gameover') */}
      {gameState === 'gameover' && (
        <div
          className="fixed inset-0 z-20 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(4, 7, 18, 0.85)' }}
          role="dialog"
          aria-modal="true"
          aria-label={missionOutcome === 'victory' ? 'Mission Complete' : 'Mission Failed'}
        >
          <div
            className="w-full max-w-lg rounded-2xl border border-amber-500/45 p-6 text-center space-y-5"
            style={{
              backgroundColor: 'rgba(10, 15, 32, 0.97)',
              boxShadow: '0 24px 64px rgba(0, 0, 0, 0.9)',
            }}
          >
            <img
              src={BRAND_LOGO_URL}
              alt="DesiDiya"
              referrerPolicy="no-referrer"
              className="h-12 w-auto object-contain mx-auto"
            />
            {missionOutcome === 'victory' ? (
              <>
                <div>
                  <div className="text-xs font-mono text-amber-400 uppercase">
                    SECTOR ILLUMINATED · {PLANET_MAP[endStats.planetId].name}
                  </div>
                  <h2 className="text-2xl sm:text-3xl font-bold text-white mt-1">
                    MISSION ACCOMPLISHED!
                  </h2>
                  <div className="text-2xl text-amber-400 tracking-widest mt-1">
                    {'★'.repeat(endStats.stars)}
                    {'☆'.repeat(3 - endStats.stars)}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3 py-3 border-y border-slate-800 font-mono tabular-nums">
                  <div>
                    <div className="text-[10px] text-slate-400">FINAL SCORE</div>
                    <div className="text-base font-bold text-amber-300">
                      {endStats.score + PLANET_MAP[endStats.planetId].rewardCoins * 5}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-400">CLEAR TIME</div>
                    <div className="text-base font-bold text-sky-300">
                      {endStats.clearTime}s
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-400">REWARD COINS</div>
                    <div className="text-base font-bold text-emerald-400">
                      +{endStats.coins + PLANET_MAP[endStats.planetId].rewardCoins}
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-2.5">
                  {(() => {
                    const idx = PLANETS.findIndex((p) => p.id === endStats.planetId);
                    const nextPlanet =
                      idx >= 0 && idx + 1 < PLANETS.length ? PLANETS[idx + 1] : null;
                    return nextPlanet ? (
                      <button
                        type="button"
                        data-start="true"
                        onClick={() => {
                          updateSave({ ...saveData, selectedPlanet: nextPlanet.id });
                          startPlanetMission(nextPlanet.id);
                        }}
                        className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm cursor-pointer"
                      >
                        Launch Next Sector: {nextPlanet.name}
                      </button>
                    ) : null;
                  })()}

                  <button
                    type="button"
                    onClick={() => setGameState('illumination')}
                    className="w-full py-2.5 rounded-xl border border-amber-400/50 text-amber-200 hover:bg-amber-500/20 font-semibold text-xs cursor-pointer"
                  >
                    Celebrate Solar System Illumination ({campaignIlluminationPct}%)
                  </button>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setActiveModal('shop')}
                      className="py-2.5 rounded-xl border border-slate-700 text-xs font-semibold text-slate-200 hover:bg-slate-800 cursor-pointer"
                    >
                      Upgrade Spacecraft
                    </button>
                    <button
                      type="button"
                      onClick={() => setGameState('title')}
                      className="py-2.5 rounded-xl border border-slate-700 text-xs font-semibold text-slate-300 hover:bg-slate-800 cursor-pointer"
                    >
                      Main Menu
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <>
                <div>
                  <div className="text-xs font-mono text-red-400 uppercase">
                    HULL BREACHED · {PLANET_MAP[endStats.planetId].name} SECTOR · {diffCfg.label.toUpperCase()}
                  </div>
                  <h2 className="text-2xl sm:text-3xl font-bold text-white mt-1">
                    SPACECRAFT DESTROYED
                  </h2>
                  <p className="text-xs text-slate-400 mt-1">
                    Upgrade your Diya Core shields and firepower to break through the blockade.
                  </p>
                </div>

                <div className="grid grid-cols-3 gap-3 py-3 border-y border-slate-800 font-mono tabular-nums">
                  <div>
                    <div className="text-[10px] text-slate-400">WAVE REACHED</div>
                    <div className="text-base font-bold text-amber-300">
                      {endStats.waveReached} / 5
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-400">BOSS HP LEFT</div>
                    <div className="text-base font-bold text-red-400">
                      {endStats.bossHpRemaining}%
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-400">SCORE</div>
                    <div className="text-base font-bold text-sky-300">
                      {endStats.score}
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-2.5">
                  <button
                    type="button"
                    data-start="true"
                    onClick={() => startPlanetMission(endStats.planetId)}
                    className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm cursor-pointer"
                  >
                    Try Again ({PLANET_MAP[endStats.planetId].name})
                  </button>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setActiveModal('shop')}
                      className="py-2.5 rounded-xl border border-amber-500/40 text-xs font-semibold text-amber-200 hover:bg-amber-500/15 cursor-pointer"
                    >
                      Upgrade Ship
                    </button>
                    <button
                      type="button"
                      onClick={() => setGameState('title')}
                      className="py-2.5 rounded-xl border border-slate-700 text-xs font-semibold text-slate-300 hover:bg-slate-800 cursor-pointer"
                    >
                      Main Menu
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* STATE 5: GRAND FINALE — SOLAR SYSTEM 100% ILLUMINATION */}
      {gameState === 'illumination' && (
        <div
          className="fixed inset-0 z-20 pointer-events-none flex flex-col justify-between p-5 sm:p-8"
          data-testid="illumination-screen"
        >
          {/* Top Grand Banner with Official DesiDiya Logo */}
          <div className="flex flex-col items-center text-center mx-auto max-w-xl pointer-events-auto">
            <div
              className="rounded-2xl px-5 py-3.5 border border-amber-400/60"
              style={{
                backgroundColor: 'rgba(12, 10, 4, 0.88)',
                boxShadow: '0 16px 48px rgba(245, 158, 11, 0.35)',
              }}
            >
              <img
                src={BRAND_LOGO_URL}
                alt="DesiDiya Logo"
                referrerPolicy="no-referrer"
                className="h-12 sm:h-14 w-auto object-contain mx-auto mb-1"
              />
              <h1 className="text-xl sm:text-3xl font-bold text-amber-300 tracking-wide">
                SOLAR SYSTEM {illuminationProgress}% ILLUMINATED
              </h1>

              {/* Progress Bar */}
              <div className="w-full h-2.5 rounded-full bg-slate-900 overflow-hidden border border-amber-400/50 mt-2">
                <div
                  className="h-full bg-amber-400 transition-all duration-100"
                  style={{ width: `${illuminationProgress}%` }}
                />
              </div>

              {/* 8 Illuminated Celestial Beacons */}
              <div className="flex flex-wrap items-center justify-center gap-2 text-[10px] sm:text-[11px] font-mono text-amber-200 mt-2">
                <span>SUN: IGNITED</span>
                {PLANETS.filter((p) => p.id !== 'sun').map((p, idx) => {
                  const threshold = ((idx + 1) / 8) * 95;
                  const lit = illuminationProgress >= threshold;
                  return (
                    <React.Fragment key={p.id}>
                      <span aria-hidden="true">·</span>
                      <span className={lit ? 'text-amber-300 font-bold' : 'text-slate-500'}>
                        {p.name} {lit ? '★' : '○'}
                      </span>
                    </React.Fragment>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Bottom Victory Footer & Navigation */}
          <div className="flex flex-wrap items-center justify-center gap-3 pointer-events-auto">
            <button
              type="button"
              data-start="true"
              onClick={() => startPlanetMission(saveData.selectedPlanet)}
              className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs sm:text-sm cursor-pointer"
            >
              Launch Next Sortie
            </button>
            <button
              type="button"
              onClick={() => setActiveModal('map')}
              className="px-4 py-2.5 rounded-xl border border-amber-400/50 text-amber-200 hover:bg-amber-500/20 font-semibold text-xs sm:text-sm cursor-pointer"
              style={{ backgroundColor: 'rgba(10, 14, 28, 0.9)' }}
            >
              Solar System Map
            </button>
            <button
              type="button"
              onClick={() => setGameState('title')}
              className="px-4 py-2.5 rounded-xl border border-slate-700 text-slate-200 hover:bg-slate-800 font-semibold text-xs sm:text-sm cursor-pointer"
              style={{ backgroundColor: 'rgba(10, 14, 28, 0.9)' }}
            >
              Main Menu
            </button>
          </div>
        </div>
      )}

      {/* Command Deck Modals (How to Play, Solar System Map, Hangar, Upgrade Shop, Settings/Lyria) */}
      <CommandModals
        activeTab={activeModal}
        saveData={saveData}
        onSelectTab={setActiveModal}
        onClose={() => setActiveModal('none')}
        onUpdateSave={updateSave}
        onLaunchPlanet={(pid) => startPlanetMission(pid)}
        onOpenIlluminationFinale={() => {
          setActiveModal('none');
          setGameState('illumination');
        }}
      />
    </main>
  );
}
