
import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output, OnInit, inject, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs';

import { ChartModule } from 'primeng/chart';
import { SelectButtonModule } from 'primeng/selectbutton';

import {
    Actif, ActifOption, AnalyseVolatiliteParams,
    HistoricalPrice,
    PeriodOption
} from '@/app/models/model';

import { ActifService } from '@/app/pages/service/service/actif-service';

@Component({
    selector: 'app-body-graph-volatile',
    standalone: true,
    imports: [
        CommonModule,
        FormsModule,
        ChartModule,
        SelectButtonModule
    ],
    host: {
        class: 'block min-w-0'
    },
    templateUrl: './body-graph-volatile.html'
})
export class BodyGraphVolatile implements OnInit {

    jours = input<number>(30);
    chargement = input<boolean>(false);
    donneesGraphique = input<any>({ labels: [], datasets: [] });
    optionsGraphique = input<any>({});
    legende = input<any[]>([]);

    joursChange = output<number>();

    periodes = [
        { label: '7 jours', value: 7 },
        { label: '30 jours', value: 30 },
        { label: '90 jours', value: 90 },
        { label: '180 jours', value: 180 }
    ];

    @Input() actifsDisponibles: ActifOption[] = [];
    @Input() actifsSelectionnes: ActifOption[] = [];

    @Output() analyseDemandee = new EventEmitter<AnalyseVolatiliteParams[]>();


    private readonly actifService = inject(ActifService);

    // @Input() actifsDisponibles: Actif[] = [];
    // @Input() actifsSelectionnes: Actif[] = [];
    @Input() periodeSelectionnee = 30;

    // @Output() analyseDemandee = new EventEmitter<Actif[]>();
    @Output() periodeChange = new EventEmitter<number>();

    loadingAssets = false;
    loadingChart = false;
    errorMessage = '';

    assets: Actif[] = [];
    selectedAsset: Actif | null = null;

    periods: PeriodOption[] = [
        { label: '7 jours', value: '1W' },
        { label: '1 mois', value: '1M' },
        { label: '6 mois', value: '6M' },
        { label: '1 an', value: '1Y' }
    ];

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

    get periodeSelectionneeApi(): string {
        const periodMap: Record<number, string> = {
            7: '1W',
            30: '1M',
            180: '6M',
            365: '1Y'
        };

        return periodMap[this.periodeSelectionnee] ?? '1M';
    }

    loadAssets(): void {
        this.loadingAssets = true;
        this.errorMessage = '';

        this.actifService.getAssets()
            .pipe(finalize(() => this.loadingAssets = false))
            .subscribe({
                next: (assets) => {
                    this.assets = assets ?? [];

                    if (this.assets.length === 0) {
                        this.selectedAsset = null;
                        this.clearChart();
                        this.errorMessage = 'Aucun actif disponible.';
                        return;
                    }

                    const selectedId = this.actifsSelectionnes[0]?.value;

                    this.selectedAsset =
                        this.assets.find(a => a.actifId === Number(selectedId)) ??
                        this.assets[0];

                    this.loadChart();
                },
                error: (error) => {
                    console.error('Erreur de chargement des actifs :', error);
                    this.errorMessage = 'Impossible de charger les actifs du marché.';
                }
            });
    }

    onAssetChange(asset: Actif | null): void {
        this.selectedAsset = asset;

        if (asset) {
            this.loadChart();
        } else {
            this.clearChart();
        }
    }

    onPeriodChange(period: number): void {
        this.periodeChange.emit(period);
    }

    loadChart(): void {
        if (!this.selectedAsset) {
            this.clearChart();
            return;
        }

        this.loadingChart = true;
        this.errorMessage = '';

        this.actifService
            .getAssetHistory(
                this.selectedAsset.actifId,
                this.periodeSelectionneeApi
            )
            .pipe(finalize(() => this.loadingChart = false))
            .subscribe({
                next: (history: HistoricalPrice[]) => {
                    const rows = [...(history ?? [])].sort(
                        (a, b) =>
                            new Date(a.date).getTime() -
                            new Date(b.date).getTime()
                    );

                    this.chartData = {
                        labels: rows.map(
                            item => new Date(item.date).toLocaleDateString('fr-FR')
                        ),
                        datasets: rows.length
                            ? [{
                                label: `Cours de ${this.selectedAsset?.symbol ?? ''}`,
                                data: rows.map(item => Number(item.close)),
                                borderColor: '#048216',
                                backgroundColor: 'rgba(4, 130, 22, 0.10)',
                                fill: true,
                                tension: 0.35,
                                borderWidth: 2,
                                pointRadius: 2,
                                pointHoverRadius: 5
                            }]
                            : []
                    };

                    if (rows.length === 0) {
                        this.errorMessage =
                            'Aucune donnée historique pour cette période.';
                    }
                },
                error: (error) => {
                    console.error('Erreur de chargement de l’historique :', error);
                    this.clearChart();
                    this.errorMessage =
                        'Impossible de charger les données du graphique.';
                }
            });
    }

    // demanderAnalyse(): void {
    //     const actifs: string[] = this.actifsSelectionnes.map(
    //         (actif: ActifOption) => actif.value);
    //
    //     this.analyseDemandee.emit(actifs);
    // }

    // demanderAnalyse(): void {
    //     const params: AnalyseVolatiliteParams = {
    //         actifs: this.actifsSelectionnes.map(
    //             (actif: ActifOption) => actif.value
    //         ),
    //         periode: this.periodeSelectionnee
    //     };
    //
    //     this.analyseDemandee.emit(params);
    // }

    private clearChart(): void {
        this.chartData = {
            labels: [],
            datasets: []
        };
    }
}

