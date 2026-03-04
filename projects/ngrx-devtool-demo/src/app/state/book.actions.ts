import { createActionGroup, emptyProps, props } from '@ngrx/store';
import { Book } from '../book-list/book.model';

export const BooksActions = createActionGroup({
  source: 'Books',
  events: {
    'Add Book': props<{ bookId: string }>(),
    'Remove Book': props<{ bookId: string }>(),
    'Load Books': emptyProps(),
    'Search Books': props<{ query: string }>(),
  },
});

export const BooksApiActions = createActionGroup({
  source: 'Books API',
  events: {
    'Retrieved Book List': props<{ books: readonly Book[] }>(),
    'Search Results': props<{ books: readonly Book[] }>(),
  },
});
