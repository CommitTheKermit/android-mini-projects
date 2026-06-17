import { describe, expect, it } from 'vitest';
import rawSwitches from '../data/switches.json';
import {
  getNoiseLevel,
  getSwitchDisplayData,
  getTactilityLevel,
} from '../lib/switchDisplay';
import type { Keyboard, SwitchDictionary } from '../types';

const switches: SwitchDictionary = {
  Linear: { switch_type: 'linear', is_silent: false },
  Tactile: { switch_type: 'tactile', is_silent: true },
  Clicky: { switch_type: 'clicky', is_silent: false },
  UnknownType: { switch_type: null, is_silent: true },
  UnknownNoise: { switch_type: 'linear', is_silent: null },
};

describe('getTactilityLevel', () => {
  it('linear는 걸림 1단계로 변환한다', () => {
    expect(getTactilityLevel('linear')).toBe(1);
  });

  it('tactile은 걸림 2단계로 변환한다', () => {
    expect(getTactilityLevel('tactile')).toBe(2);
  });

  it('clicky는 걸림 3단계로 변환한다', () => {
    expect(getTactilityLevel('clicky')).toBe(3);
  });

  it('스위치 타입이 null이면 null을 반환한다', () => {
    expect(getTactilityLevel(null)).toBeNull();
  });
});

describe('getNoiseLevel', () => {
  it('저소음 스위치는 소음 1단계로 변환한다', () => {
    expect(getNoiseLevel(true)).toBe(1);
  });

  it('저소음이 아닌 스위치는 소음 3단계로 변환한다', () => {
    expect(getNoiseLevel(false)).toBe(3);
  });

  it('저소음 정보가 null이면 null을 반환한다', () => {
    expect(getNoiseLevel(null)).toBeNull();
  });
});

describe('getSwitchDisplayData', () => {
  it('switch_name으로 사전을 조회해 그래프 값을 반환한다', () => {
    expect(getSwitchDisplayData({ switch_name: 'Tactile' }, switches)).toEqual({
      switchName: 'Tactile',
      tactility: 2,
      noise: 1,
    });
  });

  it('switch_name이 null이면 모든 그래프 값을 null로 반환한다', () => {
    expect(getSwitchDisplayData({ switch_name: null }, switches)).toEqual({
      switchName: null,
      tactility: null,
      noise: null,
    });
  });

  it('switch_name이 없으면 모든 그래프 값을 null로 반환한다', () => {
    expect(getSwitchDisplayData({}, switches)).toEqual({
      switchName: null,
      tactility: null,
      noise: null,
    });
  });

  it('사전에 없는 이름은 임의로 추론하지 않는다', () => {
    expect(getSwitchDisplayData({ switch_name: 'Missing' }, switches)).toEqual({
      switchName: 'Missing',
      tactility: null,
      noise: null,
    });
  });

  it('switch_name이 null이어도 raw_switch_name이 사전에 있으면 그래프 값을 반환한다', () => {
    expect(
      getSwitchDisplayData(
        { switch_name: null, raw_switch_name: '저소음 피치축 V2' },
        rawSwitches as SwitchDictionary,
      ),
    ).toEqual({
      switchName: '저소음 피치축 V2',
      tactility: 1,
      noise: 1,
    });
  });

  it('switch_name이 사전에 없으면 raw_switch_name 사전 매칭을 사용한다', () => {
    expect(
      getSwitchDisplayData(
        { switch_name: 'Missing', raw_switch_name: 'Linear' },
        switches,
      ),
    ).toEqual({
      switchName: 'Linear',
      tactility: 1,
      noise: 3,
    });
  });

  it('switch_type만 null이면 걸림만 null로 반환한다', () => {
    expect(getSwitchDisplayData({ switch_name: 'UnknownType' }, switches)).toEqual({
      switchName: 'UnknownType',
      tactility: null,
      noise: 1,
    });
  });

  it('is_silent만 null이면 소음만 null로 반환한다', () => {
    expect(getSwitchDisplayData({ switch_name: 'UnknownNoise' }, switches)).toEqual({
      switchName: 'UnknownNoise',
      tactility: 1,
      noise: null,
    });
  });

  it.each([
    ['적축', 1],
    ['갈축', 2],
    ['청축', 3],
  ] as const)('%s은 MVP 범용 스위치 규칙으로 계산한다', (rawSwitchName, tactility) => {
    expect(
      getSwitchDisplayData(
        { switch_name: null, raw_switch_name: rawSwitchName },
        switches,
      ),
    ).toEqual({
      switchName: rawSwitchName,
      tactility,
      noise: 3,
    });
  });

  it('사전에 매칭된 switch_name을 범용 스위치 규칙보다 우선한다', () => {
    expect(
      getSwitchDisplayData(
        { switch_name: 'Tactile', raw_switch_name: '적축' },
        switches,
      ),
    ).toEqual({
      switchName: 'Tactile',
      tactility: 2,
      noise: 1,
    });
  });

  it('범용 이름의 변형명은 임의로 추론하지 않는다', () => {
    expect(
      getSwitchDisplayData(
        { switch_name: null, raw_switch_name: '저소음 갈축' },
        switches,
      ),
    ).toEqual({
      switchName: null,
      tactility: null,
      noise: null,
    });
  });

  it('실제 switches.json의 대표 스위치를 계산한다', () => {
    const dictionary = rawSwitches as SwitchDictionary;

    expect(getSwitchDisplayData({ switch_name: 'Blue Whale 경해축' }, dictionary)).toEqual({
      switchName: 'Blue Whale 경해축',
      tactility: 1,
      noise: 3,
    });
    expect(getSwitchDisplayData({ switch_name: 'SEIYA 세이야' }, dictionary)).toEqual({
      switchName: 'SEIYA 세이야',
      tactility: 2,
      noise: 3,
    });
    expect(getSwitchDisplayData({ switch_name: 'BCP' }, dictionary)).toEqual({
      switchName: 'BCP',
      tactility: 3,
      noise: 3,
    });
  });
});
