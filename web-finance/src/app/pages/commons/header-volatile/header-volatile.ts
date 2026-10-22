import { Component, EventEmitter, OnChanges, Output, Input, SimpleChanges, input, output } from '@angular/core';

import { ActifOption, AnalyseVolatiliteParams, OngletVolatilite } from '@/app/models/model';
import { MultiSelect } from 'primeng/multiselect';
import { FormsModule } from '@angular/forms';
import { PrimeTemplate } from 'primeng/api';
import { Select } from 'primeng/select';
import { Button } from 'primeng/button';

@Component({
    selector: 'app-header-volatile',
    standalone: true,
    imports: [FormsModule],
    templateUrl: './header-volatile.html',
    styleUrl: './header-volatile.scss'
})
export class HeaderVolatile implements OnChanges {

    // Onglet actuellement mis en avant (fourni par la page)
    ongletActif = input<string>('volatilite');

    // Émis quand l'utilisateur clique sur un onglet
    ongletChange = output<string>();

    readonly onglets: OngletVolatilite[] = [
        { id: 'volatilite', label: 'Volatilité des derniers jours' },
        { id: 'indicateurs', label: 'Indicateurs' },
        { id: 'correlations', label: 'Corrélation entre actifs' },
        { id: 'mouvements', label: 'Mouvements inhabituels' }
    ];

    selectionner(id: string): void {
        this.ongletChange.emit(id);
    }





    @Input() actifsDisponibles: ActifOption[] = [];

    @Input() actifsSelectionnes: string[] = [];

    @Input() periodeSelectionnee = 30;

    @Input() chargement = false;

    @Output()
    analyseDemandee = new EventEmitter<AnalyseVolatiliteParams>();

    // Sélection locale du composant
    actifsChoisis: string[] = [];

    periodeChoisie = 30;

    // Périodes disponibles
    periodes = [
        { label: '7 derniers jours', value: 7 },
        { label: '20 derniers jours', value: 20 },
        { label: '30 derniers jours', value: 30 },
        { label: '90 derniers jours', value: 90 },
        { label: '180 derniers jours', value: 180 },
        { label: '365 derniers jours', value: 365 }
    ];

    ngOnChanges(changes: SimpleChanges): void {
        if (changes['actifsSelectionnes']) {
            this.actifsChoisis = [...(this.actifsSelectionnes ?? [])];
        }

        if (changes['periodeSelectionnee']) {
            this.periodeChoisie = this.periodeSelectionnee ?? 30;
        }
    }

    lancerAnalyse(): void {
        if (this.chargement || this.actifsChoisis.length === 0 || !this.periodes.some((p) => p.value === this.periodeChoisie)) {
            return;
        }

        this.analyseDemandee.emit({
            actifs: [...this.actifsChoisis],
            periode: this.periodeChoisie
        });
    }

    get analyseDesactivee(): boolean {
        return this.chargement || this.actifsChoisis.length === 0;
    }
}
