import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { OverlayBadge } from 'primeng/overlaybadge';
import { Popover } from 'primeng/popover';

import { AppConstantRoute } from '@/app/constants';
import { ActifService } from '@/app/pages/service/service/actif-service';

interface Notification {
    cle: string;
    symbole: string;
    nom: string;
    horodatage: string;
    variation: number | null;
}

const CLE_DERNIERE_VUE = 'notifications-pics-derniere-vue';
const MAX_NOTIFICATIONS = 15;
const JOURS_AFFICHES = 7;
const UN_JOUR_MS = 86400000;

@Component({
    selector: 'app-notifications',
    standalone: true,
    imports: [RouterLink, OverlayBadge, Popover],
    template: `
        <button
            type="button"
            class="layout-topbar-action"
            title="Notifications"
            [attr.aria-label]="nonLues() ? nonLues() + ' nouvelles notifications' : 'Notifications'"
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

                @if (chargement()) {
                    <p class="m-0 py-6 text-center text-sm text-muted-color">
                        <i class="pi pi-spin pi-spinner mr-2"></i>Chargement…
                    </p>
                } @else if (erreur()) {
                    <p class="m-0 py-6 text-center text-sm text-muted-color" role="alert">
                        Impossible de charger les notifications.
                    </p>
                } @else {
                    <div class="flex max-h-80 flex-col gap-1 overflow-y-auto">
                        @for (n of notifications(); track n.cle) {
                            <a
                                class="flex items-center gap-3 rounded-lg p-2 text-color no-underline hover:bg-emphasis"
                                [routerLink]="['/', cheminDetail, n.symbole]"
                                (click)="panneau.hide()">
                                <span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emphasis">
                                    <i
                                        class="pi text-sm"
                                        [class.pi-arrow-up-right]="(n.variation ?? 0) > 0"
                                        [class.pi-arrow-down-right]="(n.variation ?? 0) < 0"
                                        [class.pi-bell]="!n.variation"
                                        [class.text-green-500]="(n.variation ?? 0) > 0"
                                        [class.text-red-500]="(n.variation ?? 0) < 0"></i>
                                </span>

                                <span class="flex min-w-0 flex-1 flex-col">
                                    <span class="truncate text-sm">
                                        <strong>{{ n.symbole }}</strong> {{ message(n.variation) }}
                                    </span>
                                    <small class="truncate text-muted-color">{{ tempsEcoule(n.horodatage) }}</small>
                                </span>

                                @if (estNonLue(n)) {
                                    <span class="h-2 w-2 shrink-0 rounded-full bg-primary" aria-label="Non lue"></span>
                                }
                            </a>
                        } @empty {
                            <div class="flex flex-col items-center gap-2 py-6 text-muted-color">
                                <i class="pi pi-bell text-xl"></i>
                                <p class="m-0 text-sm">Aucune notification</p>
                            </div>
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
    readonly notifications = signal<Notification[]>([]);
    readonly chargement = signal(true);
    readonly erreur = signal(false);

    private readonly derniereVue = signal(this.lireDerniereVue());

    readonly nonLues = computed(() => this.notifications().filter((n) => this.estNonLue(n)).length);

    ngOnInit(): void {
        this.charger();
    }

    ouvrir(evenement: Event, panneau: Popover): void {
        panneau.toggle(evenement);
        this.charger();
    }

    estNonLue(notification: Notification): boolean {
        return new Date(notification.horodatage).getTime() > this.derniereVue();
    }

    message(variation: number | null): string {
        if (!variation) return ': mouvement inhabituel';

        const pourcent = Math.abs(variation);
        const texte = pourcent.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        return `${variation > 0 ? 'en hausse' : 'en baisse'} de ${texte} %`;
    }

    tempsEcoule(horodatage: string): string {
        const jours = Math.max(0, Math.floor((Date.now() - new Date(horodatage).getTime()) / UN_JOUR_MS));
        if (jours === 0) return "Aujourd'hui";
        if (jours === 1) return 'Hier';
        return `Il y a ${jours} jours`;
    }

    /** Une seule requête : les pics journaliers enregistrés (|z| au-dessus du seuil) des derniers jours, tous actifs confondus. */
    private charger(): void {
        const debut = new Date(Date.now() - JOURS_AFFICHES * UN_JOUR_MS).toISOString().slice(0, 10);

        this.erreur.set(false);
        this.actifService.getPicsJournaliers({ debut }).subscribe({
            next: (pics) => {
                this.notifications.set(
                    pics
                        .map(
                            (pic): Notification => ({
                                cle: `${pic.symbole}|${pic.date}`,
                                symbole: pic.symbole,
                                nom: pic.nom,
                                horodatage: pic.date,
                                variation: this.nombre(pic.variation)
                            })
                        )
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
