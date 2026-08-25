export const WORLD_WIDTH = 540;
export const WORLD_HEIGHT = 960;
export const FIXED_HZ = 120;
export const FIXED_DT_MS = 1000 / FIXED_HZ;
export const ROUND_MS = 60_000;
export const ROUND_TICKS = Math.round(ROUND_MS / FIXED_DT_MS);

export const CLAW_BASE = Object.freeze({ x: 270, y: 835 });
export const CLAW_REACH = 575;
export const CLAW_OUTBOUND_PX_S = 1420;
export const CLAW_RETURN_EMPTY_PX_S = CLAW_OUTBOUND_PX_S * 1.4;
export const CLAW_RETURN_LOADED_PX_S = CLAW_OUTBOUND_PX_S * 1.25;
export const CLAW_RADIUS = 17;

export const AIM_MIN_RAD = -Math.PI * 0.88;
export const AIM_MAX_RAD = -Math.PI * 0.12;

export const MULTIPLIER_LADDER = [1, 2, 4, 8, 16] as const;
export const CASHOUT_HEAT_DROP = 45;
export const BUST_HEAT_RESET = 28;
export const BUST_LOCK_TICKS = Math.round(0.72 * FIXED_HZ);
export const ONE_MORE_WINDOW_TICKS = Math.round(5.2 * FIXED_HZ);

export const CONVEYOR_LANES = [330, 410, 490] as const;
export const LOOT_RADIUS = 28;
