import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';

import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { Book } from './book.model';

const FALLBACK_BOOKS: Book[] = [
  { id: '1', volumeInfo: { title: 'Awakenings', authors: ['Oliver Sacks'] } },
  { id: '2', volumeInfo: { title: 'The Man Who Mistook His Wife for a Hat', authors: ['Oliver Sacks'] } },
  { id: '3', volumeInfo: { title: 'An Anthropologist on Mars', authors: ['Oliver Sacks'] } },
  { id: '4', volumeInfo: { title: 'Musicophilia', authors: ['Oliver Sacks'] } },
  { id: '5', volumeInfo: { title: 'The Island of the Colourblind', authors: ['Oliver Sacks'] } },
];

@Injectable({ providedIn: 'root' })
export class GoogleBooksService {
  private readonly http = inject(HttpClient);

  getBooks(): Observable<Book[]> {
    return this.http
      .get<{ items: Book[] }>(
        'https://www.googleapis.com/books/v1/volumes?maxResults=5&orderBy=relevance&q=oliver%20sacks'
      )
      .pipe(
        map((books) => books.items || []),
        catchError(() => of(FALLBACK_BOOKS))
      );
  }

  searchBooks(query: string): Observable<Book[]> {
    return this.http
      .get<{ items: Book[] }>(
        `https://www.googleapis.com/books/v1/volumes?maxResults=5&orderBy=relevance&q=${encodeURIComponent(query)}`
      )
      .pipe(
        map((books) => books.items || []),
        catchError(() => of(FALLBACK_BOOKS))
      );
  }
}
