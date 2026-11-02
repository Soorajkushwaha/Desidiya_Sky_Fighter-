import React, { useState } from 'react';
import { soundEngine } from '../game/audio';
import {
  BRAND_LOGO_URL,
  BRAND_SLOGAN,
  BRAND_URL,
  PLANETS,
  SPACESHIPS,
  WEAPONS,
} from '../game/campaignData';
import {
  applyUpgrade,
  canAffordUpgrade,
  canClaimDailyReward,
  claimDailyReward,
  computeIlluminationPercentage,
  getUpgradeCost,
} from '../game/rules';
import {
  GraphicsQuality,
  PlanetId,
  SaveData,
  SpaceshipId,
  UpgradeStats,
  WeaponId,
} from '../game/types';

export type ActiveModalTab = 'none' | 'howto' | 'map' | 'hangar' | 'shop' | 'settings';

interface CommandModalsProps {
  activeTab: ActiveModalTab;
  saveData: SaveData;
  onSelectTab: (tab: ActiveModalTab) => void;
  onClose: () => void;
  onUpdateSave: (next: SaveData) => void;
  onLaunchPlanet: (planetId: PlanetId) => void;
  onOpenIlluminationFinale: () => void;
}

export const CommandModals: React.FC<CommandModalsProps> = ({
  activeTab,
  saveData,
  onSelectTab,
  onClose,
  onUpdateSave,
  onLaunchPlanet,
  onOpenIlluminationFinale,
}) => {
  const [lyriaPrompt, setLyriaPrompt] = useState(
    'Epic Indian cinematic space shooter soundtrack with golden sitar motifs, driving synth arpeggios, and orchestral percussion',
  );
  const [lyriaModel, setLyriaModel] = useState<'lyria-3-clip-preview' | 'lyria-3-pro-preview'>(
    'lyria-3-clip-preview',
  );
  const [lyriaLoading, setLyriaLoading] = useState(false);
  const [lyriaStatus, setLyriaStatus] = useState('');
  const [dailyNotice, setDailyNotice] = useState('');

  if (activeTab === 'none') return null;

  const todayIso = new Date().toISOString().slice(0, 10);
  const dailyAvailable = canClaimDailyReward(saveData, todayIso);
  const illuminationPct = computeIlluminationPercentage(saveData.illuminatedPlanets);

  const handleGenerateMusic = async () => {
    setLyriaLoading(true);
    setLyriaStatus('Composing space battle soundtrack via Lyria AI...');
    try {
      const res = await fetch('/api/music/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: lyriaPrompt,
          model: lyriaModel,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setLyriaStatus(data.error || 'Could not generate track. Using procedural Diya synth.');
      } else if (data.audioDataUrl) {
        soundEngine.playCustomLyriaTrack(data.audioDataUrl);
        setLyriaStatus('Custom Lyria AI battle track active and looping!');
      }
    } catch (err) {
      setLyriaStatus(
        err instanceof Error ? err.message : 'Network error connecting to music service.',
      );
    } finally {
      setLyriaLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center p-3 sm:p-4 pointer-events-auto"
      style={{ backgroundColor: 'rgba(4, 7, 18, 0.85)' }}
      role="dialog"
      aria-modal="true"
      aria-label="Command Deck Modal"
    >
      <div
        className="w-full max-w-4xl max-h-[88vh] flex flex-col rounded-2xl border border-amber-500/40 overflow-hidden text-slate-100"
        style={{
          backgroundColor: 'rgba(10, 15, 32, 0.98)',
          boxShadow: '0 24px 64px rgba(0, 0, 0, 0.85)',
        }}
      >
        {/* Modal Header + Official DesiDiya Logo + Segmented Tab Bar */}
        <div className="px-5 py-3.5 border-b border-slate-800 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <img
                src={BRAND_LOGO_URL}
                alt="DesiDiya Logo"
                referrerPolicy="no-referrer"
                className="h-10 w-auto object-contain shrink-0"
              />
              <div>
                <h2 className="text-lg sm:text-xl font-bold tracking-wide text-amber-300">
                  {activeTab === 'howto' && 'HOW TO PLAY & MISSION GUIDE'}
                  {activeTab === 'map' && 'SOLAR SYSTEM CAMPAIGN MAP'}
                  {activeTab === 'hangar' && 'DESIDIYA SPACESHIP HANGAR & ARMORY'}
                  {activeTab === 'shop' && 'DIYA CORE UPGRADE WORKSHOP'}
                  {activeTab === 'settings' && 'SETTINGS & LYRIA SOUNDTRACK STUDIO'}
                </h2>
                <p className="text-xs text-slate-400">
                  {BRAND_SLOGAN} · Illumination: {illuminationPct}%
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2.5 text-xs font-mono tabular-nums text-slate-200">
                <span className="text-amber-400 font-bold">{saveData.coins} Coins</span>
                <span aria-hidden="true">·</span>
                <span className="text-sky-400 font-bold">{saveData.crystals} Crystals</span>
                <span aria-hidden="true">·</span>
                <span className="text-purple-400 font-bold">{saveData.materials} Alloy</span>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-1.5 rounded-lg border border-slate-700 text-xs font-semibold text-slate-200 hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>

          {/* Interactive Tab Switcher */}
          <div className="flex flex-wrap items-center gap-1.5 p-1 rounded-xl bg-slate-950 border border-slate-800">
            {(
              [
                { id: 'howto', label: 'How to Play & Info' },
                { id: 'map', label: 'Solar System Map' },
                { id: 'hangar', label: 'Spaceship Hangar' },
                { id: 'shop', label: 'Upgrades' },
                { id: 'settings', label: 'Settings & Audio' },
              ] as Array<{ id: ActiveModalTab; label: string }>
            ).map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => onSelectTab(t.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                  activeTab === t.id
                    ? 'bg-amber-500 text-slate-950'
                    : 'text-slate-300 hover:text-white hover:bg-slate-900'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
          {/* TAB 0: HOW TO PLAY & MISSION GUIDE */}
          {activeTab === 'howto' && (
            <div className="space-y-5">
              <div className="p-4 rounded-xl border border-amber-500/35 bg-slate-900/90 flex flex-col sm:flex-row items-center gap-4">
                <img
                  src={BRAND_LOGO_URL}
                  alt="DesiDiya Brand Logo"
                  referrerPolicy="no-referrer"
                  className="h-16 w-auto object-contain shrink-0"
                />
                <div>
                  <h3 className="text-base font-bold text-amber-300">
                    Welcome to DesiDiya Sky Fighter — Light Up the Solar System!
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-300 mt-1 leading-relaxed">
                    A Darkness Core has eclipsed our Solar System. Pilot the futuristic{' '}
                    <strong className="text-white">DesiDiya Sky Fighter</strong> powered by the golden{' '}
                    <strong className="text-amber-300">Diya Core</strong>, defeat planetary bosses from Venus to Neptune, and awaken the Sun!
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl border border-slate-800 bg-slate-950/90 space-y-2">
                  <div className="text-xs font-mono text-amber-400">01. FLIGHT & CONTROLS</div>
                  <h4 className="text-base font-bold text-white">Mobile Touch & Desktop Keys</h4>
                  <ul className="text-xs text-slate-300 space-y-1.5 leading-relaxed">
                    <li>
                      • <strong>Move Spaceship:</strong> Touch and drag anywhere on the screen (Mobile) or press <strong>WASD / Arrow Keys</strong> (Desktop).
                    </li>
                    <li>
                      • <strong>Primary Lasers:</strong> Fires automatically by default (or hold <strong>Spacebar</strong>).
                    </li>
                    <li>
                      • <strong>Homing Missiles [X]:</strong> Tap the bottom-right <strong>Missile</strong> button or press <strong>X</strong> to launch target-seeking warheads.
                    </li>
                    <li>
                      • <strong>Diya Solar Nova [Shift]:</strong> At 100% charge, tap <strong>Nova</strong> or press <strong>Shift</strong> to unleash a golden shockwave that clears enemy fire.
                    </li>
                    <li>
                      • <strong>Aegis Shield [C]:</strong> Tap <strong>Shield</strong> or press <strong>C</strong> for emergency shield recovery and brief invincibility.
                    </li>
                  </ul>
                </div>

                <div className="p-4 rounded-xl border border-slate-800 bg-slate-950/90 space-y-2">
                  <div className="text-xs font-mono text-sky-400">02. PROGRESSION & BOSS BATTLES</div>
                  <h4 className="text-base font-bold text-white">Upgrades, Power-Ups & Illumination</h4>
                  <ul className="text-xs text-slate-300 space-y-1.5 leading-relaxed">
                    <li>
                      • <strong>4 Squadron Waves + 1 Giant Boss:</strong> Clear 4 waves of enemy formations and asteroids, then defeat the planet's 3-phase Boss Dreadnought.
                    </li>
                    <li>
                      • <strong>Collectibles & 10 Power-Ups:</strong> Grab golden Coins, cyan Energy Crystals, and glowing Power-Up orbs (Weapon Tier Up, Repair, Double Damage, Mega Bomb, Extra Life).
                    </li>
                    <li>
                      • <strong>Clean Gameplay View:</strong> During battle, tap the small <strong>"More"</strong> button at the top-right anytime to inspect detailed mission stats or skip straight to the Boss.
                    </li>
                    <li>
                      • <strong>Final Goal:</strong> Complete all 8 missions to trigger the <strong>Solar System 100% Illuminated</strong> celebration!
                    </li>
                  </ul>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => onLaunchPlanet(saveData.selectedPlanet)}
                  className="px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs sm:text-sm cursor-pointer"
                >
                  Start Playing Now ({saveData.selectedPlanet.toUpperCase()})
                </button>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onSelectTab('map')}
                    className="px-4 py-2 rounded-xl border border-amber-500/40 text-xs font-semibold text-amber-200 hover:bg-amber-500/15 cursor-pointer"
                  >
                    Explore Solar System Map
                  </button>
                  <button
                    type="button"
                    onClick={() => onSelectTab('hangar')}
                    className="px-4 py-2 rounded-xl border border-slate-700 text-xs font-semibold text-slate-200 hover:bg-slate-800 cursor-pointer"
                  >
                    Open Spaceship Hangar
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 1: SOLAR SYSTEM CAMPAIGN MAP */}
          {activeTab === 'map' && (
            <div className="space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl border border-amber-500/30 bg-slate-900/90">
                <div>
                  <div className="text-xs font-semibold text-amber-400 uppercase">
                    CAMPAIGN OBJECTIVE: LIGHT UP THE SOLAR SYSTEM
                  </div>
                  <div className="text-sm text-slate-300 mt-0.5">
                    Defeat each planetary boss to ignite its orbital Diya beacon and unlock Mission 8: Awaken The Sun.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onOpenIlluminationFinale}
                  className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs whitespace-nowrap transition-colors cursor-pointer"
                >
                  View 3D Solar System Illumination ({illuminationPct}%)
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {PLANETS.map((planet) => {
                  const isUnlocked = saveData.unlockedPlanets.includes(planet.id);
                  const isIlluminated = saveData.illuminatedPlanets.includes(planet.id);
                  const stars = saveData.planetStars[planet.id] ?? 0;
                  const best = saveData.planetBestScores[planet.id] ?? 0;
                  const isSelected = saveData.selectedPlanet === planet.id;

                  return (
                    <div
                      key={planet.id}
                      className={`p-4 rounded-xl border transition-colors flex flex-col justify-between ${
                        isSelected
                          ? 'border-amber-400 bg-slate-900'
                          : 'border-slate-800 bg-slate-950/80'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className="text-xs font-mono text-amber-400">
                            MISSION 0{planet.order} · {isIlluminated ? 'ILLUMINATED' : isUnlocked ? 'READY' : 'LOCKED'}
                          </span>
                          <span className="text-xs font-mono text-amber-300">
                            {'★'.repeat(stars)}
                            {'☆'.repeat(3 - stars)}
                          </span>
                        </div>
                        <h3 className="text-lg font-bold text-white flex items-center gap-2">
                          <span
                            className="inline-block w-3 h-3 rounded-full"
                            style={{ backgroundColor: planet.primaryColor }}
                          />
                          {planet.name} — {planet.subtitle}
                        </h3>
                        <p className="text-xs text-slate-300 mt-1">{planet.environmentDesc}</p>
                        <div className="text-xs text-slate-400 mt-2">
                          Boss: <strong className="text-red-300">{planet.bossName}</strong> · Reward: {planet.rewardCoins} Coins · Best: {best}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 mt-4 pt-3 border-t border-slate-800/80">
                        <button
                          type="button"
                          onClick={() => {
                            onUpdateSave({
                              ...saveData,
                              selectedPlanet: planet.id,
                              unlockedPlanets: isUnlocked
                                ? saveData.unlockedPlanets
                                : [...saveData.unlockedPlanets, planet.id],
                            });
                            onLaunchPlanet(planet.id);
                          }}
                          className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition-colors cursor-pointer"
                        >
                          {isUnlocked ? `Launch ${planet.name} Mission` : `Unlock & Play ${planet.name}`}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 2: SPACESHIP HANGAR & WEAPON ARMORY */}
          {activeTab === 'hangar' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-base font-bold text-amber-300 mb-3">
                  01. Select or Unlock DesiDiya Sky Fighter Spacecraft
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {SPACESHIPS.map((ship) => {
                    const owned = saveData.unlockedShips.includes(ship.id);
                    const equipped = saveData.selectedShip === ship.id;
                    const canBuy =
                      saveData.coins >= ship.unlockCostCoins &&
                      saveData.crystals >= ship.unlockCostCrystals;

                    return (
                      <div
                        key={ship.id}
                        className={`p-4 rounded-xl border flex flex-col justify-between ${
                          equipped
                            ? 'border-amber-400 bg-slate-900'
                            : 'border-slate-800 bg-slate-950/80'
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between text-xs text-amber-400 font-mono mb-1">
                            <span>{ship.tagline}</span>
                            <span>{equipped ? 'EQUIPPED' : owned ? 'OWNED' : 'LOCKED'}</span>
                          </div>
                          <h4 className="text-lg font-bold text-white">{ship.name}</h4>
                          <p className="text-xs text-slate-300 mt-1">{ship.description}</p>
                          <div className="flex items-center gap-3 text-xs font-mono tabular-nums text-slate-400 mt-3">
                            <span>HP {ship.baseHp}</span>
                            <span aria-hidden="true">·</span>
                            <span>Shield {ship.baseShield}</span>
                            <span aria-hidden="true">·</span>
                            <span>Speed {ship.baseSpeed}</span>
                            <span aria-hidden="true">·</span>
                            <span>Power {ship.baseFirePower}x</span>
                          </div>
                        </div>

                        <div className="mt-4 pt-3 border-t border-slate-800">
                          {owned ? (
                            <button
                              type="button"
                              disabled={equipped}
                              onClick={() =>
                                onUpdateSave({
                                  ...saveData,
                                  selectedShip: ship.id as SpaceshipId,
                                })
                              }
                              className={`px-4 py-2 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                                equipped
                                  ? 'bg-emerald-600/30 text-emerald-200 border border-emerald-500/40'
                                  : 'bg-amber-500 hover:bg-amber-400 text-slate-950'
                              }`}
                            >
                              {equipped ? 'Active Spacecraft' : 'Equip Spacecraft'}
                            </button>
                          ) : (
                            <button
                              type="button"
                              disabled={!canBuy}
                              onClick={() => {
                                if (!canBuy) return;
                                soundEngine.playPickup(true);
                                onUpdateSave({
                                  ...saveData,
                                  coins: saveData.coins - ship.unlockCostCoins,
                                  crystals: saveData.crystals - ship.unlockCostCrystals,
                                  unlockedShips: [...saveData.unlockedShips, ship.id],
                                  selectedShip: ship.id,
                                });
                              }}
                              className={`px-4 py-2 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                                canBuy
                                  ? 'bg-sky-500 hover:bg-sky-400 text-slate-950'
                                  : 'bg-slate-800 text-slate-500'
                              }`}
                            >
                              Unlock ({ship.unlockCostCoins} Coins · {ship.unlockCostCrystals} Crystals)
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div>
                <h3 className="text-base font-bold text-amber-300 mb-3">
                  02. Primary Weapon Systems (8 Tiers)
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {WEAPONS.map((wep) => {
                    const owned = saveData.unlockedWeapons.includes(wep.id);
                    const equipped = saveData.selectedWeapon === wep.id;
                    const canBuy =
                      saveData.coins >= wep.unlockCoins &&
                      saveData.crystals >= wep.unlockCrystals;

                    return (
                      <div
                        key={wep.id}
                        className={`p-3.5 rounded-xl border flex flex-col justify-between ${
                          equipped
                            ? 'border-amber-400 bg-slate-900'
                            : 'border-slate-800 bg-slate-950/80'
                        }`}
                      >
                        <div>
                          <div className="text-[11px] font-mono text-amber-400">
                            TIER 0{wep.level}
                          </div>
                          <h4 className="text-sm font-bold text-white mt-0.5">{wep.name}</h4>
                          <p className="text-xs text-slate-400 mt-1">{wep.description}</p>
                        </div>

                        <div className="mt-3 pt-2 border-t border-slate-800">
                          {owned ? (
                            <button
                              type="button"
                              onClick={() =>
                                onUpdateSave({
                                  ...saveData,
                                  selectedWeapon: wep.id as WeaponId,
                                  weaponLevel: wep.level,
                                })
                              }
                              className={`w-full py-1.5 rounded text-xs font-bold cursor-pointer ${
                                equipped
                                  ? 'bg-emerald-600/30 text-emerald-200 border border-emerald-500/40'
                                  : 'bg-amber-500 hover:bg-amber-400 text-slate-950'
                              }`}
                            >
                              {equipped ? 'Equipped' : 'Equip Weapon'}
                            </button>
                          ) : (
                            <button
                              type="button"
                              disabled={!canBuy}
                              onClick={() => {
                                if (!canBuy) return;
                                soundEngine.playPickup(true);
                                onUpdateSave({
                                  ...saveData,
                                  coins: saveData.coins - wep.unlockCoins,
                                  crystals: saveData.crystals - wep.unlockCrystals,
                                  unlockedWeapons: [...saveData.unlockedWeapons, wep.id],
                                  selectedWeapon: wep.id,
                                  weaponLevel: wep.level,
                                });
                              }}
                              className={`w-full py-1.5 rounded text-xs font-bold cursor-pointer ${
                                canBuy
                                  ? 'bg-sky-500 hover:bg-sky-400 text-slate-950'
                                  : 'bg-slate-800 text-slate-500'
                              }`}
                            >
                              {wep.unlockCoins} Coins · {wep.unlockCrystals} Crys
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: DIYA CORE UPGRADE WORKSHOP & DAILY REWARDS */}
          {activeTab === 'shop' && (
            <div className="space-y-6">
              {/* Daily Reward Banner */}
              <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl border border-amber-500/35 bg-slate-900">
                <div>
                  <div className="text-xs font-mono text-amber-400">
                    DAILY DIYA CORE SUPPLY DROP · STREAK DAY {saveData.dailyStreak + 1}
                  </div>
                  <div className="text-sm text-slate-200 mt-0.5">
                    Claim free Coins and Energy Crystals every day to upgrade your DesiDiya fleet.
                  </div>
                  {dailyNotice && (
                    <div className="text-xs text-emerald-400 mt-1 font-medium">
                      {dailyNotice}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  disabled={!dailyAvailable}
                  onClick={() => {
                    const res = claimDailyReward(saveData, todayIso);
                    if (res.rewardCoins > 0) {
                      soundEngine.playPickup(true);
                      onUpdateSave(res.nextSave);
                      setDailyNotice(
                        `Claimed +${res.rewardCoins} Coins and +${res.rewardCrystals} Energy Crystals!`,
                      );
                    }
                  }}
                  className={`px-4 py-2 rounded-lg text-xs font-bold cursor-pointer ${
                    dailyAvailable
                      ? 'bg-amber-500 hover:bg-amber-400 text-slate-950'
                      : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {dailyAvailable ? 'Claim Daily Supply Drop' : 'Daily Reward Claimed Today'}
                </button>
              </div>

              {/* 6 Upgrade Tracks */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {(
                  [
                    {
                      key: 'damage',
                      title: 'Diya Core Weapon Damage',
                      desc: 'Increases primary laser, plasma, and missile warhead output (+16% per level).',
                    },
                    {
                      key: 'fireRate',
                      title: 'Capacitor Fire Rate',
                      desc: 'Accelerates primary weapon firing cadence across all 8 weapon tiers.',
                    },
                    {
                      key: 'missileCapacity',
                      title: 'Homing Missile Bay Capacity',
                      desc: 'Expands maximum Homing Missile stock carried into each planetary sortie.',
                    },
                    {
                      key: 'shieldStrength',
                      title: 'Hull & Diya Shield Matrix',
                      desc: 'Reinforces both maximum Hull Integrity (+18) and regenerative Diya Shield (+22).',
                    },
                    {
                      key: 'engineSpeed',
                      title: 'Twin Ion Thruster Speed',
                      desc: 'Boosts lateral evasion and acceleration against boss beam barrages.',
                    },
                    {
                      key: 'specialPower',
                      title: 'Diya Solar Nova Output',
                      desc: 'Amplifies the area-of-effect damage of your [Shift] Diya Solar Nova blast.',
                    },
                  ] as Array<{ key: keyof UpgradeStats; title: string; desc: string }>
                ).map((item) => {
                  const lvl = saveData.upgrades[item.key];
                  const cost = getUpgradeCost(item.key, lvl);
                  const affordable = canAffordUpgrade(saveData, item.key);

                  return (
                    <div
                      key={item.key}
                      className="p-4 rounded-xl border border-slate-800 bg-slate-950/90 flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center justify-between text-xs font-mono text-amber-400 mb-1">
                          <span>LEVEL {lvl} / 10</span>
                          <span>{'■'.repeat(lvl)}{'□'.repeat(10 - lvl)}</span>
                        </div>
                        <h4 className="text-base font-bold text-white">{item.title}</h4>
                        <p className="text-xs text-slate-400 mt-1">{item.desc}</p>
                      </div>

                      <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between gap-2">
                        <div className="text-xs font-mono tabular-nums text-slate-300">
                          {lvl >= 10
                            ? 'MAX LEVEL REACHED'
                            : `Cost: ${cost.coins} Coins${cost.crystals > 0 ? ` · ${cost.crystals} Crys` : ''}`}
                        </div>
                        <button
                          type="button"
                          disabled={!affordable || lvl >= 10}
                          onClick={() => {
                            if (!affordable) return;
                            soundEngine.playPickup(true);
                            onUpdateSave(applyUpgrade(saveData, item.key));
                          }}
                          className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                            affordable && lvl < 10
                              ? 'bg-amber-500 hover:bg-amber-400 text-slate-950'
                              : 'bg-slate-800 text-slate-500'
                          }`}
                        >
                          {lvl >= 10 ? 'Maxed' : 'Upgrade'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 4: SETTINGS & LYRIA AI SOUNDTRACK STUDIO */}
          {activeTab === 'settings' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl border border-slate-800 bg-slate-950/80 space-y-3">
                  <h3 className="text-sm font-bold text-amber-300">
                    Graphics & Performance Settings
                  </h3>
                  <div className="flex items-center gap-2">
                    {(['low', 'medium', 'high'] as GraphicsQuality[]).map((q) => (
                      <button
                        key={q}
                        type="button"
                        onClick={() =>
                          onUpdateSave({
                            ...saveData,
                            graphicsQuality: q,
                          })
                        }
                        className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold capitalize cursor-pointer ${
                          saveData.graphicsQuality === q
                            ? 'bg-amber-500 text-slate-950'
                            : 'bg-slate-900 text-slate-300 border border-slate-700'
                        }`}
                      >
                        {q} Quality
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-slate-400">
                    Adjusts particle density, pixel ratio, and shadow maps for smooth 60 FPS on Android & iOS browsers.
                  </p>
                </div>

                <div className="p-4 rounded-xl border border-slate-800 bg-slate-950/80 space-y-3">
                  <h3 className="text-sm font-bold text-amber-300">
                    Flight Controls & Audio Preferences
                  </h3>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        onUpdateSave({ ...saveData, autoFire: !saveData.autoFire })
                      }
                      className="px-3 py-1.5 rounded-lg border border-slate-700 text-xs font-semibold text-slate-200 hover:bg-slate-800 cursor-pointer"
                    >
                      Auto-Fire: {saveData.autoFire ? 'ON' : 'OFF'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const nextSound = !saveData.soundEnabled;
                        soundEngine.setSettings(nextSound, saveData.musicEnabled);
                        onUpdateSave({ ...saveData, soundEnabled: nextSound });
                      }}
                      className="px-3 py-1.5 rounded-lg border border-slate-700 text-xs font-semibold text-slate-200 hover:bg-slate-800 cursor-pointer"
                    >
                      SFX: {saveData.soundEnabled ? 'ON' : 'MUTED'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const nextMusic = !saveData.musicEnabled;
                        soundEngine.setSettings(saveData.soundEnabled, nextMusic);
                        onUpdateSave({ ...saveData, musicEnabled: nextMusic });
                      }}
                      className="px-3 py-1.5 rounded-lg border border-slate-700 text-xs font-semibold text-slate-200 hover:bg-slate-800 cursor-pointer"
                    >
                      Music: {saveData.musicEnabled ? 'ON' : 'MUTED'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Lyria 3 AI Soundtrack Generator */}
              <div className="p-5 rounded-xl border border-amber-500/35 bg-slate-900/90 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-bold text-amber-300">
                    Lyria 3 AI Space Battle Soundtrack Generator
                  </h3>
                  <span className="text-xs font-mono text-slate-400">
                    Powered by {lyriaModel}
                  </span>
                </div>
                <p className="text-xs text-slate-300">
                  Compose a custom DesiDiya space combat soundtrack using Google Lyria 3, or enjoy the built-in procedural planetary synth engine.
                </p>

                <div className="flex flex-col sm:flex-row gap-3">
                  <label className="sr-only" htmlFor="lyria-prompt-input">
                    Soundtrack Prompt
                  </label>
                  <input
                    id="lyria-prompt-input"
                    type="text"
                    value={lyriaPrompt}
                    onChange={(e) => setLyriaPrompt(e.target.value)}
                    className="flex-1 rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-xs text-white"
                    placeholder="Describe your space battle music..."
                  />
                  <select
                    aria-label="Select Lyria Model"
                    value={lyriaModel}
                    onChange={(e) =>
                      setLyriaModel(
                        e.target.value as 'lyria-3-clip-preview' | 'lyria-3-pro-preview',
                      )
                    }
                    className="rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-xs text-white"
                  >
                    <option value="lyria-3-clip-preview">Lyria Clip (30s)</option>
                    <option value="lyria-3-pro-preview">Lyria Pro (Full Track)</option>
                  </select>
                  <button
                    type="button"
                    disabled={lyriaLoading}
                    onClick={handleGenerateMusic}
                    className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold whitespace-nowrap cursor-pointer"
                  >
                    {lyriaLoading ? 'Composing...' : 'Generate Soundtrack'}
                  </button>
                </div>

                {lyriaStatus && (
                  <div className="text-xs text-amber-200 font-medium">{lyriaStatus}</div>
                )}
              </div>

              <div className="flex items-center justify-between text-xs text-slate-400 pt-2 border-t border-slate-800">
                <span>Official Brand: DESIDIYA SKY FIGHTER — "{BRAND_SLOGAN}"</span>
                <a
                  href={BRAND_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-amber-400 hover:underline"
                >
                  Visit desidiya.com
                </a>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
