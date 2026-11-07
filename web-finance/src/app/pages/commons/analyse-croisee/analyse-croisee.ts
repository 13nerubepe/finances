import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, effect, inject, input, model, signal } from '@angular/core';
import { Subscription } from 'rxjs';

import { Button } from 'primeng/button';
import { Dialog } from 'primeng/dialog';
import { Tag } from 'primeng/tag';

import { AssistantPont } from '@/app/pages/commons/assistant-ai/assistant-pont';
import { AnalyseCroisee, analyseEnTexte, AnalyseCroiseeService, Niveau, NiveauRisque } from '@/app/pages/service/service/analyse-croisee.service';

/** Fenêtre d'analyse croisée d'un actif pour un jour : volatilité, pics, marché, corrélations, actualités, listes. */
@Component({
    selector: 'app-analyse-croisee',
    standalone: true,
    imports: [CommonModule, Button, Dialog, Tag],
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
        <p-dialog
            [header]="'Analyse croisée de ' + symbole() + ' — ' + jourFr(jour())"
            [visible]="visible()"
            (visibleChange)="visible.set($event)"
            [modal]="true"
            [draggable]="false"
            [dismissableMask]="true"
            [style]="{ width: '44rem' }"
            [breakpoints]="{ '720px': '95vw' }">
            <div aria-live="polite">
                @if (enCours()) {
                    <p class="m-0"><i class="pi pi-spin pi-spinner mr-2"></i>Lecture de la volatilité, des pics, des corrélations, des actualités et de vos listes…</p>
                } @else if (erreur()) {
                    <p class="m-0 mb-3 text-red-500" role="alert">{{ erreur() }}</p>
                    <p-button label="Réessayer" icon="pi pi-refresh" severity="secondary" [outlined]="true" size="small" (onClick)="charger()" />
                } @else if (analyse(); as a) {
                    <div class="mb-4 flex flex-wrap items-center gap-2">
                        <p-tag [value]="'Risque ' + a.niveauRisque" [severity]="severiteRisque(a.niveauRisque)" />
                        @if (a.chiffres.variationJour !== null) {
                            <p-tag [value]="'Jour ' + signe(a.chiffres.variationJour) + format(a.chiffres.variationJour) + ' %'" [severity]="a.chiffres.variationJour >= 0 ? 'success' : 'danger'" />
                        }
                        @if (a.chiffres.zJour !== null) {
                            <p-tag [value]="'Score Z ' + format(a.chiffres.zJour, 1)" severity="secondary" />
                        }
                        @if (a.chiffres.rapportVolatilite !== null) {
                            <p-tag [value]="'Volatilité ×' + format(a.chiffres.rapportVolatilite, 1)" severity="secondary" />
                        }
                    </div>

                    <p class="m-0 mb-4 leading-relaxed">{{ a.resume }}</p>

                    <ul class="m-0 mb-4 flex list-none flex-col gap-3 p-0">
                        @for (c of a.constats; track c.theme) {
                            <li class="flex gap-3">
                                <i class="pi mt-1" [ngClass]="icone(c.niveau)" aria-hidden="true"></i>
                                <div>
                                    <strong class="text-sm">{{ c.titre }}</strong>
                                    <p class="m-0 text-sm leading-relaxed text-muted-color">{{ c.texte }}</p>
                                </div>
                            </li>
                        }
                    </ul>

                    <h3 class="!m-0 !mb-2 !text-sm !font-semibold">Conseils</h3>
                    <ul class="m-0 mb-4 list-disc pl-5 text-sm leading-relaxed">
                        @for (c of a.conseils; track $index) {
                            <li>{{ c }}</li>
                        }
                    </ul>

                    @if (a.articles.length) {
                        <h3 class="!m-0 !mb-2 !text-sm !font-semibold">Articles</h3>
                        <ul class="m-0 mb-4 list-disc pl-5 text-sm break-words">
                            @for (x of a.articles; track x.lien) {
                                <li>
                                    <a [href]="x.lien" target="_blank" rel="noopener noreferrer">{{ x.titre }}</a>
                                    <span class="text-muted-color"> · {{ x.source }}@if (x.date) { · {{ x.date | date: 'dd/MM/yyyy' }}}</span>
                                </li>
                            }
                        </ul>
                    }

                    @if (a.explicationIA; as e) {
                        <h3 class="!m-0 !mb-2 !text-sm !font-semibold">Explication de l'IA ({{ e.modele }})</h3>
                        <p class="m-0 mb-4 whitespace-pre-line text-sm leading-relaxed">{{ e.texte }}</p>
                    }

                    @if (a.manquants.length) {
                        <p class="m-0 mb-3 text-xs text-muted-color">Données indisponibles : {{ a.manquants.join(', ') }}.</p>
                    }
                    <p class="m-0 mb-4 text-xs text-muted-color">{{ a.avertissement }}</p>

                    <div class="flex flex-wrap gap-2 border-t border-surface pt-4">
                        @if (!a.explicationIA) {
                            <p-button label="Ajouter l'explication de l'IA" icon="pi pi-bolt" severity="secondary" [outlined]="true" size="small" (onClick)="charger(true)" />
                        }
                        <p-button label="Approfondir avec l'assistant" icon="pi pi-comments" size="small" (onClick)="approfondir(a)" />
                    </div>
                }
            </div>
        </p-dialog>
    `
})
export class AnalyseCroiseeComponent {
    private readonly service = inject(AnalyseCroiseeService);
    private readonly assistant = inject(AssistantPont);

    readonly symbole = input.required<string>();
    /** Jour analysé, AAAA-MM-JJ (UTC). */
    readonly jour = input.required<string>();
    readonly visible = model(false);

    readonly analyse = signal<AnalyseCroisee | null>(null);
    readonly enCours = signal(false);
    readonly erreur = signal('');
    private requete?: Subscription;

    constructor() {
        // Une nouvelle analyse à chaque ouverture, ou quand l'actif ou le jour changent fenêtre ouverte.
        effect(() => {
            if (this.visible()) this.charger(false, this.symbole(), this.jour());
        });
    }

    charger(avecExplicationIA = false, symbole = this.symbole(), jour = this.jour()): void {
        this.requete?.unsubscribe();
        this.enCours.set(true);
        this.erreur.set('');
        if (!avecExplicationIA) this.analyse.set(null);
        this.requete = this.service.analyser(symbole, jour, { avecExplicationIA }).subscribe({
            next: (a) => {
                this.analyse.set(a);
                this.enCours.set(false);
            },
            error: () => {
                this.erreur.set("Impossible de lire les données de l'actif. Vérifiez que le serveur est lancé.");
                this.enCours.set(false);
            }
        });
    }

    approfondir(a: AnalyseCroisee): void {
        this.visible.set(false);
        this.assistant.demander({
            affichage: `Approfondir l'analyse de ${a.symbole} du ${new Date(`${a.jour}T00:00:00Z`).toLocaleDateString('fr-FR', { timeZone: 'UTC' })}`,
            question: `${analyseEnTexte(a)}\n\nÀ partir de cette analyse calculée par l'application, explique la situation de ${a.nom} (${a.symbole}) en croisant ces éléments, vérifie avec tes outils (indicateurs_du_jour, lister_pics, cours_autour_d_une_heure) et termine par les points à surveiller.`,
            symboles: [a.symbole]
        });
    }

    /** AAAA-MM-JJ -> JJ/MM/AAAA, sans conversion de fuseau horaire. */
    jourFr(jour: string): string {
        return jour ? jour.split('-').reverse().join('/') : '';
    }

    severiteRisque(n: NiveauRisque): 'success' | 'warn' | 'danger' {
        return n === 'élevé' ? 'danger' : n === 'modéré' ? 'warn' : 'success';
    }

    icone(n: Niveau): string {
        return n === 'alerte' ? 'pi-exclamation-triangle text-red-500' : n === 'attention' ? 'pi-exclamation-circle text-orange-500' : 'pi-info-circle text-blue-500';
    }

    format(n: number, decimales = 2): string {
        return n.toLocaleString('fr-FR', { minimumFractionDigits: decimales, maximumFractionDigits: decimales });
    }

    signe(n: number): string {
        return n > 0 ? '+' : '';
    }
}
