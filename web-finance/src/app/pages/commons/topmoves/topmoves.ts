import { Component, inject, OnInit } from '@angular/core';
import { ActifService } from '@/app/pages/service/service/actif-service';
import { TopMover, TopMoversResponse } from '@/app/models/model';

@Component({
    selector: 'app-topmoves',
    imports: [],
    templateUrl: './topmoves.html'
})
export class Topmoves implements OnInit {
    private readonly actifService = inject(ActifService);

    loading = false;
    errorMessage = '';

    activeTab: 'gagnants' | 'perdants' = 'gagnants';

    topGagnants: TopMover[] = [];
    topPerdants: TopMover[] = [];

    get currentList(): TopMover[] {
        return this.activeTab === 'gagnants' ? this.topGagnants : this.topPerdants;
    }

    ngOnInit(): void {
        this.loadTopMovers();
    }

    setTab(tab: 'gagnants' | 'perdants'): void {
        this.activeTab = tab;
    }

    loadTopMovers(): void {
        this.loading = true;
        this.errorMessage = '';

        this.actifService.getTopMovers().subscribe({
            next: (response: TopMoversResponse) => {
                this.topGagnants = [...(response.topGagnants ?? [])]
                    .sort((a, b) => b.variation - a.variation);

                this.topPerdants = [...(response.topPerdants ?? [])]
                    .sort((a, b) => a.variation - b.variation);

                this.loading = false;
            },
            error: (error: unknown) => {
                console.error('Erreur de chargement des meilleurs actifs', error);
                this.errorMessage =
                    'Impossible de charger les gagnants et les perdants.';
                this.loading = false;
            }
        });
    }

    formatCurrency(value: number): string {
        return new Intl.NumberFormat('fr-FR', {
            style: 'currency',
            currency: 'XAF',
            maximumFractionDigits: 2
        }).format(value);
    }

    formatVariation(value: number): string {
        return `${value > 0 ? '+' : ''}${value.toFixed(2)} %`;
    }

    trackByActifId(index: number, item: TopMover): number {
        return item.actifId;
    }
}
