import { Component, Input } from '@angular/core';
import { DonneeVolatilite } from '@/app/models/actif-model';

@Component({
    selector: 'app-graph-volatile',
    imports: [],
    templateUrl: './graph-volatile.html',
    styleUrl: './graph-volatile.scss'
})
export class GraphVolatile {
    @Input() donnees!: DonneeVolatilite[];
    @Input() days!: number;
}
