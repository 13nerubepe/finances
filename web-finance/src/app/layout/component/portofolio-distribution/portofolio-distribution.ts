import { Component, inject } from '@angular/core';
import { ChartData, ChartOptions } from 'chart.js';
import { DecimalPipe } from '@angular/common';
import { UIChart } from 'primeng/chart';
import { ActifService } from '@/app/layout/service/actif-service';
import { PortfolioDistributionItem, PortfolioDistributionResponse, TopMoversResponse } from '@/app/models/model';
import { Observable } from 'rxjs';

@Component({
    selector: 'app-portofolio-distribution',
    imports: [DecimalPipe, UIChart],
    templateUrl: './portofolio-distribution.html',
    styleUrl: './portofolio-distribution.scss'
})
export class PortofolioDistribution {
    private readonly actifService = inject(ActifService);

    loading = false;
    errorMessage = '';
    totalValue = 0;

    distribution: PortfolioDistributionItem[] = [];

    private readonly colors = [
        '#3B82F6',
        '#10B981',
        '#F59E0B',
        '#8B5CF6',
        '#EF4444',
        '#06B6D4',
        '#EC4899',
        '#64748B'
    ];

    chartData: ChartData<'doughnut', number[], string> = {
        labels: [],
        datasets: [{
            data: [],
            backgroundColor: [],
            borderColor: '#ffffff',
            borderWidth: 3,
            hoverOffset: 8
        }]
    };

    chartOptions: ChartOptions<'doughnut'> = {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '72%',
        plugins: {
            legend: {
                display: false
            },
            tooltip: {
                callbacks: {
                    label: (context) =>
                        `${context.label}: ${Number(context.raw).toFixed(2)} %`
                }
            }
        }
    };

    ngOnInit(): void {
        this.loadPortfolioDistribution();
    }

    loadPortfolioDistribution(): void {
        this.loading = true;
        this.errorMessage = '';

        this.actifService.getPortfolioDistribution().subscribe({
            next: (response: PortfolioDistributionResponse) => {
                this.totalValue = response.totalValue ?? 0;
                this.distribution = response.distribution ?? [];

                this.chartData = {
                    labels: this.distribution.map(item => item.symbol),
                    datasets: [{
                        data: this.distribution.map(item =>
                            this.getPercentage(item.totalValue)
                        ),
                        backgroundColor: this.distribution.map(
                            (_, index) =>
                                this.colors[index % this.colors.length]
                        ),
                        borderColor: '#ffffff',
                        borderWidth: 3,
                        hoverOffset: 8
                    }]
                };

                this.loading = false;
            },
            error: (error: unknown) => {
                console.error('Erreur de chargement', error);
                this.errorMessage =
                    'Impossible de charger la répartition du portefeuille.';
                this.loading = false;
            }
        });
    }

    formatCurrency(value: number): string {
        return new Intl.NumberFormat('fr-FR', {
            style: 'currency',
            currency: 'XAF',
            maximumFractionDigits: 0
        }).format(value);
    }

    getPercentage(value: number): number {
        return this.totalValue > 0
            ? (value / this.totalValue) * 100
            : 0;
    }

    getColor(index: number): string {
        return this.colors[index % this.colors.length];
    }


}
