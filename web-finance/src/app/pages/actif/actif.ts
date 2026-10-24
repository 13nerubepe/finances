
import { CommonModule, CurrencyPipe, DecimalPipe } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';


import { Button } from 'primeng/button';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { IconField } from 'primeng/iconfield';
import { InputIcon } from 'primeng/inputicon';
import { InputText } from 'primeng/inputtext';
import { TableModule } from 'primeng/table';

import { Tooltip } from 'primeng/tooltip';

import { Actif } from '@/app/models/actif-model';

import { ActifService } from '@/app/pages/service/service/actif-service';
import { Tag } from 'primeng/tag';

type Trend = 'up' | 'down';

type ActifAvecTendance = Actif & {
    trend: Trend;
};

@Component({
    selector: 'app-actif',
    standalone: true,
    imports: [CommonModule, FormsModule, TableModule, IconField, InputIcon, InputText, Button, Tooltip, ConfirmDialogModule, Tag],
    templateUrl: './actif.html',
    styleUrl: './actif.scss'
})
export class ActifComponent implements OnInit {
    actifs: Actif[] = [];
    loading = false;

    vue: 'tous' | 'mes' = 'tous';
    actifsSelectionnes: Actif[] = [];

    constructor(
        private router: Router,
        private assetService: ActifService) {}

    ngOnInit(): void {
        this.chargerActifs();
    }

    largeurPerformance(actif: Actif): number {
        const variation = actif.variation ?? 0;

        return Math.min(Math.abs(variation), 50);
    }

    get actifsAffiches(): Actif[] {
        return this.vue === 'tous' ? this.actifs : this.actifsSelectionnes;
    }

    estSelectionne(actif: Actif): boolean {
        return this.actifsSelectionnes.some(a => a.actifId === actif.actifId);
    }

    basculerSelection(actif: Actif): void {
        if (this.estSelectionne(actif)) {
            this.actifsSelectionnes = this.actifsSelectionnes.filter(
                a => a.actifId !== actif.actifId
            );
            // this.actifService.retirerActif(actif.actifId).subscribe();
        } else {
            this.actifsSelectionnes = [...this.actifsSelectionnes, actif];
            // this.actifService.ajouterActif(actif.actifId).subscribe();
        }
    }


    chargerActifs(): void {
        this.loading = true;

        this.assetService.getAssets().subscribe({
            next: (data: Actif[]) => {
                this.actifs = data;
                this.loading = false;
            },
            error: (error) => {
                console.error('Erreur lors du chargement des actifs :', error);
                this.loading = false;
            }
        });
    }

    voirActif(actif: Actif): void {
        console.log('Actif sélectionné :', actif);
        console.log('ID de l’actif :', actif.actifId);

        this.router.navigate(['/detail-actif', actif.actifId]);
    }
}
