import { ChangeDetectorRef, Component, inject, OnInit } from '@angular/core';
import { ActifService } from '@/app/pages/service/service/actif-service';
import { TopMover, TopMoversResponse } from '@/app/models/actif-model';

@Component({
    selector: 'app-topmoves',
    imports: [],
    templateUrl: './topmoves.html'
})
export class Topmoves implements OnInit {
    private readonly actifService = inject(ActifService);
    private readonly cdr = inject(ChangeDetectorRef);

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

    loadTopMovers(): void {
        this.loading = true;
        this.errorMessage = '';

        this.actifService.getTopMovers().subscribe({
            next: (response: TopMoversResponse) => {
                this.topGagnants = [...(response.gainers ?? [])].sort((a, b) => b.changePercent - a.changePercent);
                this.topPerdants = [...(response.losers ?? [])].sort((a, b) => a.changePercent - b.changePercent);
                this.loading = false;
                this.cdr.markForCheck();
            },
            error: (error: unknown) => {
                console.error('Erreur de chargement des meilleurs actifs', error);
                this.errorMessage = 'Impossible de charger les gagnants et les perdants.';
                this.loading = false;
                this.cdr.markForCheck();
            }
        });
    }
}
