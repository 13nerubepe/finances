// import { Component, inject, OnInit, signal } from '@angular/core';
// import { IconField } from 'primeng/iconfield';
// import { InputIcon } from 'primeng/inputicon';
// import { Table, TableModule } from 'primeng/table';
// import { FormsModule } from '@angular/forms';
// import { Select } from 'primeng/select';
// import { MultiSelect } from 'primeng/multiselect';
// import { Slider } from 'primeng/slider';
// import { CurrencyPipe, DatePipe, DecimalPipe } from '@angular/common';
// import { Tag } from 'primeng/tag';
// import { InputText } from 'primeng/inputtext';
// import { Button, ButtonDirective } from 'primeng/button';
// import { Actif } from '@/app/models/model';
// import { ConfirmationService, MessageService } from 'primeng/api';
// import { Router } from '@angular/router';
// import { ActifService } from '@/app/pages/service/service/actif-service';
// import { apiErrorMessage } from '@/app/models/api-errors';
// import { Toast, ToastModule } from 'primeng/toast';
// import { Avatar } from 'primeng/avatar';
// import { ConfirmDialogModule } from 'primeng/confirmdialog';
// import { AuthService } from '@/app/pages/service/service/auth.service';

import { Component, inject, OnInit, signal } from '@angular/core';
import { CurrencyPipe, DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ConfirmationService, MessageService } from 'primeng/api';
import { Avatar } from 'primeng/avatar';
import { Button, ButtonDirective } from 'primeng/button';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { IconField } from 'primeng/iconfield';
import { InputIcon } from 'primeng/inputicon';
import { InputText } from 'primeng/inputtext';
import { Select } from 'primeng/select';
import { Table, TableModule } from 'primeng/table';
import { Toast } from 'primeng/toast';
import { Tooltip } from 'primeng/tooltip';
import { Actif } from '@/app/models/model';
import { ActifService } from '@/app/pages/service/service/actif-service';
import { apiErrorMessage } from '@/app/models/api-errors';
import { MultiSelect } from 'primeng/multiselect';
import { Slider } from 'primeng/slider';
import { Tag } from 'primeng/tag';


@Component({
    selector: 'app-actif',
    standalone: true,
    imports: [ ConfirmDialogModule,TableModule, IconField, InputIcon, FormsModule, MultiSelect, Select, Slider, Tag, DatePipe, CurrencyPipe, InputText, ButtonDirective, Button, Toast, Avatar, DecimalPipe],
    templateUrl: './actif.html',
    styleUrl: './actif.scss'
})

export class ActifComponent implements OnInit {
    private readonly actifService = inject(ActifService);
    private readonly router = inject(Router);
    private readonly confirmationService = inject(ConfirmationService);
    private readonly messageService = inject(MessageService);

    readonly actifs = signal<Actif[]>([]);
    readonly loading = signal(false);
    readonly loadError = signal('');
    readonly searchValue = signal('');

    // Adaptez les valeurs à celles réellement utilisées dans vos données
    statuses = [
        { label: 'Actif', value: 'ACTIVE' },
        { label: 'Inactif', value: 'INACTIVE' },
    ];

    trends = [
        { label: 'En hausse', value: 'up', icon: 'pi pi-arrow-up-right text-green-500' },
        { label: 'En baisse', value: 'down', icon: 'pi pi-arrow-down-right text-red-500' },
    ];

    selectedStatus: string | null = null;
    selectedTrend: 'up' | 'down' | null = null;

    ngOnInit(): void {
        this.loadActifs();
    }

    loadActifs(): void {
        console.log('loadActifs appelée'); // à retirer une fois le problème résolu
        this.loading.set(true);
        this.loadError.set('');

        this.actifService.getAssets().subscribe({
            next: (actifs) => {
                console.log('actifs reçus :', actifs); // à retirer
                this.actifs.set(
                    actifs.map((a) => ({
                        ...a,
                        trend: a.variation >= 0 ? ('up' as const) : ('down' as const),
                    })),
                );
                this.loading.set(false);
            },
            error: (error) => {
                console.error(error);
                this.loading.set(false);
                this.loadError.set(apiErrorMessage(error));
            },
        });
    }

    onSearch(table: Table, value: string): void {
        this.searchValue.set(value);
        table.filterGlobal(value, 'contains');
    }

    clearFilters(table: Table): void {
        this.selectedStatus = null;
        this.selectedTrend = null;
        this.searchValue.set('');
        table.clear();
    }

    addActif(): void {
        this.router.navigate(['/actifs/new']);
    }

    editActif(actif: Actif): void {
        this.router.navigate(['/actifs', actif.actifId, 'edit']);
    }

    deleteActif(actif: Actif): void {
        this.confirmationService.confirm({
            header: "Supprimer l'actif",
            message: `Voulez-vous vraiment supprimer « ${actif.name} » ? Cette action est irréversible.`,
            icon: 'pi pi-exclamation-triangle',
            acceptLabel: 'Supprimer',
            rejectLabel: 'Annuler',
            acceptButtonProps: { severity: 'danger' },
            rejectButtonProps: { severity: 'secondary', outlined: true },
            accept: () => {
                this.actifService.deleteActif(actif.actifId).subscribe({
                    next: () => {
                        this.actifs.update((list) => list.filter((a) => a.actifId !== actif.actifId));
                        this.messageService.add({
                            severity: 'success',
                            summary: 'Supprimé',
                            detail: `${actif.name} a été supprimé.`,
                        });
                    },
                    error: (error) =>
                        this.messageService.add({
                            severity: 'error',
                            summary: 'Erreur',
                            detail: apiErrorMessage(error),
                        }),
                });
            },
        });
    }
}
