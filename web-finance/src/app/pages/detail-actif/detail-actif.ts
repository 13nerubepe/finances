
import { Component, inject, OnInit } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';

import { Button } from 'primeng/button';
import { Tag } from 'primeng/tag';
import { Tooltip } from 'primeng/tooltip';
import { Divider } from 'primeng/divider';

import { Actif } from '@/app/models/actif-model';
import { ActifService } from '@/app/pages/service/service/actif-service';

@Component({
    selector: 'app-detail-actif',
    standalone: true,
    imports: [CommonModule, Button, Tooltip, Divider, Tag],
    templateUrl: './detail-actif.html',
    styleUrl: './detail-actif.scss'
})
export class DetailActif implements OnInit {
    private route = inject(ActivatedRoute);
    private router = inject(Router);
    private actifService = inject(ActifService);

    actif: Actif | null = null;
    loading = true;
    errorMessage = '';

    ngOnInit(): void {
        this.chargerActif();
    }

    chargerActif(): void {
        this.loading = true;
        this.errorMessage = '';
        this.actif = null;

        const id = this.route.snapshot.paramMap.get('id');

        if (!id) {
            this.errorMessage = 'Identifiant de l’actif introuvable dans l’URL.';
            this.loading = false;
            return;
        }

        this.actifService.getAssets().subscribe({
            next: (data: Actif[]) => {
                this.actif = data.find((a) => String(a.actifId) === id) ?? null;

                if (!this.actif) {
                    this.errorMessage = `Aucun actif trouvé pour l’identifiant ${id}.`;
                }

                this.loading = false;
            },
            error: (error: unknown) => {
                console.error('Erreur lors du chargement de l’actif :', error);

                this.errorMessage = 'Impossible de charger les informations de cet actif.';

                this.loading = false;
            }
        });
    }

    retour(): void {
        this.router.navigate(['/actifs']);
    }

    actualiser(): void {
        this.chargerActif();
    }
}

