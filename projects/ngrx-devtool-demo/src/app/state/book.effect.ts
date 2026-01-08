import { Injectable } from '@angular/core';
import { Actions, createEffect, ofType, OnIdentifyEffects } from '@ngrx/effects';
import { BooksActions, BooksApiActions } from './book.actions';
import { GoogleBooksService } from '../book-list/book.service';
import { map, mergeMap, tap } from 'rxjs/operators';

@Injectable()
export class BooksEffects implements OnIdentifyEffects {
  loadBooks$;

  /**
   * Provides a unique identifier for this effects class.
   * Used by DevTools to track effects with a readable name even in minified builds.
   */
  ngrxOnIdentifyEffects(): string {
    return 'BooksEffects';
  }

  constructor(
    private actions$: Actions,
    private booksService: GoogleBooksService
  ) {
    this.loadBooks$ = createEffect(() =>
      this.actions$.pipe(
        ofType(BooksActions.loadBooks),
        tap(() => console.log('LoadBooks action received')),
        mergeMap(() =>
          this.booksService.getBooks().pipe(
            tap((books) => console.log('Books received:', books)),
            map((books) => BooksApiActions.retrievedBookList({ books }))
          )
        )
      )
    );
  }
}
