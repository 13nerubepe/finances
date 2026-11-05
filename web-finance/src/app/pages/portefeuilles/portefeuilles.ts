import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, computed, ElementRef, inject, OnInit, signal, ViewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ConfirmationService, MessageService } from 'primeng/api';
import { AvatarModule } from 'primeng/avatar';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { DialogModule } from 'primeng/dialog';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';
import { MeterGroupModule } from 'primeng/metergroup';
import { SelectModule } from 'primeng/select';
import { Table, TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { TextareaModule } from 'primeng/textarea';
import { ToastModule } from 'primeng/toast';
import { TooltipModule } from 'primeng/tooltip';
import { catchError, EMPTY, Subject, switchMap, tap } from 'rxjs';

import type { Actif, PicJournalier } from '@/app/models/actif-model';
import { apiErrorMessage } from '@/app/models/api-errors';
import type { Portefeuille, PortefeuilleDetail, PortefeuilleSaisie, Position } from '@/app/models/portefeuille-model';
import { ActifService } from '@/app/pages/service/service/actif-service';
import { PortefeuilleService } from '@/app/pages/service/service/portefeuille-service';

interface TypeActif {
    libelle: string;
    icone: string;
    couleur: string;
    severite: 'info' | 'success' | 'warn' | 'secondary';
}

/** Période des pics affichés pour les actifs du portefeuille. */
const JOURS_PICS = 90;
const SAISIE_VIDE: PortefeuilleSaisie = { nom: '', description: '', devise: 'USD' };

const TYPES: Record<string, TypeActif> = {
    action: { libelle: 'Action', icone: 'pi-briefcase', couleur: '#2962ff', severite: 'info' },
    indice: { libelle: 'Indice', icone: 'pi-chart-bar', couleur: '#00897b', severite: 'success' },
    crypto: { libelle: 'Crypto', icone: 'pi-bitcoin', couleur: '#ef6c00', severite: 'warn' }
};

const COULEURS = ['#6366f1', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#14b8a6', '#f97316'];

/** L'API peut renvoyer une quantité décimale sous forme de texte. */
function versNombre(valeur: unknown): number | null {
    return valeur === null || valeur === undefined || valeur === '' ? null : Number(valeur);
}

@Component({
    selector: 'app-portefeuilles',
    standalone: true,
    imports: [
        DatePipe,
        DecimalPipe,
        FormsModule,
        RouterLink,
        AvatarModule,
        ButtonModule,
        CardModule,
        ConfirmDialogModule,
        DialogModule,
        IconFieldModule,
        InputIconModule,
        InputNumberModule,
        InputTextModule,
        MessageModule,
        MeterGroupModule,
        SelectModule,
        TableModule,
        TagModule,
        TextareaModule,
        ToastModule,
        TooltipModule
    ],
    providers: [ConfirmationService, MessageService],
    templateUrl: './portefeuilles.html'
})
export class PortefeuillesComponent implements OnInit {
    private readonly portefeuilleService = inject(PortefeuilleService);
    private readonly actifService = inject(ActifService);
    private readonly confirmation = inject(ConfirmationService);
    private readonly messages = inject(MessageService);

    @ViewChild('detail') detail?: ElementRef<HTMLElement>;

    readonly joursPics = JOURS_PICS;

    readonly portefeuilles = signal<Portefeuille[]>([]);
    readonly chargementListe = signal(false);
    readonly erreurListe = signal('');

    readonly selection = signal<PortefeuilleDetail | null>(null);
    readonly chargementDetail = signal(false);

    readonly fenetreVisible = signal(false);
    readonly enregistrement = signal(false);
    readonly erreurFenetre = signal('');
    enEdition: Portefeuille | null = null;
    saisie: PortefeuilleSaisie = { ...SAISIE_VIDE };

    readonly actifs = signal<Actif[]>([]);
    readonly ajoutVisible = signal(false);
    readonly ajoutEnCours = signal(false);
    readonly erreurAjout = signal('');
    readonly cibleAjout = signal<Portefeuille | null>(null);
    readonly detenusAjout = signal<Set<string>>(new Set());
    symboleAjout: string | null = null;
    quantiteAjout: number | null = null;

    quantites: Record<string, number | null> = {};

    private readonly picsRecents = signal<PicJournalier[]>([]);
    readonly erreurPics = signal('');

    readonly totalActifs = computed(() => this.portefeuilles().reduce((total, p) => total + (p.nb_actifs ?? 0), 0));

    readonly plusRecent = computed(() =>
        this.portefeuilles().reduce<Portefeuille | null>((recent, p) => (!recent || p.date_creation > recent.date_creation ? p : recent), null)
    );

    readonly actifsDisponibles = computed(() => {
        const detenus = this.detenusAjout();
        return this.actifs()
            .filter((a) => !detenus.has(a.symbole))
            .map((a) => ({ label: `${a.symbole} — ${a.nom}`, value: a.symbole, actif: a }));
    });

    readonly picsDuPortefeuille = computed(() => {
        const detenus = new Set(this.selection()?.actifs.map((p) => p.symbole.toUpperCase()) ?? []);
        return this.picsRecents()
            .filter((pic) => detenus.has(pic.symbole.toUpperCase()))
            .sort((a, b) => String(b.date).localeCompare(String(a.date)));
    });

    /** Format attendu par p-metergroup. */
    readonly repartition = computed(() => {
        const positions = this.selection()?.actifs ?? [];
        return Object.entries(TYPES)
            .map(([id, type]) => ({
                label: type.libelle,
                value: positions.filter((p) => p.type_actif === id).length,
                color: type.couleur,
                icon: `pi ${type.icone}`
            }))
            .filter((t) => t.value > 0);
    });

    /** Seule la dernière demande compte ; `null` annule une demande en cours. */
    private readonly demandeDetail = new Subject<{ id: number; defiler: boolean } | null>();

    constructor() {
        this.demandeDetail
            .pipe(
                tap((demande) => this.chargementDetail.set(demande !== null)),
                switchMap((demande) => {
                    if (!demande) return EMPTY;
                    return this.portefeuilleService.getPortefeuille(demande.id).pipe(
                        tap((detail) => {
                            this.selection.set(detail);
                            this.quantites = Object.fromEntries(detail.actifs.map((p) => [p.symbole, versNombre(p.quantite)]));
                            this.chargementDetail.set(false);
                            if (demande.defiler) setTimeout(() => this.detail?.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'start' }));
                        }),
                        catchError((erreur) => {
                            this.notifier('error', apiErrorMessage(erreur, 'Impossible de charger ce portefeuille.'));
                            this.chargementDetail.set(false);
                            return EMPTY;
                        })
                    );
                }),
                takeUntilDestroyed()
            )
            .subscribe();
    }

    ngOnInit(): void {
        this.chargerPortefeuilles();
        this.chargerPics();
        this.actifService.getAssets().subscribe({
            next: (actifs) => this.actifs.set(actifs),
            error: (erreur) => this.notifier('error', apiErrorMessage(erreur, 'Impossible de charger la liste des actifs.'))
        });
    }

    chargerPortefeuilles(): void {
        this.chargementListe.set(true);
        this.erreurListe.set('');

        this.portefeuilleService.getPortefeuilles().subscribe({
            next: (liste) => {
                this.portefeuilles.set(liste);
                this.chargementListe.set(false);

                const courant = this.selection();
                if (courant && !liste.some((p) => p.id === courant.id)) this.selection.set(null);
            },
            error: (erreur) => {
                this.erreurListe.set(apiErrorMessage(erreur, 'Impossible de charger vos portefeuilles.'));
                this.chargementListe.set(false);
            }
        });
    }

    filtrer(table: Table, evenement: Event): void {
        table.filterGlobal((evenement.target as HTMLInputElement).value, 'contains');
    }

    selectionnerLigne(donnees: Portefeuille | Portefeuille[] | undefined): void {
        if (donnees && !Array.isArray(donnees)) this.afficher(donnees);
    }

    afficher(portefeuille: Portefeuille, defiler = true): void {
        this.demandeDetail.next({ id: portefeuille.id, defiler });
    }

    fermerDetail(): void {
        this.demandeDetail.next(null);
        this.selection.set(null);
    }

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
        const edition = this.enEdition;
        const requete = edition ? this.portefeuilleService.modifierPortefeuille(edition.id, saisie) : this.portefeuilleService.creerPortefeuille(saisie);

        requete.subscribe({
            next: (portefeuille) => {
                this.enregistrement.set(false);
                this.fenetreVisible.set(false);
                this.notifier('success', edition ? `« ${portefeuille.nom} » a été modifié.` : `« ${portefeuille.nom} » a été créé.`);
                this.chargerPortefeuilles();
                if (edition && this.selection()?.id === edition.id) this.afficher(portefeuille, false);
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
            message: `Supprimer « ${portefeuille.nom} » et la liste de ses ${portefeuille.nb_actifs} actif(s) ? Cette action est définitive.`,
            icon: 'pi pi-exclamation-triangle',
            acceptLabel: 'Supprimer',
            rejectLabel: 'Annuler',
            acceptButtonProps: { severity: 'danger', icon: 'pi pi-trash' },
            rejectButtonProps: { severity: 'secondary', outlined: true },
            accept: () =>
                this.portefeuilleService.supprimerPortefeuille(portefeuille.id).subscribe({
                    next: () => {
                        if (this.selection()?.id === portefeuille.id) this.fermerDetail();
                        this.notifier('success', `« ${portefeuille.nom} » a été supprimé.`);
                        this.chargerPortefeuilles();
                    },
                    error: (erreur) => this.notifier('error', apiErrorMessage(erreur, 'Suppression impossible.'))
                })
        });
    }

    ouvrirAjout(portefeuille: Portefeuille): void {
        this.cibleAjout.set(portefeuille);
        this.symboleAjout = null;
        this.quantiteAjout = null;
        this.erreurAjout.set('');

        const courant = this.selection();
        if (courant?.id === portefeuille.id) {
            this.detenusAjout.set(new Set(courant.actifs.map((p) => p.symbole)));
        } else {
            this.detenusAjout.set(new Set());
            this.portefeuilleService.getPortefeuille(portefeuille.id).subscribe({
                next: (detail) => this.detenusAjout.set(new Set(detail.actifs.map((p) => p.symbole)))
            });
        }

        this.ajoutVisible.set(true);
    }

    ajouterActif(): void {
        const portefeuille = this.cibleAjout();
        if (!portefeuille || !this.symboleAjout) return;

        this.ajoutEnCours.set(true);
        this.erreurAjout.set('');

        this.portefeuilleService.ajouterActif(portefeuille.id, this.symboleAjout, this.quantiteAjout).subscribe({
            next: (position) => {
                this.ajoutEnCours.set(false);
                this.ajoutVisible.set(false);
                this.notifier('success', `${position.symbole} a été ajouté à « ${portefeuille.nom} ».`);
                this.chargerPortefeuilles();
                // Un actif tout juste importé peut apporter de nouveaux pics.
                this.chargerPics();
                if (this.selection()?.id === portefeuille.id) this.afficher(portefeuille, false);
            },
            error: (erreur) => {
                this.ajoutEnCours.set(false);
                this.erreurAjout.set(apiErrorMessage(erreur, 'Ajout impossible.'));
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
                this.notifier('success', `Quantité de ${maj.symbole} enregistrée.`);
            },
            error: (erreur) => this.notifier('error', apiErrorMessage(erreur, 'Modification impossible.'))
        });
    }

    retirerActif(position: Position): void {
        const portefeuille = this.selection();
        if (!portefeuille) return;

        this.confirmation.confirm({
            header: 'Retirer un actif',
            message: `Retirer ${position.symbole} de « ${portefeuille.nom} » ?`,
            icon: 'pi pi-question-circle',
            acceptLabel: 'Retirer',
            rejectLabel: 'Annuler',
            acceptButtonProps: { severity: 'danger' },
            rejectButtonProps: { severity: 'secondary', outlined: true },
            accept: () =>
                this.portefeuilleService.retirerActif(portefeuille.id, position.symbole).subscribe({
                    next: () => {
                        this.afficher(portefeuille, false);
                        this.chargerPortefeuilles();
                        this.notifier('success', `${position.symbole} a été retiré.`);
                    },
                    error: (erreur) => this.notifier('error', apiErrorMessage(erreur, 'Retrait impossible.'))
                })
        });
    }

    private chargerPics(): void {
        const debut = new Date(Date.now() - JOURS_PICS * 86400000).toISOString().slice(0, 10);
        this.erreurPics.set('');
        this.actifService.getPicsJournaliers({ debut }).subscribe({
            next: (pics) => this.picsRecents.set(pics),
            error: (erreur) => this.erreurPics.set(apiErrorMessage(erreur, 'Impossible de charger les pics récents.'))
        });
    }

    private notifier(severity: 'success' | 'error', detail: string): void {
        this.messages.add({ severity, summary: severity === 'success' ? 'Succès' : 'Erreur', detail });
    }

    couleur(portefeuille: Portefeuille): string {
        return COULEURS[portefeuille.id % COULEURS.length];
    }

    initiales(nom: string): string {
        const mots = nom.trim().split(/\s+/).filter(Boolean);
        return ((mots[0]?.[0] ?? '') + (mots[1]?.[0] ?? mots[0]?.[1] ?? '')).toUpperCase() || '?';
    }

    type(id: string): TypeActif {
        return TYPES[id] ?? { libelle: id, icone: 'pi-circle', couleur: '#64748b', severite: 'secondary' };
    }
}
