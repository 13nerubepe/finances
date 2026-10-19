
import { Component, inject, OnInit } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { ActifService } from '@/app/layout/service/actif-service';
import { Actualite } from '@/app/models/model';

@Component({
    selector: 'app-actualites',
    standalone: true,
    imports: [
        CommonModule,
        FormsModule
    ],
    templateUrl: './actualites.html',
    styleUrl: './actualites.scss'
})
export class ActualitesComponent implements OnInit {

    private readonly actifService = inject(ActifService);

    actualites: Actualite[] = [];
    actualitePrincipale: Actualite | null = null;

    categories: string[] = [
        'Toutes',
        'Marchés',
        'Économie',
        'Entreprises',
        'Technologie',
        'Matières premières'
    ];

    categorieSelectionnee = 'Toutes';
    recherche = '';

    loading = false;
    errorMessage = '';

    ngOnInit(): void {
        this.loadActualites();
    }

    loadActualites(): void {
        this.loading = true;
        this.errorMessage = '';

        this.actifService
            .getActualites(
                this.categorieSelectionnee,
                this.recherche
            )
            .subscribe({
                next: (data: Actualite[]) => {
                    this.actualites = [...data].sort(
                        (a, b) =>
                            new Date(b.datePublication).getTime() -
                            new Date(a.datePublication).getTime()
                    );

                    this.actualitePrincipale =
                        this.actualites[0] ?? null;

                    this.loading = false;
                },

                error: (error: unknown) => {
                    console.error(
                        'Erreur de chargement des actualités',
                        error
                    );

                    this.errorMessage =
                        'Impossible de charger les actualités. Réessayez plus tard.';

                    this.loading = false;
                }
            });
    }

    changerCategorie(categorie: string): void {
        this.categorieSelectionnee = categorie;
        this.loadActualites();
    }

    rechercherActualites(): void {
        this.loadActualites();
    }

    trackById(index: number, actualite: Actualite): number {
        return actualite.id;
    }
}

