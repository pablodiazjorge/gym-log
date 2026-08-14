import { DestroyRef, Signal, computed, inject, signal } from '@angular/core';

/**
 * Minutes elapsed since `startTime`, as a live signal.
 *
 * `computed(() => Date.now() - startTime())` looks right but is not: `Date.now()`
 * is not a reactive producer, so the computed memoises on its first read and
 * never recalculates. Since that first read happens right after the session is
 * created, every workout was displayed — and saved — as 0 minutes.
 *
 * The ticking `now` signal is the missing producer. Must be called from an
 * injection context (a field initializer) so the interval is cleaned up.
 */
export function elapsedMinutes(startTime: Signal<number>, tickMs = 30_000): Signal<number> {
  const now = signal(Date.now());
  const id = setInterval(() => now.set(Date.now()), tickMs);
  inject(DestroyRef).onDestroy(() => clearInterval(id));
  return computed(() => minutesSince(startTime(), now()));
}

/**
 * Exact elapsed minutes, for the moment a session is saved — the ticking signal
 * can be up to one tick stale.
 */
export function minutesSince(startMs: number, nowMs: number = Date.now()): number {
  return Math.max(0, Math.round((nowMs - startMs) / 60000));
}
