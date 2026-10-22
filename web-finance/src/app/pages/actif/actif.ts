
import { CommonModule, CurrencyPipe, DecimalPipe } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

import { ConfirmationService, MessageService } from 'primeng/api';
import { Avatar } from 'primeng/avatar';
import { Button } from 'primeng/button';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { IconField } from 'primeng/iconfield';
import { InputIcon } from 'primeng/inputicon';
import { InputText } from 'primeng/inputtext';
import { Select } from 'primeng/select';
import { TableModule } from 'primeng/table';
import type { Table } from 'primeng/table';
import { Toast } from 'primeng/toast';
import { Tooltip } from 'primeng/tooltip';

import { Actif } from '@/app/models/model';
import { TranslatePipe } from '@ngx-translate/core';
import { Paginator } from 'primeng/paginator';
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

    constructor(
        private router: Router,
        private assetService: ActifService) {}

    ngOnInit(): void {
        this.chargerActifs();
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
