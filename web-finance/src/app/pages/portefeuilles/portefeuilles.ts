import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ConfirmationService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { DialogModule } from 'primeng/dialog';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { TextareaModule } from 'primeng/textarea';
import { catchError, EMPTY, Subject, switchMap, tap } from 'rxjs';

import type { Actif, PicJournalier } from '@/app/models/actif-model';
import { apiErrorMessage } from '@/app/models/api-errors';
import type { Portefeuille, PortefeuilleDetail, PortefeuilleSaisie, Position } from '@/app/models/portefeuille-model';
import { ActifService } from '@/app/pages/service/service/actif-service';
import { PortefeuilleService } from '@/app/pages/service/service/portefeuille-service';

type Feedback = { type: 'success' | 'error'; text: string } | null;

/** Période des pics affichés pour les actifs du portefeuille. */
const JOURS_PICS = 90;
const SAISIE_VIDE: PortefeuilleSaisie = { nom: '', description: '', devise: 'USD' };
const LIBELLES_TYPE: Record<string, string> = { action: 'Action', indice: 'Indice', crypto: 'Crypto' };

/** L'API peut renvoyer une quantité décimale sous forme de texte. */
function versNombre(valeur: unknown): number | null {
    return valeur === null || valeur === undefined || valeur === '' ? null : Number(valeur);
}

@Component({
    selector: 'app-portefeuilles',
    standalone: true,
    imports: [DatePipe, DecimalPipe, FormsModule, RouterLink, ButtonModule, ConfirmDialogModule, DialogModule, InputNumberModule, InputTextModule, SelectModule, TableModule, TagModule, TextareaModule],
    providers: [ConfirmationService],
    templateUrl: './portefeuilles.html'
})
export class PortefeuillesComponent implements OnInit {
    private readonly portefeuilleService = inject(PortefeuilleService);
    private readonly actifService = inject(ActifService);
    private readonly confirmation = inject(ConfirmationService);

    readonly libellesType = LIBELLES_TYPE;
    readonly joursPics = JOURS_PICS;

    // Liste
    readonly portefeuilles = signal<Portefeuille[]>([]);
    readonly chargementListe = signal(false);
    readonly erreurListe = signal('');

    // Détail
    readonly idSelectionne = signal<number | null>(null);
    readonly selection = signal<PortefeuilleDetail | null>(null);
    readonly chargementDetail = signal(false);
    readonly message = signal<Feedback>(null);

    // Fenêtre création / modification
    readonly fenetreVisible = signal(false);
    readonly enregistrement = signal(false);
    readonly erreurFenetre = signal('');
    enEdition: Portefeuille | null = null;
    saisie: PortefeuilleSaisie = { ...SAISIE_VIDE };

    // Ajout d'un actif
    readonly actifs = signal<Actif[]>([]);
    readonly ajoutEnCours = signal(false);
    symboleAjout: string | null = null;
    quantiteAjout: number | null = null;

    /** Quantités en cours de saisie, par symbole, avant enregistrement. */
    quantites: Record<string, number | null> = {};

    // Pics récents de tous les actifs (filtrés ensuite sur le portefeuille)
    private readonly picsRecents = signal<PicJournalier[]>([]);
    readonly erreurPics = signal('');

    readonly actifsDisponibles = computed(() => {
        const detenus = new Set(this.selection()?.actifs.map((p) => p.symbole) ?? []);
        return this.actifs()
            .filter((a) => !detenus.has(a.symbole))
            .map((a) => ({ label: `${a.symbole} — ${a.nom}`, value: a.symbole }));
    });

    readonly picsDuPortefeuille = computed(() => {
        const detenus = new Set(this.selection()?.actifs.map((p) => p.symbole.toUpperCase()) ?? []);
        return this.picsRecents()
            .filter((pic) => detenus.has(pic.symbole.toUpperCase()))
            .sort((a, b) => String(b.date).localeCompare(String(a.date)));
    });

    /** Si l'utilisateur change vite de portefeuille, seule la dernière réponse est gardée. */
    private readonly demandeDetail = new Subject<number>();

