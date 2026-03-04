import { createReducer, on } from '@ngrx/store';

import { BooksApiActions } from './book.actions';
import { Book } from '../book-list/book.model';

export const initialState: readonly Book[] = [];

export const booksReducer = createReducer(
  initialState,
  on(BooksApiActions.retrievedBookList, (_state, { books }) => books),
  on(BooksApiActions.searchResults, (_state, { books }) => books)
);
