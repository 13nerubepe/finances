import { Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { forkJoin, Subscription } from 'rxjs';

import { Button } from 'primeng/button';
import { Tag } from 'primeng/tag';
import { Tooltip } from 'primeng/tooltip';

import {
    AreaSeries,
    BarSeries,
    BaselineSeries,
    CandlestickSeries,
    ColorType,
    createChart,
    LineSeries
} from 'lightweight-charts';
import type { IChartApi, ISeriesApi, SeriesType, UTCTimestamp } from 'lightweight-charts';

import type { Actif, Bougie, FiltresCours, HistoricalPrice } from '@/app/models/actif-model';
import { ActifService } from '@/app/pages/service/service/actif-service';
// @ts-ignore
import { ComparateurComponent } from './comparateur.component';
import { Select } from 'primeng/select';
import { FormsModule } from '@angular/forms';
import { SelectButton } from 'primeng/selectbutton';
import { TableModule } from 'primeng/table';
import { UIChart } from 'primeng/chart'; // adapte le chemin

type TypeGraphe = 'candle' | 'line' | 'area' | 'bar' | 'baseline';


@Component({
    selector: 'app-detail-actif',
    standalone: true,
    imports: [CommonModule, Button, Tag, ComparateurComponent, Select, FormsModule, SelectButton, TableModule, UIChart],
    templateUrl: './detail-actif.html'
})
export class DetailActif implements OnInit, OnDestroy {
    // Actifs
    actifs: Actif[] = [];
    selection: Actif[] = [];
    reference: Actif | null = null;
    suggestions: Actif[] = [];

    maxActifs = 5;
    loading = false;
    errorMessage = '';

    // Périodes
    periode = '1mo';

    periodes = [
        { label: '1S', value: '5d' },
        { label: '1M', value: '1mo' },
        { label: '3M', value: '3mo' },
        { label: '6M', value: '6mo' },
        { label: '1A', value: '1y' },
        { label: '5A', value: '5y' }
    ];

    // Historiques
    historiques: any[] = [];

    // Graphique
    chartData: any = {
        labels: [],
        datasets: []
    };

    chartOptions: any = {};

    couleurs = ['#F97316', '#3B82F6', '#10B981', '#A855F7', '#EF4444'];

    private subscriptions = new Subscription();

    constructor(private actifService: ActifService) {}

    ngOnInit(): void {
        this.configurerGraphique();
        this.chargerActifs();
    }

    ngOnDestroy(): void {
        this.subscriptions.unsubscribe();
    }

    // --------------------------------------------------
    // CHARGEMENT DES ACTIFS
    // --------------------------------------------------

    chargerActifs(): void {
        this.loading = true;

        const sub = this.actifService.getAssets().subscribe({
            next: (data: Actif[]) => {
                this.actifs = data;

                // Sélection initiale de 3 actifs
                this.selection = this.actifs.slice(0, 3);

                this.reference = this.selection[0] ?? null;

                this.majSuggestions();

                if (this.selection.length >= 2) {
                    this.comparer();
                } else {
                    this.loading = false;
                }
            },

            error: (err) => {
                console.error('Erreur de chargement des actifs :', err);
                this.errorMessage = 'Impossible de charger les actifs.';
                this.loading = false;
            }
        });

        this.subscriptions.add(sub);
    }

    // --------------------------------------------------
    // GESTION DE LA SELECTION
    // --------------------------------------------------

    onSelectionChange(): void {
        if (this.selection.length > this.maxActifs) {
            this.selection = this.selection.slice(0, this.maxActifs);
        }

        if (!this.selection.some((a) => a.id === this.reference?.id)) {
            this.reference = this.selection[0] ?? null;
        }

        this.majSuggestions();
        this.comparer();
    }

    ajouter(actif: Actif): void {
        if (this.selection.length >= this.maxActifs) return;

        if (this.selection.some((a) => a.id === actif.id)) return;

        this.selection = [...this.selection, actif];

        if (!this.reference) {
            this.reference = actif;
        }

        this.majSuggestions();
        this.comparer();
    }

    retirer(actif: Actif): void {
        if (this.selection.length <= 2) return;

        this.selection = this.selection.filter((a) => a.id !== actif.id);

        if (this.reference?.id === actif.id) {
            this.reference = this.selection[0] ?? null;
        }

        this.majSuggestions();
        this.comparer();
    }

    majSuggestions(): void {
        this.suggestions = this.actifs.filter((a) => !this.selection.some((s) => s.id === a.id)).slice(0, 5);
    }

    // --------------------------------------------------
    // COULEURS
    // --------------------------------------------------

    couleur(actif: Actif): string {
        const index = this.selection.findIndex((a) => a.id === actif.id);

        if (index !== -1) {
            return this.couleurs[index % this.couleurs.length];
        }

        const indexActif = this.actifs.findIndex((a) => a.id === actif.id);

        return this.couleurs[Math.max(0, indexActif) % this.couleurs.length];
    }

    // --------------------------------------------------
    // PERIODE
    // --------------------------------------------------

    changerPeriode(value: string): void {
        this.periode = value;
        this.comparer();
    }

    get periodeLabel(): string {
        return this.periodes.find((p) => p.value === this.periode)?.label ?? '';
    }

    // --------------------------------------------------
    // COMPARAISON DES ACTIFS
    // --------------------------------------------------

    comparer(): void {
        if (this.selection.length < 2) {
            this.historiques = [];
            this.chartData = { labels: [], datasets: [] };
            this.loading = false;
            return;
        }

        this.loading = true;
        this.errorMessage = '';

        const actifsSelectionnes = [...this.selection];

        const fin = new Date();
        const debut = this.calculerDateDebut(this.periode);

        const requetes = actifsSelectionnes.map((actif) => {
            const filtres: FiltresCours = {
                actif: actif.symbole,
                debut: this.formaterDate(debut),
                fin: this.formaterDate(fin)
            };

            return this.actifService.getAllAssetHistory(filtres);
        });

        const sub = forkJoin(requetes).subscribe({
            next: (resultats: any[]) => {
                this.historiques = resultats.map((response, index) => {
                    const cours: HistoricalPrice[] = response.results ?? response;

                    return {
                        actif: actifsSelectionnes[index],
                        historique: [...cours].sort((a, b) => new Date(a.horodatage).getTime() - new Date(b.horodatage).getTime())
                    };
                });

                this.construireGraphique();

                this.loading = false;
            },

            error: (err: any) => {
                console.error('Erreur de comparaison :', err);

                this.errorMessage = 'Impossible de récupérer les historiques des actifs.';

                this.historiques = [];
                this.chartData = { labels: [], datasets: [] };

                this.loading = false;
            }
        });

        this.subscriptions.add(sub);
    }

    private calculerDateDebut(periode: string): Date {
        const date = new Date();

        switch (periode) {
            case '5d':
                date.setDate(date.getDate() - 5);
                break;

            case '1mo':
                date.setMonth(date.getMonth() - 1);
                break;

            case '3mo':
                date.setMonth(date.getMonth() - 3);
                break;

            case '6mo':
                date.setMonth(date.getMonth() - 6);
                break;

            case '1y':
                date.setFullYear(date.getFullYear() - 1);
                break;

            case '5y':
                date.setFullYear(date.getFullYear() - 5);
                break;
        }

        return date;
    }

    private formaterDate(date: Date): string {
        return date.toISOString().slice(0, 10);
    }

    // --------------------------------------------------
    // GRAPHIQUE BASE 100
    // --------------------------------------------------

    construireGraphique(): void {
        if (!this.historiques.length) return;

        const toutesLesDates = [...new Set(this.historiques.flatMap((serie) => serie.historique.map((h: { horodatage: string | any[] }) => h.horodatage.slice(0, 10))))].sort();

        const datasets = this.historiques.map((serie) => {
            const historique = serie.historique;

            const premierPrix = historique[0]?.close ?? 0;

            const estReference = serie.actif.id === this.reference?.id;

            const donnees = toutesLesDates.map((date) => {
                const cours = historique.find((h: { horodatage: string | any[] }) => h.horodatage.slice(0, 10) === date);

                return cours && premierPrix > 0 ? Number(((cours.close / premierPrix) * 100).toFixed(2)) : null;
            });

            return {
                label: serie.actif.symbole,
                data: donnees,
                borderColor: this.couleur(serie.actif),
                backgroundColor: this.couleur(serie.actif),
                borderWidth: estReference ? 4 : 2,
                pointRadius: 0,
                tension: 0.3,
                fill: false,
                spanGaps: true
            };
        });

        this.chartData = {
            labels: toutesLesDates,
            datasets
        };
    }

    // --------------------------------------------------
    // CONFIGURATION DU GRAPHIQUE
    // --------------------------------------------------

    configurerGraphique(): void {
        this.chartOptions = {
            responsive: true,
            maintainAspectRatio: false,

            interaction: {
                mode: 'index',
                intersect: false
            },

            plugins: {
                legend: {
                    position: 'bottom'
                },

                tooltip: {
                    callbacks: {
                        label: (context: any) => `${context.dataset.label}: ${context.parsed.y?.toFixed(2) ?? '—'}`
                    }
                }
            },

            scales: {
                x: {
                    grid: {
                        display: false
                    }
                },

                y: {
                    title: {
                        display: true,
                        text: 'Indice base 100'
                    }
                }
            }
        };
    }

    // --------------------------------------------------
    // CALCUL DES PERFORMANCES
    // --------------------------------------------------

    perf(actif: Actif): number {
        const serie = this.historiques.find((s) => s.actif.id === actif.id);

        if (!serie || serie.historique.length < 2) return 0;

        const debut = serie.historique[0].close;
        const fin = serie.historique[serie.historique.length - 1].close;

        if (!debut) return 0;

        return Number((((fin - debut) / debut) * 100).toFixed(2));
    }

    // --------------------------------------------------
    // PRIX ACTUEL
    // --------------------------------------------------

    prixActuel(actif: Actif): number | null {
        return actif.prix_actuel ?? null;
    }

    // --------------------------------------------------
    // VARIATION 24H
    // --------------------------------------------------

    var24h(actif: Actif): number {
        return Number((actif.variation ?? 0).toFixed(2));
    }

    // --------------------------------------------------
    // VOLATILITE
    // --------------------------------------------------

    volatilite(actif: Actif): number {
        const serie = this.historiques.find((s) => s.actif.id === actif.id);

        if (!serie || serie.historique.length < 2) return 0;

        const prix = serie.historique.map((h: { close: any }) => h.close);

        const rendements: number[] = [];

        for (let i = 1; i < prix.length; i++) {
            if (prix[i - 1] > 0) {
                rendements.push((prix[i] - prix[i - 1]) / prix[i - 1]);
            }
        }

        if (!rendements.length) return 0;

        const moyenne = rendements.reduce((a, b) => a + b, 0) / rendements.length;

        const variance = rendements.reduce((somme, r) => somme + Math.pow(r - moyenne, 2), 0) / rendements.length;

        return Number((Math.sqrt(variance) * 100).toFixed(2));
    }

    // --------------------------------------------------
    // MEILLEURE PERFORMANCE
    // --------------------------------------------------

    get meilleur(): Actif | null {
        if (!this.selection.length) return null;

        return [...this.selection].sort((a, b) => this.perf(b) - this.perf(a))[0];
    }

    // --------------------------------------------------
    // PLUS VOLATIL
    // --------------------------------------------------

    get plusVolatil(): Actif | null {
        if (!this.selection.length) return null;

        return [...this.selection].sort((a, b) => this.volatilite(b) - this.volatilite(a))[0];
    }

    // --------------------------------------------------
    // MEILLEUR ECART VS REFERENCE
    // --------------------------------------------------

    get meilleurVsRef(): Actif | null {
        const autres = this.selection.filter((a) => a.id !== this.reference?.id);

        if (!autres.length) return null;

        return [...autres].sort((a, b) => this.ecart(b) - this.ecart(a))[0];
    }

    ecart(actif: Actif): number {
        if (!this.reference) return 0;

        return Number((this.perf(actif) - this.perf(this.reference)).toFixed(2));
    }

    // --------------------------------------------------
    // PERFORMANCE MAXIMALE POUR LES BARRES
    // --------------------------------------------------

    get maxPerf(): number {
        return Math.max(1, ...this.selection.map((a) => Math.abs(this.perf(a))));
    }

    // --------------------------------------------------
    // CHANGEMENT DE REFERENCE
    // --------------------------------------------------

    majTout(): void {
        this.construireGraphique();
    }

    protected readonly Math = Math;
}
