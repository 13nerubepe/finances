import { Component, Input } from '@angular/core';
import { MouvementInhabituel } from '@/app/models/model';

@Component({
    selector: 'app-mouvements-inhabituels',
    imports: [],
    templateUrl: './mouvements-inhabituels.html',
    styleUrl: './mouvements-inhabituels.scss'
})
export class MouvementsInhabituels {
    @Input() mouvements!: MouvementInhabituel[];
}
