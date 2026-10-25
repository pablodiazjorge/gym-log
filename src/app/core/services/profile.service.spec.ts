import { Injector, runInInjectionContext } from '@angular/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ProfileService, isValidProfile, normalizeProfile } from './profile.service';
import { StorageService } from './storage.service';
import { MeasurementService } from './measurement.service';
import { UserProfile } from '../models/profile.model';

/**
 * The real exports live in the git-ignored docs/personal-progress/ folder, so CI and
 * fresh clones do not have them. Opt in locally with GYM_LOG_REAL_DATA=1.
 */
const withRealData = it.skipIf(process.env['GYM_LOG_REAL_DATA'] !== '1');

// Data-integrity guard (ADR-0010 scope): the stored profile used to be read
// with `JSON.parse(raw) as UserProfile`, so a hand-edited or truncated value
// reached the progression engine unchecked.

const PROFILE_KEY = 'gym_user_profile';
const QUARANTINE_KEY = 'gym_user_profile_quarantine';

const profile = (overrides: Record<string, unknown> = {}) => ({
  experienceLevelManual: 'intermediate',
  useComputedLevel: false,
  updatedAt: '2026-08-08T00:00:00.000Z',
  ...overrides,
});

const lift = (overrides: Record<string, unknown> = {}) => ({
  category: 'push',
  exerciseName: 'Bench press',
  weightKg: 60,
  reps: 5,
  ...overrides,
});

/** No TestBed (ADR-0010): both collaborators are plain classes, provided by value */
function createService(): ProfileService {
  const injector = Injector.create({
    providers: [
      { provide: StorageService, useValue: new StorageService() },
      { provide: MeasurementService, useValue: new MeasurementService() },
    ],
  });
  return runInInjectionContext(injector, () => new ProfileService());
}

describe('isValidProfile', () => {
  it('accepts a minimal profile with a known experience level', () => {
    expect(isValidProfile(profile())).toBe(true);
    expect(isValidProfile({ experienceLevelManual: 'beginner' })).toBe(true);
  });

  it('accepts a complete advanced-mode profile', () => {
    const full = profile({
      sex: 'female',
      heightCm: 165,
      wristCircumferenceCm: 15,
      trainingFocus: 'strength',
      benchmarkLifts: [lift(), lift({ category: 'legs', templateId: 'leg-press', weightKg: 120 })],
    });
    expect(isValidProfile(full)).toBe(true);
  });

  it.each([
    ['null', null],
    ['undefined', undefined],
    ['a string', 'beginner'],
    ['a number', 3],
    ['an array', [profile()]],
  ])('rejects %s', (_label, value) => {
    expect(isValidProfile(value)).toBe(false);
  });

  it('rejects a profile the progression engine would index with undefined', () => {
    // resolveLevel returns experienceLevelManual straight into AGGRESSIVENESS[level];
    // an absent or bogus value throws on the workout screen.
    expect(isValidProfile({})).toBe(false);
    expect(isValidProfile(profile({ experienceLevelManual: undefined }))).toBe(false);
    expect(isValidProfile(profile({ experienceLevelManual: 'pro' }))).toBe(false);
  });

  it('rejects half-formed benchmark lifts', () => {
    expect(isValidProfile(profile({ benchmarkLifts: { push: 60 } }))).toBe(false);
    expect(isValidProfile(profile({ benchmarkLifts: [lift(), null] }))).toBe(false);
    expect(isValidProfile(profile({ benchmarkLifts: [lift({ weightKg: '60' })] }))).toBe(false);
    expect(isValidProfile(profile({ benchmarkLifts: [lift({ reps: undefined })] }))).toBe(false);
    expect(isValidProfile(profile({ benchmarkLifts: [lift({ weightKg: NaN })] }))).toBe(false);
  });

  withRealData('accepts the real profile of the export', async () => {
    const { readFileSync } = await import('node:fs');
    const data = JSON.parse(readFileSync('docs/personal-progress/gym_data_v2.json', 'utf8'));
    expect(isValidProfile(data.user)).toBe(true);
  });
});

