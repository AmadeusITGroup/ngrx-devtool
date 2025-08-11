// books.effects.ts
import { Injectable } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { BooksActions, BooksApiActions } from './book.actions';
import { GoogleBooksService } from '../book-list/book.service';
import { map, mergeMap, tap } from 'rxjs/operators';

@Injectable()
export class BooksEffects {
  loadBooks$;

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
