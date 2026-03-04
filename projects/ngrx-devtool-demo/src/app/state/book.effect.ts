import { inject, Injectable } from '@angular/core';
import { Actions, createEffect, ofType, OnIdentifyEffects } from '@ngrx/effects';
import { BooksActions, BooksApiActions } from './book.actions';
import { GoogleBooksService } from '../book-list/book.service';
import { delay, map, mergeMap, tap } from 'rxjs/operators';

@Injectable()
export class BooksEffects implements OnIdentifyEffects {
  private readonly actions$ = inject(Actions);
  private readonly booksService = inject(GoogleBooksService);

  loadBooks$ = createEffect(() =>
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

  searchBooks$ = createEffect(() =>
    this.actions$.pipe(
      ofType(BooksActions.searchBooks),
      mergeMap(({ query }) =>
        this.booksService.searchBooks(query).pipe(
          delay(300),
          map((books) => BooksApiActions.searchResults({ books }))
        )
      )
    )
  );

  ngrxOnIdentifyEffects(): string {
    return 'BooksEffects';
  }
}
