import { inject, Injectable } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { createAction, props } from '@ngrx/store';
import { of, throwError, delay, map, switchMap, catchError } from 'rxjs';

export const testActions = {
  loadItems: createAction('[Test] Load Items'),
  loadItemsSuccess: createAction('[Test] Load Items Success', props<{ items: string[] }>()),
  loadItemsFailure: createAction('[Test] Load Items Failure', props<{ error: string }>()),
  addItem: createAction('[Test] Add Item', props<{ item: string }>()),
  addItemSuccess: createAction('[Test] Add Item Success', props<{ item: string }>()),
  noopAction: createAction('[Test] Noop Action'),
  triggerAsync: createAction('[Test] Trigger Async'),
  asyncComplete: createAction('[Test] Async Complete'),
};

@Injectable()
export class TestEffects {
  private readonly actions$ = inject(Actions);

  loadItems$ = createEffect(() =>
    this.actions$.pipe(
      ofType(testActions.loadItems),
      map(() => testActions.loadItemsSuccess({ items: ['item1', 'item2'] }))
    )
  );

  asyncEffect$ = createEffect(() =>
    this.actions$.pipe(
      ofType(testActions.triggerAsync),
      delay(50),
      map(() => testActions.asyncComplete())
    )
  );

  failingEffect$ = createEffect(() =>
    this.actions$.pipe(
      ofType(testActions.addItem),
      switchMap((action) => {
        if (action.item === 'fail') {
          return throwError(() => new Error('Simulated failure'));
        }
        return of(testActions.addItemSuccess({ item: action.item }));
      }),
      catchError((error) => of(testActions.loadItemsFailure({ error: error.message })))
    )
  );

  logEffect$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(testActions.noopAction),
        map(() => {
          return;
        })
      ),
    { dispatch: false }
  );
}

export interface TestState {
  items: string[];
  loading: boolean;
  error: string | null;
}

export const initialTestState: TestState = {
  items: [],
  loading: false,
  error: null,
};

export function testReducer(state = initialTestState, action: ReturnType<typeof testActions[keyof typeof testActions]>): TestState {
  switch (action.type) {
    case testActions.loadItems.type:
      return { ...state, loading: true, error: null };
    case testActions.loadItemsSuccess.type:
      return { ...state, loading: false, items: (action as ReturnType<typeof testActions.loadItemsSuccess>).items as string[] };
    case testActions.loadItemsFailure.type:
      return { ...state, loading: false, error: (action as ReturnType<typeof testActions.loadItemsFailure>).error };
    case testActions.addItemSuccess.type:
      return { ...state, items: [...state.items, (action as ReturnType<typeof testActions.addItemSuccess>).item] };
    default:
      return state;
  }
}
