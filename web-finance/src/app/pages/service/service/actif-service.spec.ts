import { TestBed } from '@angular/core/testing';

import { ActifService } from './actif-service';

describe('ActifService', () => {
    let service: ActifService;

    beforeEach(() => {
        TestBed.configureTestingModule({});
        service = TestBed.inject(ActifService);
    });

    it('should be created', () => {
        expect(service).toBeTruthy();
    });
});
