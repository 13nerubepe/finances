import { ComponentFixture, TestBed } from '@angular/core/testing';

import { IndicateursVolatile } from './indicateurs-volatile';

describe('IndicateursVolatile', () => {
    let component: IndicateursVolatile;
    let fixture: ComponentFixture<IndicateursVolatile>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [IndicateursVolatile]
        }).compileComponents();

        fixture = TestBed.createComponent(IndicateursVolatile);
        component = fixture.componentInstance;
        await fixture.whenStable();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });
});