    constructor() {
        this.demandeDetail
            .pipe(
                tap((id) => {
                    this.idSelectionne.set(id);
                    this.chargementDetail.set(true);
                }),
                switchMap((id) =>
                    this.portefeuilleService.getPortefeuille(id).pipe(
                        catchError((erreur) => {
                            this.selection.set(null);
                            this.chargementDetail.set(false);
                            this.message.set({ type: 'error', text: apiErrorMessage(erreur, 'Impossible de charger ce portefeuille.') });
                            return EMPTY;
                        })
                    )
                ),
                takeUntilDestroyed()
            )
            .subscribe((detail) => {
                this.selection.set(detail);
                this.quantites = Object.fromEntries(detail.actifs.map((p) => [p.symbole, versNombre(p.quantite)]));
                this.chargementDetail.set(false);
            });
    }

    ngOnInit(): void {
        this.chargerPortefeuilles();
        this.chargerPics();
        this.actifService.getAssets().subscribe({
            next: (actifs) => this.actifs.set(actifs),
            error: (erreur) => this.message.set({ type: 'error', text: apiErrorMessage(erreur, 'Impossible de charger la liste des actifs.') })
        });
    }

    // ---------- LISTE ----------

    chargerPortefeuilles(idASelectionner?: number): void {
        this.chargementListe.set(true);
        this.erreurListe.set('');

        this.portefeuilleService.getPortefeuilles().subscribe({
            next: (liste) => {
                this.portefeuilles.set(liste);
                this.chargementListe.set(false);

                const id = [idASelectionner, this.idSelectionne(), liste[0]?.id].find((candidat) => liste.some((p) => p.id === candidat));
                if (id === undefined || id === null) {
                    this.idSelectionne.set(null);
                    this.selection.set(null);
                } else {
                    this.demandeDetail.next(id);
                }
            },
            error: (erreur) => {
                this.erreurListe.set(apiErrorMessage(erreur, 'Impossible de charger vos portefeuilles.'));
                this.chargementListe.set(false);
            }
        });
    }

    selectionner(id: number): void {
        this.message.set(null);
        this.demandeDetail.next(id);
    }

    classeCarte(id: number): string {
        return this.idSelectionne() === id ? 'border-primary bg-primary-50 dark:bg-primary-900/20' : 'border-surface-200 dark:border-surface-700 bg-transparent hover:bg-surface-100 dark:hover:bg-surface-800';
    }

    // ---------- CRÉATION / MODIFICATION ----------

    ouvrirCreation(): void {
        this.ouvrirFenetre(null, { ...SAISIE_VIDE });
    }

    ouvrirModification(portefeuille: Portefeuille): void {
        this.ouvrirFenetre(portefeuille, { nom: portefeuille.nom, description: portefeuille.description, devise: portefeuille.devise });
    }

    private ouvrirFenetre(portefeuille: Portefeuille | null, saisie: PortefeuilleSaisie): void {
        this.enEdition = portefeuille;
        this.saisie = saisie;
        this.erreurFenetre.set('');
        this.fenetreVisible.set(true);
    }

    enregistrer(): void {
        const saisie: PortefeuilleSaisie = {
            nom: this.saisie.nom.trim(),
            description: this.saisie.description?.trim() ?? '',
            devise: this.saisie.devise?.trim().toUpperCase() || 'USD'
        };
        if (!saisie.nom) {
            this.erreurFenetre.set('Le nom est obligatoire.');
            return;
        }

        this.enregistrement.set(true);
        this.erreurFenetre.set('');
        const requete = this.enEdition ? this.portefeuilleService.modifierPortefeuille(this.enEdition.id, saisie) : this.portefeuilleService.creerPortefeuille(saisie);

        requete.subscribe({
            next: (portefeuille) => {
                this.enregistrement.set(false);
                this.fenetreVisible.set(false);
                this.message.set(null);
                this.chargerPortefeuilles(portefeuille.id);
            },
            error: (erreur) => {
                this.enregistrement.set(false);
                this.erreurFenetre.set(apiErrorMessage(erreur, 'Enregistrement impossible.'));
            }
        });
    }

