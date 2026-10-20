import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GraphVolatile } from './graph-volatile';

describe('GraphVolatile', () => {
    let component: GraphVolatile;
    let fixture: ComponentFixture<GraphVolatile>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [GraphVolatile]
        }).compileComponents();

        fixture = TestBed.createComponent(GraphVolatile);
        component = fixture.componentInstance;
        await fixture.whenStable();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });
});
