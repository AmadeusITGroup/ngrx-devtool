import { Component, EventEmitter, Input, Output } from '@angular/core';
import { Book } from '../book-list/book.model';
import { NgFor, NgForOf } from '@angular/common';

@Component({
  selector: 'app-book-collection',
  templateUrl: './book-collection.component.html',
  styleUrls: ['./book-collection.component.css'],
  imports: [NgFor, NgForOf]
})
export class BookCollectionComponent {
  @Input() books: ReadonlyArray<Book> = [];
  @Output() remove = new EventEmitter<string>();
}
