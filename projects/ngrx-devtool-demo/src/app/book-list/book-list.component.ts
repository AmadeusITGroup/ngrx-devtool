import { Component, EventEmitter, Input, Output } from '@angular/core';
import { Book } from './book.model';
import { NgFor, NgForOf } from '@angular/common';

@Component({
  selector: 'app-book-list',
  templateUrl: './book-list.component.html',
  styleUrls: ['./book-list.component.css'],
  imports: [NgFor, NgForOf]
})
export class BookListComponent {
  @Input() books: readonly Book[] = [];
  @Output() add = new EventEmitter<string>();
}
