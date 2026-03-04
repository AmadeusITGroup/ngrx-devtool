import { Component, inject, OnInit } from '@angular/core';
import { Store } from '@ngrx/store';
import { BooksActions } from './state/book.actions';
import { selectBookCollection, selectBooks } from './state/book.selectors';
import { Book } from './book-list/book.model';
import { Observable } from 'rxjs';
import { BookListComponent } from './book-list/book-list.component';
import { BookCollectionComponent } from './book-collection/book-collection.component';
import { CorrelationDebugComponent } from './correlation-debug/correlation-debug.component';
import { AsyncPipe } from '@angular/common';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  imports: [BookListComponent, BookCollectionComponent, CorrelationDebugComponent, AsyncPipe]
})
export class AppComponent implements OnInit {
  books$!: Observable<readonly Book[]>;
  bookCollection$!: Observable<readonly Book[]>;

  private readonly store = inject(Store);

  ngOnInit() {
    this.books$ = this.store.select(selectBooks);
    this.bookCollection$ = this.store.select(selectBookCollection);

    this.store.dispatch(BooksActions.loadBooks());
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
