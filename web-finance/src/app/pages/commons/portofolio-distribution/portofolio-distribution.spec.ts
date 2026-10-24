import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PortofolioDistribution } from './portofolio-distribution';

describe('PortofolioDistribution', () => {
    let component: PortofolioDistribution;
    let fixture: ComponentFixture<PortofolioDistribution>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [PortofolioDistribution]
        }).compileComponents();

        fixture = TestBed.createComponent(PortofolioDistribution);
        component = fixture.componentInstance;
        await fixture.whenStable();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });
});
