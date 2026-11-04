import { ChangeDetectorRef, Component, inject, OnInit } from '@angular/core';

import type { Actif } from '@/app/models/actif-model';
import { ActifService } from '@/app/pages/service/service/actif-service';

interface CategorieActif {
    type: Actif['type_actif'];
    label: string;
    couleur: string;
    nombre: number;
}

@Component({
    selector: 'app-portofolio-distribution',
    standalone: true,
    templateUrl: './portofolio-distribution.html'
})
export class PortofolioDistribution implements OnInit {
    private readonly actifService = inject(ActifService);
    private readonly cdr = inject(ChangeDetectorRef);

    loading = false;
    errorMessage = '';
    total = 0;
    categories: CategorieActif[] = [];

    /** Tour complet de l'anneau, dont le rayon vaut 52 dans le SVG. */
    readonly circonference = 2 * Math.PI * 52;

    ngOnInit(): void {
        this.loadPortfolioDistribution();
    }

    loadPortfolioDistribution(): void {
        this.loading = true;
        this.errorMessage = '';

        this.actifService.getAssets().subscribe({
            next: (actifs: Actif[]) => {
                const suivis = actifs.filter((actif) => actif.est_suivi !== false);
                const compter = (type: Actif['type_actif']) => suivis.filter((actif) => actif.type_actif === type).length;

                this.total = suivis.length;
                this.categories = [
                    { type: 'action', label: 'Actions', couleur: '#2962ff', nombre: compter('action') },
                    { type: 'indice', label: 'Indices', couleur: '#089981', nombre: compter('indice') },
                    { type: 'crypto', label: 'Cryptomonnaies', couleur: '#f7a600', nombre: compter('crypto') }
                ];
                this.loading = false;
                this.cdr.markForCheck();
            },
            error: (erreur) => {
                console.error('Erreur lors du chargement de la répartition :', erreur);
                this.errorMessage = 'Impossible de charger la répartition.';
                this.loading = false;
                this.cdr.markForCheck();
            }
        });
    }

    /** Portions de l'anneau, en longueur réelle sur le cercle. */
    get segments(): (CategorieActif & { debut: number; longueur: number })[] {
        // Un petit espace sépare les portions, sauf s'il n'y en a qu'une.
        const visibles = this.categories.filter((categorie) => categorie.nombre > 0);
        const espace = visibles.length > 1 ? 4 : 0;
        let debut = 0;

        return visibles.map((categorie) => {
            const portion = (categorie.nombre / this.total) * this.circonference;
            const segment = { ...categorie, debut, longueur: portion - espace };
            debut += portion;
            return segment;
        });
    }

    pourcentage(nombre: number): number {
        return this.total ? Math.round((nombre / this.total) * 100) : 0;
    }
}
