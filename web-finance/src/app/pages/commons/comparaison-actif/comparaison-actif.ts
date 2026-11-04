import { Component } from '@angular/core';
import { Actif, Periode } from '@/app/commons/models/model';
import { NgClass } from '@angular/common';
import { UIChart } from 'primeng/chart';
import { TableModule } from 'primeng/table';
import { Button } from 'primeng/button';
import { SelectButton } from 'primeng/selectbutton';
import { FormsModule } from '@angular/forms';
import { MultiSelect } from 'primeng/multiselect';

@Component({
    selector: 'app-comparaison-actif',
    imports: [NgClass, UIChart, TableModule, Button, SelectButton, FormsModule, MultiSelect],
    templateUrl: './comparaison-actif.html',
    standalone: true,
    styleUrl: './comparaison-actif.scss'
})
export class ComparaisonActifComponent {
    Math = Math; // nécessaire pour utiliser Math dans le template

    actifs: any[] = [];
    selection: any[] = [];
    periodes = ['1M', '3M', '6M', '1A']; // valeurs à adapter
    periode = '1M';
    chartData: any;
    chartOptions: any;

    get meilleur(): any {
        if (!this.selection.length) return null;
        return this.selection.reduce((a, b) => (this.perf(b) > this.perf(a) ? b : a));
    }

    get plusVolatil(): any {
        if (!this.selection.length) return null;
        return this.selection.reduce((a, b) => (b.volatility30 > a.volatility30 ? b : a));
    }

    get maxPerf(): number {
        return Math.max(...this.selection.map((a) => Math.abs(this.perf(a))), 1);
    }

    perf(actif: any): number {
        return 0; // à remplacer par le calcul de performance sur la période
    }

    retirer(actif: any): void {
        this.selection = this.selection.filter((a) => a.symbol !== actif.symbol);
        this.comparer();
    }

    changerPeriode(periode: string): void {
        this.periode = periode;
        this.comparer();
    }

    comparer(): void {
        // à compléter : charger les données et remplir chartData et chartOptions
    }
}
