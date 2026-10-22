import { Component, Input } from '@angular/core';
import { CorrelationActif } from '@/app/models/model';

@Component({
    selector: 'app-correlations-actifs',
    imports: [],
    templateUrl: './correlations-actifs.html',
    styleUrl: './correlations-actifs.scss'
})
export class CorrelationsActifs {
    @Input() correlations!: CorrelationActif[];
}
