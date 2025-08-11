import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { loggerMetaReducer } from 'ngrx-devtool';
import { routes } from './app.routes';
import { provideClientHydration, withEventReplay } from '@angular/platform-browser';
import { booksReducer } from './state/book.reducer';
import { provideStore } from '@ngrx/store';
import { collectionReducer } from './state/collection.reducer';
import { provideHttpClient } from '@angular/common/http';
import { provideEffects } from '@ngrx/effects';
import { BooksEffects } from './state/book.effect';

export const appConfig: ApplicationConfig = {
  providers: [
    provideHttpClient(),
    provideStore(
      {books: booksReducer, collection: collectionReducer},
      {metaReducers: [loggerMetaReducer]}
    ),
    provideEffects([BooksEffects]),
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideClientHydration(withEventReplay())
  ]
};
