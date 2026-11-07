import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';

import { AnalyseActif } from './analyse-actif';

describe('AnalyseActif', () => {
    let component: AnalyseActif;
    let fixture: ComponentFixture<AnalyseActif>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [AnalyseActif],
            providers: [provideHttpClient(), provideHttpClientTesting()]
        }).compileComponents();

        fixture = TestBed.createComponent(AnalyseActif);
        component = fixture.componentInstance;
        fixture.componentRef.setInput('symbole', 'AAPL');
        await fixture.whenStable();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });
});
