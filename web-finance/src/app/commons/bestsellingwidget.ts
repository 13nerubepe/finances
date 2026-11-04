import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ButtonModule } from 'primeng/button';
import { MenuModule } from 'primeng/menu';

@Component({
    standalone: true,
    selector: 'app-best-selling-widget',
    imports: [CommonModule, ButtonModule, MenuModule],
    template: `
    <div class="card">
        <!-- En-tête -->
        <div class="mb-6 flex items-center justify-between">
            <div>
                <div class="text-xl font-semibold text-surface-900 dark:text-surface-0">
                    Analyse de la volatilité du portefeuille d’anneaux
                </div>
                <div class="mt-1 text-sm text-muted-color">
                    Suivi des variations et de la stabilité du portefeuille
                </div>
            </div>

            <div>
                <button
                    pButton
                    type="button"
                    icon="pi pi-ellipsis-v"
                    class="p-button-rounded p-button-text p-button-plain"
                    aria-label="Plus d'options">
                </button>
            </div>
        </div>

        <ul class="m-0 list-none p-0">
            <!-- Nombre total d'anneaux -->
            <li class="mb-6 flex flex-col md:flex-row md:items-center md:justify-between">
                <div>
                <span class="font-medium text-surface-900 dark:text-surface-0">
                    Nombre total d’anneaux
                </span>
                    <div class="mt-1 text-sm text-muted-color">
                        Taille actuelle du portefeuille
                    </div>
                </div>

                <div class="mt-2 flex items-center md:mt-0">
                    <div class="h-2 w-40 overflow-hidden rounded-border bg-surface-300 dark:bg-surface-500 lg:w-24">
                        <div class="h-full bg-orange-500" style="width: 75%"></div>
                    </div>
                    <span class="ml-4 font-medium text-orange-500">75</span>
                </div>
            </li>

            <!-- Anneaux ajoutés -->
            <li class="mb-6 flex flex-col md:flex-row md:items-center md:justify-between">
                <div>
                <span class="font-medium text-surface-900 dark:text-surface-0">
                    Anneaux ajoutés
                </span>
                    <div class="mt-1 text-sm text-muted-color">
                        Sur la période sélectionnée
                    </div>
                </div>

                <div class="mt-2 flex items-center md:mt-0">
                    <div class="h-2 w-40 overflow-hidden rounded-border bg-surface-300 dark:bg-surface-500 lg:w-24">
                        <div class="h-full bg-green-500" style="width: 60%"></div>
                    </div>
                    <span class="ml-4 font-medium text-green-500">+12</span>
                </div>
            </li>

            <!-- Anneaux retirés -->
            <li class="mb-6 flex flex-col md:flex-row md:items-center md:justify-between">
                <div>
                <span class="font-medium text-surface-900 dark:text-surface-0">
                    Anneaux retirés
                </span>
                    <div class="mt-1 text-sm text-muted-color">
                        Sur la période sélectionnée
                    </div>
                </div>

                <div class="mt-2 flex items-center md:mt-0">
                    <div class="h-2 w-40 overflow-hidden rounded-border bg-surface-300 dark:bg-surface-500 lg:w-24">
                        <div class="h-full bg-red-500" style="width: 30%"></div>
                    </div>
                    <span class="ml-4 font-medium text-red-500">-4</span>
                </div>
            </li>

            <!-- Taux de variation -->
            <li class="mb-6 flex flex-col md:flex-row md:items-center md:justify-between">
                <div>
                <span class="font-medium text-surface-900 dark:text-surface-0">
                    Taux de variation
                </span>
                    <div class="mt-1 text-sm text-muted-color">
                        Évolution du nombre d’anneaux
                    </div>
                </div>

                <div class="mt-2 flex items-center md:mt-0">
                    <div class="h-2 w-40 overflow-hidden rounded-border bg-surface-300 dark:bg-surface-500 lg:w-24">
                        <div class="h-full bg-cyan-500" style="width: 40%"></div>
                    </div>
                    <span class="ml-4 font-medium text-cyan-500">+10,7 %</span>
                </div>
            </li>

            <!-- Stabilité du portefeuille -->
            <li class="flex flex-col md:flex-row md:items-center md:justify-between">
                <div>
                <span class="font-medium text-surface-900 dark:text-surface-0">
                    Stabilité du portefeuille
                </span>
                    <div class="mt-1 text-sm text-muted-color">
                        Indicateur de variation sur la période
                    </div>
                </div>

                <div class="mt-2 flex items-center md:mt-0">
                    <div class="h-2 w-40 overflow-hidden rounded-border bg-surface-300 dark:bg-surface-500 lg:w-24">
                        <div class="h-full bg-purple-500" style="width: 80%"></div>
                    </div>
                    <span class="ml-4 font-medium text-purple-500">80 %</span>
                </div>
            </li>
        </ul>

        <div class="mt-6 border-t border-surface-200 pt-4 dark:border-surface-700">
            <p class="text-xs text-muted-color">
                Les valeurs affichées sont fictives et doivent être remplacées par
                les données réelles du portefeuille.
            </p>
        </div>
    </div>
    `
})
export class BestSellingWidget {
    menu = null;

    items = [
        { label: 'Add New', icon: 'pi pi-fw pi-plus' },
        { label: 'Remove', icon: 'pi pi-fw pi-trash' }
    ];
}
