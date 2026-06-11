import type {
  Keyboard,
  SwitchBehavior,
  SwitchDictionary,
} from '../types';

export type GraphLevel = 1 | 2 | 3;

export interface SwitchDisplayData {
  switchName: string | null;
  tactility: GraphLevel | null;
  noise: GraphLevel | null;
}

const TACTILITY_LEVELS: Record<SwitchBehavior, GraphLevel> = {
  linear: 1,
  tactile: 2,
  clicky: 3,
};

const GENERIC_SWITCH_PROFILES: SwitchDictionary = {
  '적축': { switch_type: 'linear', is_silent: false },
  '갈축': { switch_type: 'tactile', is_silent: false },
  '청축': { switch_type: 'clicky', is_silent: false },
};

export function getTactilityLevel(
  switchType: SwitchBehavior | null,
): GraphLevel | null {
  return switchType === null ? null : TACTILITY_LEVELS[switchType];
}

export function getNoiseLevel(isSilent: boolean | null): GraphLevel | null {
  if (isSilent === true) return 1;
  if (isSilent === false) return 3;
  return null;
}

export function getSwitchDisplayData(
  keyboard: Pick<Keyboard, 'switch_name' | 'raw_switch_name'>,
  switches: SwitchDictionary,
): SwitchDisplayData {
  const switchName = keyboard.switch_name ?? null;
  const matchedSwitchInfo = switchName ? switches[switchName] : null;

  if (matchedSwitchInfo) {
    return {
      switchName,
      tactility: getTactilityLevel(matchedSwitchInfo.switch_type),
      noise: getNoiseLevel(matchedSwitchInfo.is_silent),
    };
  }

  const rawSwitchName = keyboard.raw_switch_name?.trim() ?? null;
  const genericSwitchInfo = rawSwitchName
    ? GENERIC_SWITCH_PROFILES[rawSwitchName]
    : null;

  if (!genericSwitchInfo) {
    return { switchName, tactility: null, noise: null };
  }

  return {
    switchName: rawSwitchName,
    tactility: getTactilityLevel(genericSwitchInfo.switch_type),
    noise: getNoiseLevel(genericSwitchInfo.is_silent),
  };
}
