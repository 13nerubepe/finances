import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CorrelationsActifs } from './correlations-actifs';

describe('CorrelationsActifs', () => {
    let component: CorrelationsActifs;
    let fixture: ComponentFixture<CorrelationsActifs>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [CorrelationsActifs]
        }).compileComponents();

        fixture = TestBed.createComponent(CorrelationsActifs);
        component = fixture.componentInstance;
        await fixture.whenStable();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });
});
