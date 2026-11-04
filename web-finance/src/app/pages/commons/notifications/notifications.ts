import { DatePipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { OverlayBadge } from 'primeng/overlaybadge';
import { Popover } from 'primeng/popover';
import { catchError, forkJoin, map, of, switchMap } from 'rxjs';

import { AppConstantRoute } from '@/app/constants';
import type { Actif } from '@/app/models/actif-model';
import { ActifService } from '@/app/pages/service/service/actif-service';

interface Notification {
    cle: string;
    symbole: string;
    nom: string;
    horodatage: string;
    variation: number | null;
}

const CLE_DERNIERE_VUE = 'notifications-pics-derniere-vue';
/** L'API n'a pas de route dédiée : un appel par actif, donc un nombre limité d'actifs. */
const MAX_ACTIFS = 10;
const MAX_NOTIFICATIONS = 15;
const JOURS_AFFICHES = 7;
/** Assez de jours pour que l'écart-type sur 20 bougies soit calculable. */
const JOURS_ANALYSE = 60;
/** true si l'API renvoie 0.025 pour 2,5 %, comme dans analyse-actif. */
const RATIOS_EN_FRACTION = true;

@Component({
    selector: 'app-notifications',
    standalone: true,
    imports: [DatePipe, RouterLink, OverlayBadge, Popover],
    template: `
        <button
            type="button"
            class="layout-topbar-action"
            title="Mouvements inhabituels"
            [attr.aria-label]="nonLues() ? nonLues() + ' nouveaux mouvements inhabituels' : 'Mouvements inhabituels'"
            (click)="ouvrir($event, panneau)">
            @if (nonLues()) {
                <p-overlaybadge [value]="nonLues() > 9 ? '9+' : '' + nonLues()" severity="danger">
                    <i class="pi pi-bell"></i>
                </p-overlaybadge>
            } @else {
                <i class="pi pi-bell"></i>
            }
        </button>

        <p-popover #panneau appendTo="body" (onHide)="marquerCommeVues()">
            <div class="w-80 max-w-[85vw]">
                <h3 class="m-0 mb-1 text-sm font-semibold">Mouvements inhabituels</h3>
                <p class="m-0 mb-3 text-xs text-muted-color">{{ jours }} derniers jours</p>

                @if (chargement()) {
                    <p class="m-0 py-3 text-sm text-muted-color"><i class="pi pi-spin pi-spinner mr-2"></i>Chargement…</p>
                } @else if (erreur()) {
                    <p class="m-0 py-3 text-sm text-red-500" role="alert">Impossible de charger les mouvements inhabituels.</p>
                } @else {
                    <div class="flex max-h-80 flex-col overflow-y-auto">
                        @for (n of notifications(); track n.cle) {
                            <a
                                class="flex items-center justify-between gap-3 rounded border-b border-surface px-1 py-2 text-color no-underline hover:bg-emphasis"
                                [routerLink]="['/', cheminDetail, n.symbole]"
                                (click)="panneau.hide()">
                                <span class="flex min-w-0 flex-col">
                                    <strong class="truncate text-sm">{{ n.symbole }}</strong>
                                    <small class="truncate text-muted-color">{{ n.nom }} · {{ n.horodatage | date: 'dd/MM/yyyy' : 'UTC' }}</small>
                                </span>
                                @if (n.variation !== null) {
                                    <span class="shrink-0 text-sm font-semibold tabular-nums" [class.text-green-500]="n.variation > 0" [class.text-red-500]="n.variation < 0">
                                        {{ formaterVariation(n.variation) }}
                                    </span>
                                }
                            </a>
                        } @empty {
                            <p class="m-0 py-3 text-sm text-muted-color">Aucun mouvement inhabituel récent.</p>
                        }
                    </div>
                }
            </div>
        </p-popover>
    `
})
export class Notifications implements OnInit {
    private readonly actifService = inject(ActifService);

    readonly cheminDetail = AppConstantRoute.Detail_Actif_PATH;
    readonly jours = JOURS_AFFICHES;
    readonly notifications = signal<Notification[]>([]);
    readonly chargement = signal(true);
    readonly erreur = signal(false);

    private readonly derniereVue = signal(this.lireDerniereVue());

    readonly nonLues = computed(() => this.notifications().filter((n) => new Date(n.horodatage).getTime() > this.derniereVue()).length);

    ngOnInit(): void {
        this.charger();
    }

    ouvrir(evenement: Event, panneau: Popover): void {
        panneau.toggle(evenement);
        this.charger();
    }

    private charger(): void {
        const maintenant = Date.now();
        const limite = maintenant - JOURS_AFFICHES * 86400000;
        const debut = new Date(maintenant - JOURS_ANALYSE * 86400000).toISOString();

        this.erreur.set(false);
        this.actifService
            .getAssets()
            .pipe(
                switchMap((actifs) => {
                    const suivis = actifs.filter((a) => (a as { est_suivi?: boolean }).est_suivi !== false).slice(0, MAX_ACTIFS);
                    if (!suivis.length) return of([] as Notification[][]);
                    // Un actif en erreur ne doit pas faire disparaître les autres.
                    return forkJoin(suivis.map((actif) => this.picsDe(actif, debut, limite)));
                })
            )
            .subscribe({
                next: (listes) => {
                    this.notifications.set(
                        listes
                            .flat()
                            .sort((a, b) => b.horodatage.localeCompare(a.horodatage))
                            .slice(0, MAX_NOTIFICATIONS)
                    );
                    this.chargement.set(false);
                },
                error: () => {
                    this.erreur.set(true);
                    this.chargement.set(false);
                }
            });
    }

    private picsDe(actif: Actif, debut: string, limite: number) {
        return this.actifService.getPics(actif.symbole, '1j', 20, 2, debut).pipe(
            map((reponse): Notification[] =>
                (reponse.pics ?? [])
                    .filter((pic) => new Date(pic.horodatage_max).getTime() >= limite)
                    .map((pic) => ({
                        cle: `${actif.symbole}|${pic.horodatage_max}`,
                        symbole: actif.symbole,
                        nom: actif.nom,
                        horodatage: pic.horodatage_max,
                        variation: this.nombre(pic.variation_prix)
                    }))
            ),
            catchError(() => of([] as Notification[]))
        );
    }

    formaterVariation(valeur: number): string {
        const pourcent = RATIOS_EN_FRACTION ? valeur * 100 : valeur;
        const texte = pourcent.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        return `${pourcent > 0 ? '+' : ''}${texte} %`;
    }

    private nombre(valeur: unknown): number | null {
        if (valeur === null || valeur === undefined || valeur === '') return null;
        const n = Number(valeur);
        return Number.isFinite(n) ? n : null;
    }

    /** À la fermeture : retirer le badge pendant le clic d'ouverture refermerait le panneau. */
    marquerCommeVues(): void {
        const maintenant = Date.now();
        this.derniereVue.set(maintenant);
        try {
            localStorage.setItem(CLE_DERNIERE_VUE, String(maintenant));
        } catch {
            // Sans stockage, le compteur reviendra simplement au prochain chargement.
        }
    }

    private lireDerniereVue(): number {
        try {
            return Number(localStorage.getItem(CLE_DERNIERE_VUE)) || 0;
        } catch {
            return 0;
        }
    }
}
