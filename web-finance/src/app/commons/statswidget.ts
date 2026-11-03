import { ChangeDetectorRef, Component, inject, OnInit } from '@angular/core';

import type { Actif } from '@/app/models/actif-model';
import { ActifService } from '@/app/pages/service/service/actif-service';

interface Kpi {
    titre: string;
    valeur: string;
    detail: string;
    icone: string;
    couleur: string;
    fond: string;
}

@Component({
    standalone: true,
    selector: 'app-stats-widget',
    template: `
        @for (kpi of kpis; track kpi.titre) {
            <div class="col-span-12 lg:col-span-6 xl:col-span-3">
                <div class="flex h-full items-start justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm dark:border-slate-700 dark:bg-slate-900">
                    <div class="min-w-0">
                        <p class="m-0 text-xs text-slate-500 dark:text-slate-400">{{ kpi.titre }}</p>
                        <p class="mb-0 mt-1 truncate text-xl font-bold tabular-nums text-slate-900 dark:text-white">{{ kpi.valeur }}</p>
                        <p class="mb-0 mt-1 truncate text-xs text-slate-500 dark:text-slate-400">{{ kpi.detail }}</p>
                    </div>
                    <div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg" [style.background]="kpi.fond" [style.color]="kpi.couleur">
                        <i class="pi" [class]="kpi.icone"></i>
                    </div>
                </div>
            </div>
        }
    `
})
export class StatsWidget implements OnInit {
    private readonly actifService = inject(ActifService);
    private readonly cdr = inject(ChangeDetectorRef);

    kpis: Kpi[] = this.creerKpis([]);

    ngOnInit(): void {
        this.actifService.getAssets().subscribe({
            next: (actifs: Actif[]) => {
                this.kpis = this.creerKpis(actifs.filter((actif) => actif.est_suivi !== false));
                this.cdr.markForCheck();
            },
            error: (erreur) => console.error('Erreur de chargement des KPI :', erreur)
        });
    }

    private creerKpis(actifs: Actif[]): Kpi[] {
        const compter = (type: Actif['type_actif']) => actifs.filter((actif) => actif.type_actif === type).length;
        const avecVariation = actifs
            .map((actif) => ({ actif, variation: this.nombre(actif.variation) }))
            .filter((ligne): ligne is { actif: Actif; variation: number } => ligne.variation !== null);

        const hausses = avecVariation.filter((ligne) => ligne.variation > 0);
        const baisses = avecVariation.filter((ligne) => ligne.variation < 0);
        const plusForte = avecVariation.reduce<{ actif: Actif; variation: number } | null>(
            (meilleure, ligne) => (!meilleure || Math.abs(ligne.variation) > Math.abs(meilleure.variation) ? ligne : meilleure),
            null
        );
        const part = (nombre: number) => (avecVariation.length ? `${Math.round((nombre / actifs.length) * 100)} % du panier` : 'Variation indisponible');

        return [
            {
                titre: 'Actifs suivis',
                valeur: String(actifs.length),
                detail: `Actions ${compter('action')} · Indices ${compter('indice')} · Cryptos ${compter('crypto')}`,
                icone: 'pi-list',
                couleur: '#2962ff',
                fond: 'rgba(41, 98, 255, 0.1)'
            },
            {
                titre: 'En hausse (24 h)',
                valeur: avecVariation.length ? String(hausses.length) : '—',
                detail: part(hausses.length),
                icone: 'pi-arrow-up-right',
                couleur: '#089981',
                fond: 'rgba(8, 153, 129, 0.1)'
            },
            {
                titre: 'En baisse (24 h)',
                valeur: avecVariation.length ? String(baisses.length) : '—',
                detail: part(baisses.length),
                icone: 'pi-arrow-down-right',
                couleur: '#f23645',
                fond: 'rgba(242, 54, 69, 0.1)'
            },
            {
                titre: 'Plus forte variation',
                valeur: plusForte ? `${plusForte.variation > 0 ? '+' : ''}${plusForte.variation.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} %` : '—',
                detail: plusForte ? plusForte.actif.nom : 'Variation indisponible',
                icone: 'pi-bolt',
                couleur: '#f7a600',
                fond: 'rgba(247, 166, 0, 0.12)'
            }
        ];
    }

    private nombre(valeur: unknown): number | null {
        if (valeur === null || valeur === undefined || valeur === '') return null;
        const n = Number(valeur);
        return Number.isFinite(n) ? n : null;
    }
}
