import { ChangeDetectorRef, Component, inject, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ChartModule } from 'primeng/chart';
import { Select } from 'primeng/select';
import { catchError, forkJoin, of, Subscription } from 'rxjs';

import type { Actif, HistoricalPrice } from '@/app/models/actif-model';
import { ActifService } from '@/app/pages/service/service/actif-service';

/** true si l'API renvoie 0.025 pour 2,5 %. Mets false si elle renvoie déjà 2.5. */
const RATIOS_EN_FRACTION = true;
const FENETRE = 20;

@Component({
    selector: 'app-market-evolution-widget',
    standalone: true,
    imports: [FormsModule, ChartModule, Select],
    templateUrl: './market-evolution-widget.html'
})
export class MarketEvolutionWidget implements OnInit, OnDestroy {
    private readonly actifService = inject(ActifService);
    private readonly cdr = inject(ChangeDetectorRef);
    private chargement?: Subscription;

    assets: Actif[] = [];
    selectedAsset: Actif | null = null;

    periods = [
        { label: '1S', value: 7 },
        { label: '1M', value: 30 },
        { label: '3M', value: 90 },
        { label: '6M', value: 180 },
        { label: '1A', value: 365 }
    ];
    selectedPeriod = 30;

    loadingAssets = false;
    loadingChart = false;
    errorMessage = '';

    dernierCours: number | null = null;
    performance: number | null = null;
    volatilite: number | null = null;

    chartData: { labels: string[]; datasets: object[] } = { labels: [], datasets: [] };
    chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: { legend: { display: false } },
        scales: {
            x: { grid: { display: false }, ticks: { color: '#787b86', maxTicksLimit: 6, maxRotation: 0 } },
            y: { position: 'right', grid: { color: 'rgba(120, 123, 134, 0.15)' }, ticks: { color: '#787b86' } }
        }
    };

    ngOnInit(): void {
        this.loadAssets();
    }

    ngOnDestroy(): void {
        this.chargement?.unsubscribe();
    }

    loadAssets(): void {
        this.loadingAssets = true;
        this.errorMessage = '';

        this.actifService.getAssets().subscribe({
            next: (actifs: Actif[]) => {
                this.assets = actifs;
                this.selectedAsset = actifs[0] ?? null;
                this.loadingAssets = false;

                if (this.selectedAsset) this.loadChart();
                this.cdr.markForCheck();
            },
            error: (erreur) => {
                console.error('Erreur de chargement des actifs :', erreur);
                this.errorMessage = 'Impossible de charger les actifs.';
                this.loadingAssets = false;
                this.cdr.markForCheck();
            }
        });
    }

    changerPeriode(jours: number): void {
        this.selectedPeriod = jours;
        this.loadChart();
    }

    loadChart(): void {
        if (!this.selectedAsset) return;

        const fin = new Date();
        const debut = new Date(fin.getTime() - this.selectedPeriod * 86400000);
        const symbole = this.selectedAsset.symbole;

        this.loadingChart = true;
        this.errorMessage = '';
        this.chargement?.unsubscribe(); // Une réponse lente ne doit pas écraser une plus récente.

        this.chargement = forkJoin({
            cours: this.actifService.getAllAssetHistory({
                actif: symbole,
                debut: debut.toISOString(),
                fin: fin.toISOString()
            }),
            // La volatilité peut manquer sans empêcher d'afficher la courbe.
            analyse: this.actifService
                .getVolatilite(symbole, '1j', FENETRE, debut.toISOString(), fin.toISOString())
                .pipe(catchError(() => of(null)))
        }).subscribe({
            next: ({ cours, analyse }) => {
                this.afficherCours(cours);

                const valeur = analyse?.resume?.volatilite_derniere ?? null;
                this.volatilite = valeur === null ? null : Number(valeur) * (RATIOS_EN_FRACTION ? 100 : 1);
                this.loadingChart = false;
                this.cdr.markForCheck();
            },
            error: (erreur) => {
                console.error('Erreur de chargement des cours :', erreur);
                this.chartData = { labels: [], datasets: [] };
                this.dernierCours = this.performance = this.volatilite = null;
                this.errorMessage = 'Impossible de charger les cours de cet actif.';
                this.loadingChart = false;
                this.cdr.markForCheck();
            }
        });
    }

    private afficherCours(cours: HistoricalPrice[]): void {
        const prix = cours.map((c) => Number(c.close));
        const premier = prix[0];
        const dernier = prix[prix.length - 1];
        const hausse = dernier >= premier;
        const couleur = hausse ? '#089981' : '#f23645';

        this.dernierCours = prix.length ? dernier : null;
        this.performance = prix.length > 1 && premier ? ((dernier - premier) / premier) * 100 : null;
        this.chartData = prix.length
            ? {
                labels: cours.map((c) =>
                    new Date(c.horodatage).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })
                ),
                datasets: [
                    {
                        label: this.selectedAsset?.symbole,
                        data: prix,
                        borderColor: couleur,
                        backgroundColor: hausse ? 'rgba(8, 153, 129, 0.08)' : 'rgba(242, 54, 69, 0.08)',
                        borderWidth: 2,
                        pointRadius: 0,
                        pointHoverRadius: 4,
                        tension: 0.2,
                        fill: true
                    }
                ]
            }
            : { labels: [], datasets: [] };
    }

    formatNombre(valeur: number): string {
        return valeur.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
}
