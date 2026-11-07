import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';

import { ActifComponent } from './actif';

describe('Actif', () => {
    let component: ActifComponent;
    let fixture: ComponentFixture<ActifComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [ActifComponent],
            providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])]
        }).compileComponents();

        fixture = TestBed.createComponent(ActifComponent);
        component = fixture.componentInstance;
        await fixture.whenStable();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });
});
