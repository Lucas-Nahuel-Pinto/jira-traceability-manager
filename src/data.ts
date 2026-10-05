import type { TraceSnapshot } from '../scripts/lib/trace-types.ts';
import raw from '../data/trace.json';

export const snapshot = raw as TraceSnapshot;
