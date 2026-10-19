import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ChartModule } from 'primeng/chart';
import { SelectButtonModule } from 'primeng/selectbutton';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs';
import { HistoricalPrice, MarketAsset, PeriodOption } from '@/app/models/model';
import { ActifService } from '@/app/layout/service/actif-service';

@Component({
    standalone: true,
    selector: 'app-market-evolution-widget',
    imports: [CommonModule, ChartModule, SelectButtonModule, FormsModule],
    templateUrl: './market-evolution-widget.html'
})
export class MarketEvolutionWidget {
    private readonly actifService = inject(ActifService);

    selectedPeriod = '1M';

    loading = false;

    periods: PeriodOption[]  = [
        { label: '1J', value: '1D' },
        { label: '1S', value: '1W' },
        { label: '1M', value: '1M' },
        { label: '6M', value: '6M' },
        { label: '1A', value: '1Y' }
    ];


    assets: MarketAsset[] = [];
    selectedAsset: MarketAsset | null = null;

    loadingAssets = false;
    loadingChart = false;
    errorMessage = '';

    chartData: any = {
        labels: [],
        datasets: []
    };

    chartOptions: any = {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
            intersect: false,
            mode: 'index'
        },
        plugins: {
            legend: {
                display: false
            },
            tooltip: {
                enabled: true
            }
        },
        scales: {
            x: {
                grid: {
                    display: false
                },
                ticks: {
                    maxTicksLimit: 8,
                    maxRotation: 0
                }
            },
            y: {
                beginAtZero: false,
                grid: {
                    color: 'rgba(148, 163, 184, 0.15)'
                }
            }
        }
    };

    ngOnInit(): void {
        this.loadAssets();
    }

    /**
     * Charge les actifs depuis l'API.
     */
    loadAssets(): void {
        this.loadingAssets = true;
        this.errorMessage = '';

        this.actifService.getAssets()
            .pipe(
                finalize(() => {
                    this.loadingAssets = false;
                })
            )
            .subscribe({
                next: (assets) => {
                    this.assets = assets ?? [];

                    if (this.assets.length === 0) {
                        this.selectedAsset = null;
                        this.clearChart();
                        this.errorMessage = 'Aucun actif disponible.';
                        return;
                    }

                    // Sélection automatique du premier actif.
                    this.onAssetChange(this.assets[0]);
                },
                error: (error) => {
                    console.error(
                        'Erreur lors du chargement des actifs :',
                        error
                    );

                    this.errorMessage =
                        'Impossible de charger les actifs du marché.';
                }
            });
    }

    /**
     * Sélectionne un actif et recharge son historique.
     */
    onAssetChange(asset: MarketAsset): void {
        this.selectedAsset = asset;
        this.loadChart();
    }

    /**
     * Recharge le graphique lorsque la période change.
     */
    onPeriodChange(): void {
        if (this.selectedAsset) {
            this.loadChart();
        }
    }

    /**
     * Récupère les cours historiques et construit le graphique.
     */
    loadChart(): void {
        if (!this.selectedAsset) {
            this.clearChart();
            return;
        }

        this.loadingChart = true;
        this.errorMessage = '';

        this.actifService.getAssetHistory(
            this.selectedAsset.id,
            this.selectedPeriod
        )
            .pipe(
                finalize(() => {
                    this.loadingChart = false;
                })
            )
            .subscribe({
                next: (history: HistoricalPrice[]) => {
                    const rows = [...(history ?? [])].sort(
                        (a, b) =>
                            new Date(a.date).getTime() -
                            new Date(b.date).getTime()
                    );

                    this.chartData = {
                        labels: rows.map((item) =>
                            new Date(item.date).toLocaleDateString('fr-FR')
                        ),
                        datasets: [
                            {
                                label: `Cours de ${this.selectedAsset?.symbol ?? ''}`,
                                data: rows.map((item) => Number(item.close)),
                                borderColor: '#048216',
                                backgroundColor: 'rgba(4, 130, 22, 0.10)',
                                fill: true,
                                tension: 0.35,
                                borderWidth: 2,
                                pointRadius: 2,
                                pointHoverRadius: 5
                            }
                        ]
                    };

                    if (rows.length === 0) {
                        this.errorMessage =
                            'Aucune donnée historique pour cette période.';
                    }
                },
                error: (error) => {
                    console.error(
                        'Erreur lors du chargement de l’historique :',
                        error
                    );

                    this.clearChart();
                    this.errorMessage =
                        'Impossible de charger les données du graphique.';
                }
            });
    }

    /**
     * Réinitialise le graphique.
     */
    private clearChart(): void {
        this.chartData = {
            labels: [],
            datasets: []
        };
    }

    // loadChart(): void {
    //     // Vérifier qu'un actif est sélectionné
    //     if (this.selectedAssetId == null) {
    //         this.chartData = {
    //             labels: [],
    //             datasets: []
    //         };
    //         return;
    //     }
    //
    //     this.loading = true;
    //     this.errorMessage = '';
    //
    //     this.actifService.getAssetHistory(
    //         this.selectedAssetId,
    //         this.selectedPeriod
    //     ).subscribe({
    //         next: (history) => {
    //             // Préparer les dates pour l'axe horizontal
    //             const labels = history.map(
    //                 (item) => item.date
    //             );
    //
    //             // Préparer les cours de clôture pour l'axe vertical
    //             const prices = history.map(
    //                 (item) => item.close
    //             );
    //
    //             // Construire les données du graphique
    //             this.chartData = {
    //                 labels,
    //                 datasets: [
    //                     {
    //                         label: 'Cours de clôture',
    //                         data: prices,
    //                         fill: true,
    //                         tension: 0.4,
    //                         borderColor: '#3B82F6',
    //                         backgroundColor: 'rgba(59, 130, 246, 0.12)',
    //                         pointBackgroundColor: '#3B82F6',
    //                         pointRadius: 2,
    //                         pointHoverRadius: 5
    //                     }
    //                 ]
    //             };
    //
    //             this.loading = false;
    //         },
    //
    //         error: (error) => {
    //             console.error(
    //                 'Erreur lors du chargement de l’historique :',
    //                 error
    //             );
    //
    //             this.chartData = {
    //                 labels: [],
    //                 datasets: []
    //             };
    //
    //             this.errorMessage =
    //                 'Impossible de charger l’historique des cours. Veuillez réessayer.';
    //
    //             this.loading = false;
    //         }
    //     });
    // }
}