    confirmerSuppression(portefeuille: Portefeuille): void {
        this.confirmation.confirm({
            header: 'Supprimer le portefeuille',
            message: `Supprimer « ${portefeuille.nom} » et la liste de ses actifs ?`,
            icon: 'pi pi-exclamation-triangle',
            acceptLabel: 'Supprimer',
            rejectLabel: 'Annuler',
            acceptButtonProps: { severity: 'danger' },
            rejectButtonProps: { severity: 'secondary', outlined: true },
            accept: () =>
                this.portefeuilleService.supprimerPortefeuille(portefeuille.id).subscribe({
                    next: () => {
                        this.idSelectionne.set(null);
                        this.selection.set(null);
                        this.message.set({ type: 'success', text: `« ${portefeuille.nom} » a été supprimé.` });
                        this.chargerPortefeuilles();
                    },
                    error: (erreur) => this.message.set({ type: 'error', text: apiErrorMessage(erreur, 'Suppression impossible.') })
                })
        });
    }

    // ---------- ACTIFS DU PORTEFEUILLE ----------

    ajouterActif(): void {
        const portefeuille = this.selection();
        if (!portefeuille || !this.symboleAjout) return;

        this.ajoutEnCours.set(true);
        this.message.set(null);

        this.portefeuilleService.ajouterActif(portefeuille.id, this.symboleAjout, this.quantiteAjout).subscribe({
            next: (position) => {
                this.ajoutEnCours.set(false);
                this.symboleAjout = null;
                this.quantiteAjout = null;
                this.message.set({ type: 'success', text: `${position.symbole} ajouté au portefeuille.` });
                this.chargerPortefeuilles(portefeuille.id);
                // Un actif tout juste importé peut apporter de nouveaux pics.
                this.chargerPics();
            },
            error: (erreur) => {
                this.ajoutEnCours.set(false);
                this.message.set({ type: 'error', text: apiErrorMessage(erreur, 'Ajout impossible.') });
            }
        });
    }

    quantiteModifiee(position: Position): boolean {
        return versNombre(this.quantites[position.symbole]) !== versNombre(position.quantite);
    }

    enregistrerQuantite(position: Position): void {
        const portefeuille = this.selection();
        if (!portefeuille) return;

        this.portefeuilleService.modifierQuantite(portefeuille.id, position.symbole, this.quantites[position.symbole] ?? null).subscribe({
            next: (maj) => {
                this.selection.update((actuel) => (actuel?.id === portefeuille.id ? { ...actuel, actifs: actuel.actifs.map((p) => (p.symbole === maj.symbole ? maj : p)) } : actuel));
                this.message.set({ type: 'success', text: `Quantité de ${maj.symbole} enregistrée.` });
            },
            error: (erreur) => this.message.set({ type: 'error', text: apiErrorMessage(erreur, 'Modification impossible.') })
        });
    }

    confirmerRetrait(position: Position): void {
        this.confirmation.confirm({
            header: "Retirer l'actif",
            message: `Retirer ${position.symbole} de ce portefeuille ?`,
            icon: 'pi pi-exclamation-triangle',
            acceptLabel: 'Retirer',
            rejectLabel: 'Annuler',
            acceptButtonProps: { severity: 'danger' },
            rejectButtonProps: { severity: 'secondary', outlined: true },
            accept: () => this.retirerActif(position)
        });
    }

    private retirerActif(position: Position): void {
        const portefeuille = this.selection();
        if (!portefeuille) return;

        this.portefeuilleService.retirerActif(portefeuille.id, position.symbole).subscribe({
            next: () => {
                this.message.set({ type: 'success', text: `${position.symbole} retiré du portefeuille.` });
                this.chargerPortefeuilles(portefeuille.id);
            },
            error: (erreur) => this.message.set({ type: 'error', text: apiErrorMessage(erreur, 'Retrait impossible.') })
        });
    }

    // ---------- PICS ----------

    private chargerPics(): void {
        const debut = new Date(Date.now() - JOURS_PICS * 86400000).toISOString().slice(0, 10);
        this.erreurPics.set('');
        this.actifService.getPicsJournaliers({ debut }).subscribe({
            next: (pics) => this.picsRecents.set(pics),
            error: (erreur) => this.erreurPics.set(apiErrorMessage(erreur, 'Impossible de charger les pics récents.'))
        });
    }
}
