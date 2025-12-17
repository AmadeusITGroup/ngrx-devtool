import { Component, inject, OnInit } from '@angular/core';
import { Store } from '@ngrx/store';
import { BooksActions } from './state/book.actions';
import { map, mergeMap, tap } from 'rxjs/operators';

import { selectBookCollection, selectBooks } from './state/book.selectors';
import { BooksApiActions } from './state/book.actions';
import { GoogleBooksService } from './book-list/book.service';
import { Book } from './book-list/book.model';
import { Observable } from 'rxjs';
import { BookListComponent } from './book-list/book-list.component';
import { BookCollectionComponent } from './book-collection/book-collection.component';
import { AsyncPipe, NgFor, NgIf } from '@angular/common';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  imports: [BookListComponent, BookCollectionComponent, NgFor, AsyncPipe, NgIf]
})
export class AppComponent implements OnInit {
  books$!: Observable<ReadonlyArray<Book>>;
  bookCollection$!: Observable<ReadonlyArray<Book>>;

  private readonly booksService = inject(GoogleBooksService);
  private readonly store = inject(Store);

  ngOnInit() {
    this.books$ = this.store.select(selectBooks);
    this.bookCollection$ = this.store.select(selectBookCollection);

    this.booksService
      .getBooks()
      .subscribe((books: Book[]) =>
        this.store.dispatch(BooksApiActions.retrievedBookList({ books }))
      );
  }

  onAdd(bookId: string) {
    this.store.dispatch(BooksActions.addBook({ bookId }));
  }

  onRemove(bookId: string) {
    this.store.dispatch(BooksActions.removeBook({ bookId }));
  }

  fetchBooks() {
    this.store.dispatch(BooksActions.loadBooks());
  }
}