describe('normalizeProfile', () => {
  it('returns a valid profile unchanged', () => {
    const p = profile({ benchmarkLifts: [lift()] });
    expect(normalizeProfile(p)).toBe(p);
    expect(normalizeProfile(profile())).toEqual(profile());
  });

  it('rejects only what the level makes unusable', () => {
    expect(normalizeProfile(null)).toBeNull();
    expect(normalizeProfile([profile()])).toBeNull();
    expect(normalizeProfile(profile({ experienceLevelManual: 'pro' }))).toBeNull();
    expect(
      normalizeProfile(profile({ experienceLevelManual: 'pro', benchmarkLifts: [lift()] })),
    ).toBeNull();
  });

  it('keeps a catalog lift whose emptied fields were saved as null, at 0', () => {
    // The form shows no manual fields for catalog lifts and saves them as they
    // are, so a field emptied before picking the exercise reaches storage as null.
    const catalog = lift({ templateId: 'leg-press', weightKg: null, reps: null });
    const result = normalizeProfile(profile({ name: 'Alex', benchmarkLifts: [lift(), catalog] }));
    expect(result?.name).toBe('Alex');
    expect(result?.experienceLevelManual).toBe('intermediate');
    expect(result?.benchmarkLifts).toEqual([lift(), { ...catalog, weightKg: 0, reps: 0 }]);
  });

  it('drops broken manual lifts and keeps the rest of the profile', () => {
    const result = normalizeProfile(
      profile({ benchmarkLifts: [lift(), null, lift({ weightKg: null }), lift({ reps: '5' })] }),
    );
    expect(result?.benchmarkLifts).toEqual([lift()]);
  });

  it('replaces a non-array of lifts with an empty list', () => {
    expect(normalizeProfile(profile({ benchmarkLifts: 'bench 60x5' }))?.benchmarkLifts).toEqual([]);
  });
});

describe('ProfileService.loadProfile', () => {
  let warn: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    localStorage.clear();
    warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    warn.mockRestore();
  });

  it('starts with no profile when nothing is stored', () => {
    expect(createService().profile()).toBeNull();
  });

  it('loads a well-formed stored profile', () => {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile({ benchmarkLifts: [lift()] })));
    expect(createService().profile()?.experienceLevelManual).toBe('intermediate');
    expect(warn).not.toHaveBeenCalled();
  });

  it('ignores a malformed profile and keeps a copy of it', () => {
    const raw = JSON.stringify(profile({ experienceLevelManual: 'expert' }));
    localStorage.setItem(PROFILE_KEY, raw);

    expect(createService().profile()).toBeNull();
    expect(localStorage.getItem(QUARANTINE_KEY)).toBe(raw);
    expect(warn).toHaveBeenCalledOnce();
  });

  it('keeps a half-written profile (valid level, broken lifts) and a copy of the original', () => {
    const raw = JSON.stringify(
      profile({
        bodyWeightKg: 74,
        benchmarkLifts: [lift(), lift({ templateId: 'leg-press', weightKg: null })],
      }),
    );
    localStorage.setItem(PROFILE_KEY, raw);

    const loaded = createService().profile();
    expect(loaded?.bodyWeightKg).toBe(74);
    expect(loaded?.benchmarkLifts?.map((l) => l.weightKg)).toEqual([60, 0]);
    expect(localStorage.getItem(QUARANTINE_KEY)).toBe(raw);
    expect(warn).toHaveBeenCalledOnce();
  });

  it('survives unparseable JSON', () => {
    localStorage.setItem(PROFILE_KEY, '{"experienceLevelManual": "beg');
    expect(createService().profile()).toBeNull();
  });

  it('round-trips through saveProfile', () => {
    const saved: UserProfile = {
      experienceLevelManual: 'advanced',
      useComputedLevel: false,
      updatedAt: '2026-08-08T00:00:00.000Z',
    };
    createService().saveProfile(saved);
    expect(createService().profile()?.experienceLevelManual).toBe('advanced');
  });

  it('does not store the null an emptied field leaves in a catalog lift', () => {
    const withNull = profile({
      benchmarkLifts: [lift({ templateId: 'leg-press', weightKg: null })],
    }) as unknown as UserProfile;
    createService().saveProfile(withNull);

    const stored = JSON.parse(localStorage.getItem(PROFILE_KEY)!);
    expect(stored.benchmarkLifts[0].weightKg).toBe(0);
    expect(createService().profile()?.benchmarkLifts).toHaveLength(1);
    expect(warn).not.toHaveBeenCalled();
  });
});
