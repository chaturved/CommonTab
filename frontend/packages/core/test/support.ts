import type { Clock, Random } from '../src';

export class TestClock implements Clock {
  constructor(public t = Date.parse('2026-10-01T12:00:00Z')) {}
  now = () => this.t;
  advance(ms: number) { this.t += ms; }
}

/** Predictable ids; `next()` is the jitter source (0.5 means "no jitter"). */
export class TestRandom implements Random {
  private n = 0;
  jitter = 0.5;
  constructor(private readonly prefix = 'a') {}
  uuid = () => `00000000-0000-4000-8000-${this.prefix}${String(++this.n).padStart(11, '0')}`;
  next = () => this.jitter;
}
