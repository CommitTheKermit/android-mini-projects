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
  keyboard: Pick<Keyboard, 'switch_name'>,
  switches: SwitchDictionary,
): SwitchDisplayData {
  const switchName = keyboard.switch_name ?? null;
  if (!switchName) {
    return { switchName: null, tactility: null, noise: null };
  }

  const switchInfo = switches[switchName];
  if (!switchInfo) {
    return { switchName, tactility: null, noise: null };
  }

  return {
    switchName,
    tactility: getTactilityLevel(switchInfo.switch_type),
    noise: getNoiseLevel(switchInfo.is_silent),
  };
}
