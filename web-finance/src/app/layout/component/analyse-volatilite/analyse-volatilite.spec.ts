import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AnalyseVolatilite } from './analyse-volatilite';

describe('AnalyseVolatilite', () => {
    let component: AnalyseVolatilite;
    let fixture: ComponentFixture<AnalyseVolatilite>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [AnalyseVolatilite]
        }).compileComponents();

        fixture = TestBed.createComponent(AnalyseVolatilite);
        component = fixture.componentInstance;
        await fixture.whenStable();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });
});
