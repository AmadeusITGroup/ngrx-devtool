import { ActionReducer, MetaReducer } from '@ngrx/store';

export function loggerMetaReducer<State>(
  reducer: ActionReducer<State>
): ActionReducer<State> {
  return function (state, action) {
    console.groupCollapsed('%c Action Dispatched:', 'color: teal', action.type);
    console.log('%c Prev State:', 'color: gray', state);
    console.log('%c Action:', 'color: blue', action);
    
    const nextState = reducer(state, action);
    
    console.log('%c Next State:', 'color: green', nextState);
    console.groupEnd();

    return nextState;
  };
}
