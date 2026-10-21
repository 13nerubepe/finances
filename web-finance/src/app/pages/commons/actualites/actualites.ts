
import { Component, inject, OnInit } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { ActifService } from '@/app/pages/service/service/actif-service';
import { Actualite } from '@/app/models/model';
import { Tag } from 'primeng/tag';
import { Button, ButtonDirective } from 'primeng/button';
import { Divider } from 'primeng/divider';
import { InputIcon } from 'primeng/inputicon';
import { IconField } from 'primeng/iconfield';
import { InputText } from 'primeng/inputtext';
import { Skeleton } from 'primeng/skeleton';

@Component({
    selector: 'app-actualites',
    standalone: true,
    imports: [CommonModule, FormsModule, ButtonDirective, InputText, Skeleton],
    templateUrl: './actualites.html',
    styleUrl: './actualites.scss'
})
export class ActualitesComponent implements OnInit {
    private readonly actifService = inject(ActifService);

    loading = false;
    errorMessage = '';

    recherche = '';
    categorieSelectionnee = 'Toutes';

    categories: string[] = ['Toutes', 'Économie', 'Bourse', 'Finance', 'Banque', 'Entreprises'];

    actualites: Actualite[] = [];
    actualitesFiltrees: Actualite[] = [];

    ngOnInit(): void {
        this.loadActualites();
    }

    loadActualites(): void {
        this.loading = true;
        this.errorMessage = '';

        this.actifService.getActualites().subscribe({
            next: (response: Actualite[]) => {
                this.actualites = response ?? [];
                this.appliquerFiltres();
                this.loading = false;
            },
            error: (error: unknown) => {
                console.error('Erreur lors du chargement des actualités', error);

                this.errorMessage = 'Une erreur est survenue lors du chargement. Veuillez réessayer.';

                this.loading = false;
            }
        });
    }

    rechercherActualites(): void {
        this.appliquerFiltres();
    }

    changerCategorie(categorie: string): void {
        this.categorieSelectionnee = categorie;
        this.appliquerFiltres();
    }

    reinitialiserFiltres(): void {
        this.recherche = '';
        this.categorieSelectionnee = 'Toutes';
        this.appliquerFiltres();
    }

    private appliquerFiltres(): void {
        const terme = this.normaliser(this.recherche.trim());

        this.actualitesFiltrees = this.actualites.filter((actualite) => {
            const correspondCategorie = this.categorieSelectionnee === 'Toutes' || this.normaliser(actualite.categorie) === this.normaliser(this.categorieSelectionnee);

            const contenu = this.normaliser([actualite.titre, actualite.resume ?? '', actualite.categorie, actualite.source ?? ''].join(' '));

            const correspondRecherche = !terme || contenu.includes(terme);

            return correspondCategorie && correspondRecherche;
        });
    }

    get actualitePrincipale(): Actualite | null {
        return this.actualitesFiltrees[0] ?? null;
    }

    get actualitesSecondaires(): Actualite[] {
        return this.actualitesFiltrees.slice(1);
    }

    tempsEcoule(date: string | Date): string {
        const h = Math.floor((Date.now() - new Date(date).getTime()) / 3600000);
        if (h < 1) return "Il y a moins d'1 h";
        if (h < 24) return `Il y a ${h} h`;
        return `Il y a ${Math.floor(h / 24)} j`;
    }

    couleurCategorie(cat: string): string {
        const map: Record<string, string> = {
            'Marchés':  'bg-blue-100 text-blue-600',
            'Actions':  'bg-green-100 text-green-600',
            'Crypto':   'bg-orange-100 text-orange-600',
            'Économie': 'bg-red-100 text-red-600',
            'Géopolitique': 'bg-purple-100 text-purple-600'
        };
        return map[cat] ?? 'bg-surface-100 text-muted-color';
    }



    trackByActualite(index: number, actualite: Actualite): number | string {
        return actualite.id ?? index;
    }

    private normaliser(valeur: string): string {
        return valeur
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase();
    }
}

