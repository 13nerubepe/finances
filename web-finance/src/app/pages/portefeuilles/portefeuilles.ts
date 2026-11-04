import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
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

import type { Actif, PicJournalier } from '@/app/models/actif-model';
import { apiErrorMessage } from '@/app/models/api-errors';
import type { Portefeuille, PortefeuilleDetail, PortefeuilleSaisie, Position } from '@/app/models/portefeuille-model';
import { ActifService } from '@/app/pages/service/service/actif-service';
import { PortefeuilleService } from '@/app/pages/service/service/portefeuille-service';

type Feedback = { type: 'success' | 'error'; text: string } | null;

/** Les pics des 90 derniers jours sont affichés pour les actifs du portefeuille (|z| > 3 : quelques-uns par trimestre). */
const JOURS_PICS = 90;

const LIBELLES_TYPE: Record<string, string> = { action: 'Action', indice: 'Indice', crypto: 'Crypto' };

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

    // Liste
    readonly portefeuilles = signal<Portefeuille[]>([]);
    readonly chargementListe = signal(false);
    readonly erreurListe = signal('');

    // Détail
    readonly selection = signal<PortefeuilleDetail | null>(null);
    readonly chargementDetail = signal(false);
    readonly message = signal<Feedback>(null);

    // Fenêtre création / modification
    readonly fenetreVisible = signal(false);
    readonly enregistrement = signal(false);
    readonly erreurFenetre = signal('');
    enEdition: Portefeuille | null = null;
    saisie: PortefeuilleSaisie = { nom: '', description: '', devise: 'USD' };

    // Ajout d'un actif
    readonly actifs = signal<Actif[]>([]);
    readonly ajoutEnCours = signal(false);
    symboleAjout: string | null = null;
    quantiteAjout: number | null = null;

    /** Quantités en cours de saisie, par symbole, avant enregistrement. */
    quantites: Record<string, number | null> = {};

    // Pics récents de tous les actifs (filtrés ensuite sur le portefeuille)
    private readonly picsRecents = signal<PicJournalier[]>([]);

    readonly actifsDisponibles = computed(() => {
        const detenus = new Set(this.selection()?.actifs.map((p) => p.symbole) ?? []);
        return this.actifs()
            .filter((a) => !detenus.has(a.symbole))
            .map((a) => ({ label: `${a.symbole} — ${a.nom}`, value: a.symbole }));
    });

    readonly picsDuPortefeuille = computed(() => {
        const detenus = new Set(this.selection()?.actifs.map((p) => p.symbole.toUpperCase()) ?? []);
        return this.picsRecents().filter((pic) => detenus.has(pic.symbole.toUpperCase()));
    });

    ngOnInit(): void {
        this.chargerPortefeuilles();
        this.actifService.getAssets().subscribe({ next: (actifs) => this.actifs.set(actifs) });

        const debut = new Date(Date.now() - JOURS_PICS * 86400000).toISOString().slice(0, 10);
        this.actifService.getPicsJournaliers({ debut }).subscribe({ next: (pics) => this.picsRecents.set(pics) });
    }

    // ---------- LISTE ----------

    chargerPortefeuilles(idASelectionner?: number): void {
        this.chargementListe.set(true);
        this.erreurListe.set('');

        this.portefeuilleService.getPortefeuilles().subscribe({
            next: (liste) => {
                this.portefeuilles.set(liste);
                this.chargementListe.set(false);

                const id = idASelectionner ?? this.selection()?.id ?? liste[0]?.id;
                if (id !== undefined && liste.some((p) => p.id === id)) {
                    this.selectionner(id);
                } else {
                    this.selection.set(null);
                }
            },
            error: (erreur) => {
                this.erreurListe.set(apiErrorMessage(erreur, 'Impossible de charger vos portefeuilles.'));
                this.chargementListe.set(false);
            }
        });
    }

    selectionner(id: number): void {
        this.chargementDetail.set(true);
        this.message.set(null);

        this.portefeuilleService.getPortefeuille(id).subscribe({
            next: (detail) => {
                this.selection.set(detail);
                this.quantites = Object.fromEntries(detail.actifs.map((p) => [p.symbole, p.quantite]));
                this.chargementDetail.set(false);
            },
            error: (erreur) => {
                this.message.set({ type: 'error', text: apiErrorMessage(erreur, 'Impossible de charger ce portefeuille.') });
                this.chargementDetail.set(false);
            }
        });
    }

    // ---------- CRÉATION / MODIFICATION ----------

    ouvrirCreation(): void {
        this.enEdition = null;
        this.saisie = { nom: '', description: '', devise: 'USD' };
        this.erreurFenetre.set('');
        this.fenetreVisible.set(true);
    }

    ouvrirModification(portefeuille: Portefeuille): void {
        this.enEdition = portefeuille;
        this.saisie = { nom: portefeuille.nom, description: portefeuille.description, devise: portefeuille.devise };
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
        const requete = this.enEdition ? this.portefeuilleService.modifierPortefeuille(this.enEdition.id, saisie) : this.portefeuilleService.creerPortefeuille(saisie);

        requete.subscribe({
            next: (portefeuille) => {
                this.enregistrement.set(false);
                this.fenetreVisible.set(false);
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
                        this.selection.set(null);
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
            },
            error: (erreur) => {
                this.ajoutEnCours.set(false);
                this.message.set({ type: 'error', text: apiErrorMessage(erreur, 'Ajout impossible.') });
            }
        });
    }

    quantiteModifiee(position: Position): boolean {
        return (this.quantites[position.symbole] ?? null) !== (position.quantite ?? null);
    }

    enregistrerQuantite(position: Position): void {
        const portefeuille = this.selection();
        if (!portefeuille) return;

        this.portefeuilleService.modifierQuantite(portefeuille.id, position.symbole, this.quantites[position.symbole] ?? null).subscribe({
            next: (maj) => {
                this.selection.set({
                    ...portefeuille,
                    actifs: portefeuille.actifs.map((p) => (p.symbole === maj.symbole ? maj : p))
                });
                this.message.set({ type: 'success', text: `Quantité de ${maj.symbole} enregistrée.` });
            },
            error: (erreur) => this.message.set({ type: 'error', text: apiErrorMessage(erreur, 'Modification impossible.') })
        });
    }

    retirerActif(position: Position): void {
        const portefeuille = this.selection();
        if (!portefeuille) return;

        this.portefeuilleService.retirerActif(portefeuille.id, position.symbole).subscribe({
            next: () => this.chargerPortefeuilles(portefeuille.id),
            error: (erreur) => this.message.set({ type: 'error', text: apiErrorMessage(erreur, 'Retrait impossible.') })
        });
    }
}
