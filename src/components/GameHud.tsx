import React, { useState } from 'react';
import { BRAND_LOGO_URL, POWERUP_INFO } from '../game/campaignData';
import { HudSnapshot, PowerUpType } from '../game/types';

interface GameHudProps {
  hud: HudSnapshot;
  soundEnabled: boolean;
  onToggleSound: () => void;
  onPause: () => void;
  onFireMissile: () => void;
  onTriggerNova: () => void;
  onActivateShield: () => void;
  onCycleWeapon: () => void;
  onSummonBoss: () => void;
}

export const GameHud: React.FC<GameHudProps> = ({
  hud,
  soundEnabled,
  onToggleSound,
  onPause,
  onFireMissile,
  onTriggerNova,
  onActivateShield,
  onCycleShield,
  onCycleWeapon,
  onSummonBoss,
}: GameHudProps & { onCycleShield?: () => void }) => {
  const [showMoreInfo, setShowMoreInfo] = useState(false);

  const hpPct = Math.max(0, Math.min(100, Math.round((hud.hp / Math.max(1, hud.maxHp)) * 100)));
  const shieldPct = Math.max(
    0,
    Math.min(100, Math.round((hud.shield / Math.max(1, hud.maxShield)) * 100)),
  );
  const bossHpPct = Math.max(
    0,
    Math.min(100, Math.round((hud.bossHp / Math.max(1, hud.bossMaxHp)) * 100)),
  );
  const bossShieldPct =
    hud.bossMaxShieldHp > 0
      ? Math.max(
          0,
          Math.min(
            100,
            Math.round((hud.bossShieldHp / Math.max(1, hud.bossMaxShieldHp)) * 100),
          ),
        )
      : 0;

  const activeBuffEntries: Array<{ key: PowerUpType; seconds: number }> = [];
  if (hud.activeBuffs.doubleDamageTimer > 0) {
    activeBuffEntries.push({
      key: 'double_damage',
      seconds: Math.ceil(hud.activeBuffs.doubleDamageTimer),
    });
  }
  if (hud.activeBuffs.speedBoostTimer > 0) {
    activeBuffEntries.push({
      key: 'speed_boost',
      seconds: Math.ceil(hud.activeBuffs.speedBoostTimer),
    });
  }
  if (hud.activeBuffs.invincibilityTimer > 0) {
    activeBuffEntries.push({
      key: 'invincibility',
      seconds: Math.ceil(hud.activeBuffs.invincibilityTimer),
    });
  }
  if (hud.activeBuffs.ultimateSolarTimer > 0) {
    activeBuffEntries.push({
      key: 'ultimate_solar',
      seconds: Math.ceil(hud.activeBuffs.ultimateSolarTimer),
    });
  }

  return (
    <div
      className="fixed inset-0 z-10 pointer-events-none flex flex-col justify-between p-2.5 sm:p-4 select-none"
      data-testid="playing-hud"
    >
      {/* Low HP warning peripheral vignette */}
      {hpPct <= 30 && (
        <div
          className="fixed inset-0 pointer-events-none"
          style={{
            boxShadow: 'inset 0 0 80px rgba(239, 68, 68, 0.42)',
          }}
        />
      )}

      {/* TOP SLIM BAR: Minimal footprint so gameplay stays 92%+ unobstructed */}
      <div className="flex flex-col gap-1.5 w-full">
        <div className="flex items-start justify-between gap-2 w-full">
          {/* TOP-LEFT: Ultra-Compact HP & Shield Strip + Tiny DesiDiya Brand Mark */}
          <div
            className="pointer-events-auto rounded-lg px-2.5 py-1.5 border border-amber-500/30 flex items-center gap-2.5"
            style={{
              backgroundColor: 'rgba(8, 12, 26, 0.82)',
              boxShadow: '0 4px 16px rgba(0, 0, 0, 0.5)',
            }}
          >
            <img
              src={BRAND_LOGO_URL}
              alt="DesiDiya"
              referrerPolicy="no-referrer"
              className="h-6 w-auto object-contain shrink-0"
            />
            <div className="w-24 sm:w-32 space-y-1">
              <div className="flex items-center justify-between text-[10px] font-mono leading-none">
                <span className="text-amber-400 font-bold">HP</span>
                <span className="text-white tabular-nums">
                  {hud.hp}/{hud.maxHp}
                </span>
              </div>
              <div className="w-full h-1.5 rounded-sm bg-slate-900 overflow-hidden">
                <div
                  className="h-full transition-transform duration-150 origin-left"
                  style={{
                    backgroundColor: hpPct > 35 ? '#10B981' : '#EF4444',
                    transform: `scaleX(${hpPct / 100})`,
                  }}
                />
              </div>
              <div className="w-full h-1 rounded-sm bg-slate-900 overflow-hidden">
                <div
                  className="h-full transition-transform duration-150 origin-left"
                  style={{
                    backgroundColor: '#38BDF8',
                    transform: `scaleX(${shieldPct / 100})`,
                  }}
                />
              </div>
            </div>
          </div>

          {/* TOP-CENTER: Slim Boss Health Bar (Only visible when Boss is active) or Slim Toast */}
          <div className="flex flex-col items-center max-w-xs sm:max-w-sm w-full px-1">
            {hud.bossActive && (
              <div
                className="w-full rounded-lg px-3 py-1.5 border border-red-500/50"
                style={{
                  backgroundColor: 'rgba(24, 8, 14, 0.88)',
                }}
                data-testid="boss-health-panel"
              >
                <div className="flex items-center justify-between text-[10px] sm:text-xs font-bold text-red-200 mb-1">
                  <span className="truncate">
                    {hud.bossName} (P{hud.bossPhase})
                  </span>
                  <span className="font-mono tabular-nums ml-2">
                    {hud.bossHp}/{hud.bossMaxHp}
                  </span>
                </div>
                {hud.bossMaxShieldHp > 0 && hud.bossShieldHp > 0 && (
                  <div className="w-full h-1 rounded-sm bg-slate-900 overflow-hidden mb-0.5">
                    <div
                      className="h-full bg-purple-400 transition-transform duration-150 origin-left"
                      style={{ transform: `scaleX(${bossShieldPct / 100})` }}
                    />
                  </div>
                )}
                <div className="w-full h-2 rounded-sm bg-slate-950 overflow-hidden border border-red-500/40">
                  <div
                    className="h-full bg-red-500 transition-transform duration-150 origin-left"
                    style={{ transform: `scaleX(${bossHpPct / 100})` }}
                  />
                </div>
              </div>
            )}

            {hud.announcement && (
              <div
                className="mt-1 px-2.5 py-1 rounded border border-amber-400/40 text-[10px] sm:text-xs font-bold tracking-wide text-amber-200 text-center"
                style={{ backgroundColor: 'rgba(28, 18, 6, 0.86)' }}
              >
                {hud.announcement}
              </div>
            )}
          </div>

          {/* TOP-RIGHT: Compact Score + Small "More" Button + Pause Button */}
          <div className="flex flex-col items-end gap-1.5 pointer-events-auto shrink-0">
            <div className="flex items-center gap-1.5">
              <div
                className="rounded-lg px-2.5 py-1.5 border border-amber-500/30 text-right"
                style={{ backgroundColor: 'rgba(8, 12, 26, 0.82)' }}
              >
                <div className="text-[9px] font-bold tracking-wider text-slate-400 uppercase leading-none">
                  {hud.planetName} · W{hud.wave}/{hud.totalWaves}
                </div>
                <div
                  className="text-sm sm:text-base font-bold font-mono tabular-nums text-amber-300 leading-tight"
                  data-testid="hud-score"
                >
                  {hud.score}
                </div>
              </div>

              {/* Small "More" Button to reveal extra mission info & actions */}
              <button
                type="button"
                tabIndex={-1}
                aria-label="More Info"
                aria-expanded={showMoreInfo}
                onClick={(e) => {
                  e.currentTarget.blur();
                  setShowMoreInfo((prev) => !prev);
                }}
                className={`h-9 px-2.5 rounded-lg border text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer ${
                  showMoreInfo
                    ? 'border-amber-400 bg-amber-500 text-slate-950'
                    : 'border-amber-500/40 text-amber-300 hover:bg-amber-500/20'
                }`}
                style={
                  showMoreInfo
                    ? undefined
                    : { backgroundColor: 'rgba(8, 12, 26, 0.88)' }
                }
              >
                <span>{showMoreInfo ? 'Hide' : 'More'}</span>
              </button>

              {/* Pause Button */}
              <button
                type="button"
                tabIndex={-1}
                aria-label="Pause Game"
                onClick={(e) => {
                  e.currentTarget.blur();
                  onPause();
                }}
                className="w-9 h-9 rounded-lg border border-amber-500/40 flex items-center justify-center text-amber-300 hover:bg-amber-500/20 transition-colors cursor-pointer"
                style={{ backgroundColor: 'rgba(8, 12, 26, 0.88)' }}
              >
                <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current">
                  <rect x="6" y="5" width="4" height="14" rx="1" />
                  <rect x="14" y="5" width="4" height="14" rx="1" />
                </svg>
              </button>
            </div>

            {/* Expandable "More Info" Drawer (Only shown when user clicks "More") */}
            {showMoreInfo && (
              <div
                className="w-64 rounded-xl border border-amber-500/40 p-3 text-xs space-y-2.5 text-slate-200"
                style={{
                  backgroundColor: 'rgba(8, 12, 26, 0.95)',
                  boxShadow: '0 12px 32px rgba(0, 0, 0, 0.8)',
                }}
                data-testid="more-info-drawer"
              >
                <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
                  <span className="font-bold text-amber-300">MISSION TELEMETRY</span>
                  <span className="font-mono text-[11px] text-slate-400">
                    Lives: <strong className="text-white">{hud.lives}</strong>
                  </span>
                </div>

                <div className="space-y-1 text-[11px]">
                  <div className="text-slate-300">{hud.objectiveText}</div>
                  <div className="text-amber-200 font-medium">
                    Weapon: LVL {hud.weaponLevel} {hud.weaponName}
                  </div>
                  <div className="flex items-center gap-2 font-mono tabular-nums text-slate-300">
                    <span className="text-amber-400">{hud.coinsEarned} Coins</span>
                    <span aria-hidden="true">·</span>
                    <span className="text-sky-400">{hud.crystalsEarned} Crystals</span>
                  </div>
                </div>

                {activeBuffEntries.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-slate-800 text-[10px] font-mono text-amber-300">
                    {activeBuffEntries.map((b, idx) => (
                      <React.Fragment key={b.key}>
                        {idx > 0 && <span aria-hidden="true">·</span>}
                        <span>
                          {POWERUP_INFO[b.key].shortLabel} {b.seconds}s
                        </span>
                      </React.Fragment>
                    ))}
                  </div>
                )}

                <div className="text-[10px] text-slate-400 border-t border-slate-800 pt-1.5">
                  Controls: Drag or WASD to Fly · Auto-Fire ON · [X] Missiles · [Shift] Nova · [C] Shield
                </div>

                <div className="flex items-center justify-between gap-2 pt-1">
                  <button
                    type="button"
                    onClick={onToggleSound}
                    className="flex-1 py-1.5 rounded-lg border border-slate-700 text-[11px] font-semibold text-slate-200 hover:bg-slate-800 cursor-pointer"
                  >
                    Audio: {soundEnabled ? 'ON' : 'MUTED'}
                  </button>
                  {!hud.bossActive && (
                    <button
                      type="button"
                      onClick={() => {
                        setShowMoreInfo(false);
                        onSummonBoss();
                      }}
                      className="flex-1 py-1.5 rounded-lg border border-red-500/50 text-[11px] font-semibold text-red-300 hover:bg-red-500/20 cursor-pointer"
                    >
                      Engage Boss
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* BOTTOM-RIGHT ONLY: Compact Tactical Action Pills (Leaves bottom-left & center 100% open) */}
      <div className="flex items-end justify-end w-full">
        <div className="flex items-center gap-1.5 pointer-events-auto">
          <button
            type="button"
            tabIndex={-1}
            onClick={(e) => {
              e.currentTarget.blur();
              onCycleWeapon();
            }}
            className="px-2.5 py-1.5 rounded-lg border border-amber-500/40 text-left hover:bg-amber-500/15 transition-colors cursor-pointer"
            style={{ backgroundColor: 'rgba(8, 12, 26, 0.85)' }}
          >
            <div className="text-[8px] font-mono text-amber-400 leading-none">[Q] WPN</div>
            <div className="text-[11px] font-bold text-white whitespace-nowrap">
              L{hud.weaponLevel}/8
            </div>
          </button>

          <button
            type="button"
            tabIndex={-1}
            disabled={hud.shieldSkillCooldown > 0}
            onClick={(e) => {
              e.currentTarget.blur();
              onActivateShield();
            }}
            className={`px-2.5 py-1.5 rounded-lg border text-left transition-colors cursor-pointer ${
              hud.shieldSkillCooldown <= 0
                ? 'border-sky-400/60 text-sky-200 hover:bg-sky-500/20'
                : 'border-slate-700 text-slate-500 opacity-70'
            }`}
            style={{ backgroundColor: 'rgba(8, 12, 26, 0.85)' }}
          >
            <div className="text-[8px] font-mono text-sky-400 leading-none">[C] SHIELD</div>
            <div className="text-[11px] font-bold tabular-nums whitespace-nowrap">
              {hud.shieldSkillCooldown > 0
                ? `${hud.shieldSkillCooldown.toFixed(0)}s`
                : 'READY'}
            </div>
          </button>

          <button
            type="button"
            tabIndex={-1}
            disabled={hud.missiles <= 0 || hud.missileCooldown > 0}
            onClick={(e) => {
              e.currentTarget.blur();
              onFireMissile();
            }}
            className={`px-2.5 py-1.5 rounded-lg border text-left transition-colors cursor-pointer ${
              hud.missiles > 0
                ? 'border-orange-400/60 text-orange-200 hover:bg-orange-500/20'
                : 'border-slate-700 text-slate-500 opacity-70'
            }`}
            style={{ backgroundColor: 'rgba(8, 12, 26, 0.85)' }}
          >
            <div className="text-[8px] font-mono text-orange-400 leading-none">[X] MISSILE</div>
            <div className="text-[11px] font-bold font-mono tabular-nums whitespace-nowrap">
              {hud.missiles}/{hud.maxMissiles}
            </div>
          </button>

          <button
            type="button"
            tabIndex={-1}
            disabled={hud.specialCharge < 100}
            onClick={(e) => {
              e.currentTarget.blur();
              onTriggerNova();
            }}
            className={`px-3 py-1.5 rounded-lg border text-left transition-colors cursor-pointer ${
              hud.specialCharge >= 100
                ? 'border-amber-300 bg-amber-500/30 text-amber-100'
                : 'border-amber-500/30 text-slate-300'
            }`}
            style={{
              backgroundColor:
                hud.specialCharge >= 100
                  ? 'rgba(180, 83, 9, 0.88)'
                  : 'rgba(8, 12, 26, 0.85)',
            }}
          >
            <div className="text-[8px] font-mono text-amber-300 leading-none">[SHIFT] NOVA</div>
            <div className="text-[11px] font-bold font-mono tabular-nums whitespace-nowrap">
              {hud.specialCharge >= 100 ? 'FIRE!' : `${hud.specialCharge}%`}
            </div>
          </button>
        </div>
      </div>
    </div>
  );
};
