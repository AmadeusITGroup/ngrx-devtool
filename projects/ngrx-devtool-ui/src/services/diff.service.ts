import { Injectable } from '@angular/core';

export interface DiffItem {
  path: string;
  oldValue?: unknown;
  newValue?: unknown;
  type: 'added' | 'removed' | 'changed';
}

export interface DiffResult {
  diffs: DiffItem[];
  truncated: boolean;
  totalChanges: number;
}

@Injectable({
  providedIn: 'root'
})
export class DiffService {
  private readonly MAX_DIFFS = 100;
  private readonly MAX_DEPTH = 10;

  calculateDiff(prevState: unknown, nextState: unknown): DiffResult {
    const diffs: DiffItem[] = [];
    let totalChanges = 0;

    if (!prevState && nextState) {
      const items = this.flattenObject(nextState);
      totalChanges = items.length;
      return {
        diffs: items.slice(0, this.MAX_DIFFS).map(item => ({
          path: item.path,
          newValue: item.value,
          type: 'added' as const
        })),
        truncated: items.length > this.MAX_DIFFS,
        totalChanges
      };
    }

    if (prevState && !nextState) {
      const items = this.flattenObject(prevState);
      totalChanges = items.length;
      return {
        diffs: items.slice(0, this.MAX_DIFFS).map(item => ({
          path: item.path,
          oldValue: item.value,
          type: 'removed' as const
        })),
        truncated: items.length > this.MAX_DIFFS,
        totalChanges
      };
    }

    if (!prevState && !nextState) {
      return { diffs: [], truncated: false, totalChanges: 0 };
    }

    const prevFlat = this.flattenObject(prevState);
    const nextFlat = this.flattenObject(nextState);

    const prevMap = new Map(prevFlat.map(item => [item.path, item.value]));
    const nextMap = new Map(nextFlat.map(item => [item.path, item.value]));

    for (const [path, prevValue] of prevMap) {
      if (diffs.length >= this.MAX_DIFFS) break;

      if (!nextMap.has(path)) {
        diffs.push({ path, oldValue: prevValue, type: 'removed' });
        totalChanges++;
      } else {
        const nextValue = nextMap.get(path);
        if (!this.isEqual(prevValue, nextValue)) {
          diffs.push({ path, oldValue: prevValue, newValue: nextValue, type: 'changed' });
          totalChanges++;
        }
      }
    }

    for (const [path, nextValue] of nextMap) {
      if (diffs.length >= this.MAX_DIFFS) break;

      if (!prevMap.has(path)) {
        diffs.push({ path, newValue: nextValue, type: 'added' });
        totalChanges++;
      }
    }

    if (diffs.length >= this.MAX_DIFFS) {
      for (const [path] of prevMap) {
        if (!nextMap.has(path)) totalChanges++;
      }
      for (const [path, prevValue] of prevMap) {
        const nextValue = nextMap.get(path);
        if (nextMap.has(path) && !this.isEqual(prevValue, nextValue)) totalChanges++;
      }
      for (const [path] of nextMap) {
        if (!prevMap.has(path)) totalChanges++;
      }
    }

    return {
      diffs,
      truncated: diffs.length >= this.MAX_DIFFS,
      totalChanges
    };
  }

  private isEqual(a: unknown, b: unknown): boolean {
    if (a === b) return true;
    if (typeof a !== typeof b) return false;
    if (typeof a !== 'object' || a === null || b === null) return a === b;
    return JSON.stringify(a) === JSON.stringify(b);
  }

  private flattenObject(obj: unknown, path = '', depth = 0): { path: string; value: unknown }[] {
    if (depth > this.MAX_DEPTH) {
      return [{ path, value: '[Max depth exceeded]' }];
    }

    if (obj === null || obj === undefined || typeof obj !== 'object') {
      return [{ path, value: obj }];
    }

    if (Array.isArray(obj) && obj.length > 50) {
      return [{ path, value: `[Array with ${obj.length} items]` }];
    }

    const keys = Object.keys(obj);

    if (keys.length > 50) {
      return [{ path, value: `{Object with ${keys.length} keys}` }];
    }

    return keys.reduce((acc, key) => {
      const currentPath = path ? `${path}.${key}` : key;
      const value = (obj as Record<string, unknown>)[key];

      if (value === null || value === undefined || typeof value !== 'object') {
        acc.push({ path: currentPath, value });
      } else {
        acc.push(...this.flattenObject(value, currentPath, depth + 1));
      }

      return acc;
    }, [] as { path: string; value: unknown }[]);
  }
}
