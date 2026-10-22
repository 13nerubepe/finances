import { Component, Input } from '@angular/core';
import { IndicateursVolatilite } from '@/app/models/model';

@Component({
    selector: 'app-indicateurs-volatile',
    imports: [],
    templateUrl: './indicateurs-volatile.html',
    styleUrl: './indicateurs-volatile.scss'
})
export class IndicateursVolatile {
    @Input() indicateurs!: IndicateursVolatilite;
}
