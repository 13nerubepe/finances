import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AnalyseActif } from './analyse-actif';

describe('AnalyseActif', () => {
    let component: AnalyseActif;
    let fixture: ComponentFixture<AnalyseActif>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [AnalyseActif]
        }).compileComponents();

        fixture = TestBed.createComponent(AnalyseActif);
        component = fixture.componentInstance;
        await fixture.whenStable();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });
});
