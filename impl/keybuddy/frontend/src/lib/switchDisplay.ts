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

const NON_MECHANICAL_DISPLAY_PROFILES: Record<
  string,
  Pick<SwitchDisplayData, 'tactility' | 'noise'>
> = {
  '멤브레인': { tactility: 2, noise: 1 },
  '펜타그래프': { tactility: 2, noise: 2 },
  '무접점': { tactility: 1, noise: 1 },
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
  keyboard: Pick<Keyboard, 'switch_name' | 'raw_switch_name'> &
    Partial<Pick<Keyboard, 'switch_type'>>,
  switches: SwitchDictionary,
): SwitchDisplayData {
  const switchName = keyboard.switch_name ?? null;
  const rawSwitchName = keyboard.raw_switch_name?.trim() ?? null;
  const switchType = keyboard.switch_type?.trim() ?? '';
  const nonMechanicalDisplayProfile = Object.entries(NON_MECHANICAL_DISPLAY_PROFILES)
    .find(([type]) => switchType.includes(type))?.[1] ?? null;

  if (nonMechanicalDisplayProfile) {
    return {
      switchName: rawSwitchName || switchName,
      ...nonMechanicalDisplayProfile,
    };
  }

  const matchedSwitchName =
    switchName && switches[switchName]
      ? switchName
      : rawSwitchName && switches[rawSwitchName]
        ? rawSwitchName
        : null;
  const matchedSwitchInfo = matchedSwitchName ? switches[matchedSwitchName] : null;

  if (matchedSwitchInfo) {
    return {
      switchName: matchedSwitchName,
      tactility: getTactilityLevel(matchedSwitchInfo.switch_type),
      noise: getNoiseLevel(matchedSwitchInfo.is_silent),
    };
  }

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
