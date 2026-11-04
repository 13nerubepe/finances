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

    // Durée en heures, comme sur la page détail : 1 M = 30 jours, 1 A = 365 jours.
    periods = [
        { label: '1H', value: 1 },
        { label: '6H', value: 6 },
        { label: '1J', value: 24 },
        { label: '1S', value: 168 },
        { label: '1M', value: 720 },
        { label: '3M', value: 2160 },
        { label: '6M', value: 4320 },
        { label: '1A', value: 8760 }
    ];
    selectedPeriod = 720;

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

    changerPeriode(heures: number): void {
        this.selectedPeriod = heures;
        this.loadChart();
    }

    loadChart(): void {
        if (!this.selectedAsset) return;

        const fin = new Date();
        const debut = new Date(fin.getTime() - this.selectedPeriod * 3600000);
        // Une courte période n'a pas assez de bougies pour la fenêtre : on en charge au moins 48 h.
        const debutVolatilite = new Date(fin.getTime() - Math.max(this.selectedPeriod, 48) * 3600000);
        const frequence = this.selectedPeriod <= 48 ? '15min' : this.selectedPeriod <= 720 ? '1h' : '1j';
        const symbole = this.selectedAsset.symbole;

        this.loadingChart = true;
        this.errorMessage = '';
        this.chargement?.unsubscribe(); // Une réponse lente ne doit pas écraser une plus récente.

        this.chargement = forkJoin({
            // Jours entiers avec une marge : afficherCours coupe ensuite à l'heure exacte.
            cours: this.actifService.getAllAssetHistory({
                actif: symbole,
                debut: new Date(debut.getTime() - 86400000).toISOString().slice(0, 10),
                fin: new Date(fin.getTime() + 86400000).toISOString().slice(0, 10)
            }),
            // La volatilité peut manquer sans empêcher d'afficher la courbe.
            analyse: this.actifService
                .getVolatilite(symbole, frequence, FENETRE, debutVolatilite.toISOString(), fin.toISOString())
                .pipe(catchError(() => of(null)))
        }).subscribe({
            next: ({ cours, analyse }) => {
                const visibles = cours.filter((c) => new Date(c.horodatage).getTime() >= debut.getTime());
                this.afficherCours(visibles);
                this.errorMessage = visibles.length ? '' : 'Aucun cours sur cette période pour cet actif.';

                const valeur = analyse?.resume?.volatilite_derniere ?? null;
                this.volatilite = valeur === null || !visibles.length ? null : Number(valeur) * (RATIOS_EN_FRACTION ? 100 : 1);
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
                labels: cours.map((c) => this.formaterLabel(c.horodatage)),
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

    /** Heure seule sur 1 jour au plus, jour et heure sur 1 semaine, date au-delà. */
    private formaterLabel(horodatage: string): string {
        const date = new Date(horodatage);
        if (this.selectedPeriod <= 24) {
            return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
        }
        if (this.selectedPeriod <= 168) {
            return date.toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
        }
        return date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
    }

    formatNombre(valeur: number): string {
        return valeur.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
}
