import { TestBed } from '@angular/core/testing';

import { NgrxDevtoolService } from './ngrx-devtool.service';

describe('NgrxDevtoolService', () => {
  let service: NgrxDevtoolService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(NgrxDevtoolService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
