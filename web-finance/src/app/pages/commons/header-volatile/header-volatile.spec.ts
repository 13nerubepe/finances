import { ComponentFixture, TestBed } from '@angular/core/testing';

import { HeaderVolatile } from './header-volatile';

describe('HeaderVolatile', () => {
    let component: HeaderVolatile;
    let fixture: ComponentFixture<HeaderVolatile>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [HeaderVolatile]
        }).compileComponents();

        fixture = TestBed.createComponent(HeaderVolatile);
        component = fixture.componentInstance;
        await fixture.whenStable();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });
});
