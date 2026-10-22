import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DetailActif } from './detail-actif';

describe('DetailActif', () => {
    let component: DetailActif;
    let fixture: ComponentFixture<DetailActif>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [DetailActif]
        }).compileComponents();

        fixture = TestBed.createComponent(DetailActif);
        component = fixture.componentInstance;
        await fixture.whenStable();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });
});
