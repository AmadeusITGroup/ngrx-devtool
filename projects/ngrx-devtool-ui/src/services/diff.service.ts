import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class DiffService {
  calculateDiff(prevState: any, nextState: any): any[] {
    const diffs: any[] = [];
    
    // Handle null states
    if (!prevState) return this.flattenObject(nextState).map(item => ({
      path: item.path,
      newValue: item.value,
      type: 'added'
    }));
    
    if (!nextState) return this.flattenObject(prevState).map(item => ({
      path: item.path,
      oldValue: item.value,
      type: 'removed'
    }));

    // Get flattened representation of both objects
    const prevFlat = this.flattenObject(prevState);
    const nextFlat = this.flattenObject(nextState);
    
    // Find removed and changed items
    prevFlat.forEach(prevItem => {
      const nextItem = nextFlat.find(item => item.path === prevItem.path);
      
      if (!nextItem) {
        diffs.push({
          path: prevItem.path,
          oldValue: prevItem.value,
          type: 'removed'
        });
      } else if (JSON.stringify(prevItem.value) !== JSON.stringify(nextItem.value)) {
        diffs.push({
          path: prevItem.path,
          oldValue: prevItem.value,
          newValue: nextItem.value,
          type: 'changed'
        });
      }
    });
    
    // Find added items
    nextFlat.forEach(nextItem => {
      const prevItem = prevFlat.find(item => item.path === nextItem.path);
      
      if (!prevItem) {
        diffs.push({
          path: nextItem.path,
          newValue: nextItem.value,
          type: 'added'
        });
      }
    });

    return diffs;
  }

  private flattenObject(obj: any, path: string = ''): {path: string, value: any}[] {
    if (!obj || typeof obj !== 'object') {
      return [{ path, value: obj }];
    }

    return Object.keys(obj).reduce((acc, key) => {
      const currentPath = path ? `${path}.${key}` : key;
      
      if (obj[key] === null || typeof obj[key] !== 'object') {
        acc.push({ path: currentPath, value: obj[key] });
      } else {
        acc = acc.concat(this.flattenObject(obj[key], currentPath));
      }
      
      return acc;
    }, [] as {path: string, value: any}[]);
  }
}