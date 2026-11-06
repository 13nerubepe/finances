import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, computed, ElementRef, inject, OnInit, signal, ViewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { ConfirmationService, MessageService } from 'primeng/api';
import { AvatarModule } from 'primeng/avatar';
import { Button } from 'primeng/button';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { DialogModule } from 'primeng/dialog';
import { IconField } from 'primeng/iconfield';
import { InputIcon } from 'primeng/inputicon';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputText } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';
import { MeterGroupModule } from 'primeng/metergroup';
import { SelectModule } from 'primeng/select';
import { Table, TableModule } from 'primeng/table';
import { Tag } from 'primeng/tag';
import { TextareaModule } from 'primeng/textarea';
import { ToastModule } from 'primeng/toast';
import { Tooltip } from 'primeng/tooltip';
import { catchError, EMPTY, Subject, switchMap, tap } from 'rxjs';

import type { Actif, PicJournalier } from '@/app/models/actif-model';
import { apiErrorMessage } from '@/app/models/api-errors';
import type { Portefeuille, PortefeuilleDetail, PortefeuilleSaisie, Position } from '@/app/models/portefeuille-model';
import { ActifService } from '@/app/pages/service/service/actif-service';
import { PortefeuilleService } from '@/app/pages/service/service/portefeuille-service';

interface InfoTypeActif {
    libelle: string;
    icone: string;
    couleur: string;
    severite: 'info' | 'success' | 'warn' | 'secondary';
}

/** Période des pics affichés pour les actifs d'une liste. */
const JOURS_PICS = 90;
const SAISIE_LISTE_VIDE: PortefeuilleSaisie = { nom: '', description: '', devise: 'USD' };

const TYPES_ACTIFS: Record<string, InfoTypeActif> = {
    action: { libelle: 'Action', icone: 'pi-briefcase', couleur: '#2962ff', severite: 'info' },
    indice: { libelle: 'Indice', icone: 'pi-chart-bar', couleur: '#00897b', severite: 'success' },
    crypto: { libelle: 'Crypto', icone: 'pi-bitcoin', couleur: '#ef6c00', severite: 'warn' }
};

const COULEURS_LISTES = ['#6366f1', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#14b8a6', '#f97316'];

/** L'API peut renvoyer une quantité décimale sous forme de texte. */
function versNombre(valeur: unknown): number | null {
    return valeur === null || valeur === undefined || valeur === '' ? null : Number(valeur);
}

@Component({
    selector: 'app-actif',
    standalone: true,
    imports: [
        CommonModule,
        FormsModule,
        RouterLink,
        TableModule,
        IconField,
        InputIcon,
        InputText,
        Button,
        Tooltip,
        ConfirmDialogModule,
        Tag,
        AvatarModule,
        DialogModule,
        InputNumberModule,
        MessageModule,
        MeterGroupModule,
        SelectModule,
        TextareaModule,
        ToastModule
    ],
    providers: [ConfirmationService, MessageService],
    templateUrl: './actif.html',
    styleUrl: './actif.scss'
})
export class ActifComponent implements OnInit {
    private readonly listeService = inject(PortefeuilleService);
    private readonly confirmationListes = inject(ConfirmationService);
    private readonly messagesListes = inject(MessageService);

    @ViewChild('detailListe') detailListe?: ElementRef<HTMLElement>;

    // ---------- Tous les actifs ----------
    actifs: Actif[] = [];
    loading = false;
    vue: 'tous' | 'mes' = 'tous';

    // ---------- Mes actifs ----------
    readonly joursPics = JOURS_PICS;
    private mesActifsCharges = false;

    readonly listes = signal<Portefeuille[]>([]);
    readonly chargementListes = signal(false);
    readonly erreurListes = signal('');

    readonly listeOuverte = signal<PortefeuilleDetail | null>(null);
    readonly chargementDetailListe = signal(false);

    readonly fenetreListeVisible = signal(false);
    readonly enregistrementListe = signal(false);
    readonly erreurFenetreListe = signal('');
    listeEnEdition: Portefeuille | null = null;
    saisieListe: PortefeuilleSaisie = { ...SAISIE_LISTE_VIDE };

    readonly catalogueActifs = signal<Actif[]>([]);
    readonly ajoutVisible = signal(false);
    readonly ajoutEnCours = signal(false);
    readonly erreurAjout = signal('');
    readonly cibleAjout = signal<Portefeuille | null>(null);
    readonly detenusAjout = signal<Set<string>>(new Set());
    /** Vrai si l'ajout part de « Tous les actifs » : on choisit alors la liste. */
    readonly choixListeAjout = signal(false);
    idListeAjout: number | null = null;
    symboleAjout: string | null = null;
    quantiteAjout: number | null = null;

    quantites: Record<string, number | null> = {};

    private readonly picsRecents = signal<PicJournalier[]>([]);
    readonly erreurPics = signal('');

    readonly totalActifsSuivis = computed(() => this.listes().reduce((total, l) => total + (l.nb_actifs ?? 0), 0));

    readonly listeRecente = computed(() =>
        this.listes().reduce<Portefeuille | null>((recente, l) => (!recente || l.date_creation > recente.date_creation ? l : recente), null)
    );

    readonly actifsDisponibles = computed(() => {
        const detenus = this.detenusAjout();
        return this.catalogueActifs()
            .filter((a) => !detenus.has(a.symbole))
            .map((a) => ({ label: `${a.symbole} — ${a.nom}`, value: a.symbole, actif: a }));
    });

    readonly picsDeLaListe = computed(() => {
        const detenus = new Set(this.listeOuverte()?.actifs.map((p) => p.symbole.toUpperCase()) ?? []);
        return this.picsRecents()
            .filter((pic) => detenus.has(pic.symbole.toUpperCase()))
            .sort((a, b) => String(b.date).localeCompare(String(a.date)));
    });

    /** Format attendu par p-metergroup. */
    readonly repartitionListe = computed(() => {
        const positions = this.listeOuverte()?.actifs ?? [];
        return Object.entries(TYPES_ACTIFS)
            .map(([id, type]) => ({
                label: type.libelle,
                value: positions.filter((p) => p.type_actif === id).length,
                color: type.couleur,
                icon: `pi ${type.icone}`
            }))
            .filter((t) => t.value > 0);
    });

    /** Seule la dernière demande compte ; `null` annule une demande en cours. */
    private readonly demandeDetailListe = new Subject<{ id: number; defiler: boolean } | null>();

    constructor(
        private router: Router,
        private cdr: ChangeDetectorRef,
        private assetService: ActifService
    ) {
        this.demandeDetailListe
            .pipe(
                tap((demande) => this.chargementDetailListe.set(demande !== null)),
                switchMap((demande) => {
                    if (!demande) return EMPTY;
                    return this.listeService.getPortefeuille(demande.id).pipe(
                        tap((detail) => {
                            this.listeOuverte.set(detail);
                            this.quantites = Object.fromEntries(detail.actifs.map((p) => [p.symbole, versNombre(p.quantite)]));
                            this.chargementDetailListe.set(false);
                            if (demande.defiler) setTimeout(() => this.detailListe?.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'start' }));
                        }),
                        catchError((erreur) => {
                            this.notifierListes('error', apiErrorMessage(erreur, 'Impossible de charger cette liste.'));
                            this.chargementDetailListe.set(false);
                            return EMPTY;
                        })
                    );
                }),
                takeUntilDestroyed()
            )
            .subscribe();
    }

    ngOnInit(): void {
        this.chargerActifs();
    }

    // ---------- Tous les actifs ----------

    largeurPerformance(actif: Actif): number {
        const variation = actif.variation ?? 0;

        return Math.min(Math.abs(variation), 50);
    }

    chargerActifs(): void {
        this.loading = true;

        this.assetService.getAssets().subscribe({
            next: (data: Actif[]) => {
                this.actifs = data;
                this.catalogueActifs.set(data);
                this.loading = false;

                this.cdr.detectChanges();
            },
            error: (error) => {
                console.error('Erreur lors du chargement des actifs :', error);
                this.loading = false;
                this.cdr.detectChanges();
            }
        });
    }

    voirActif(actif: Actif): void {
        this.router.navigate(['/detail-actif', actif.symbole]);
    }

    // ---------- Mes actifs : chargement ----------

    ouvrirMesActifs(): void {
        this.vue = 'mes';
        this.chargerDonneesMesActifs();
    }

    /** Charge les listes et les pics une seule fois, au premier besoin. */
    private chargerDonneesMesActifs(): void {
        if (this.mesActifsCharges) return;

        this.mesActifsCharges = true;
        this.chargerListes();
        this.chargerPics();
    }

    chargerListes(): void {
        this.chargementListes.set(true);
        this.erreurListes.set('');

        this.listeService.getPortefeuilles().subscribe({
            next: (listes) => {
                this.listes.set(listes);
                this.chargementListes.set(false);

                const courante = this.listeOuverte();
                if (courante && !listes.some((l) => l.id === courante.id)) this.listeOuverte.set(null);
            },
            error: (erreur) => {
                this.erreurListes.set(apiErrorMessage(erreur, 'Impossible de charger vos listes.'));
                this.chargementListes.set(false);
            }
        });
    }

    private chargerPics(): void {
        const debut = new Date(Date.now() - JOURS_PICS * 86400000).toISOString().slice(0, 10);
        this.erreurPics.set('');
        this.assetService.getPicsJournaliers({ debut }).subscribe({
            next: (pics) => this.picsRecents.set(pics),
            error: (erreur) => this.erreurPics.set(apiErrorMessage(erreur, 'Impossible de charger les pics récents.'))
        });
    }

    // ---------- Mes actifs : listes ----------

    filtrerListes(table: Table, evenement: Event): void {
        table.filterGlobal((evenement.target as HTMLInputElement).value, 'contains');
    }

    selectionnerListe(donnees: Portefeuille | Portefeuille[] | undefined): void {
        if (donnees && !Array.isArray(donnees)) this.afficherListe(donnees);
    }

    afficherListe(liste: Portefeuille, defiler = true): void {
        this.demandeDetailListe.next({ id: liste.id, defiler });
    }

    fermerListe(): void {
        this.demandeDetailListe.next(null);
        this.listeOuverte.set(null);
    }

    ouvrirCreationListe(): void {
        this.ouvrirFenetreListe(null, { ...SAISIE_LISTE_VIDE });
    }

    ouvrirModificationListe(liste: Portefeuille): void {
        this.ouvrirFenetreListe(liste, { nom: liste.nom, description: liste.description, devise: liste.devise });
    }

    private ouvrirFenetreListe(liste: Portefeuille | null, saisie: PortefeuilleSaisie): void {
        this.listeEnEdition = liste;
        this.saisieListe = saisie;
        this.erreurFenetreListe.set('');
        this.fenetreListeVisible.set(true);
    }

    enregistrerListe(): void {
        const saisie: PortefeuilleSaisie = {
            nom: this.saisieListe.nom.trim(),
            description: this.saisieListe.description?.trim() ?? '',
            devise: this.saisieListe.devise?.trim().toUpperCase() || 'USD'
        };
        if (!saisie.nom) {
            this.erreurFenetreListe.set('Le nom est obligatoire.');
            return;
        }

        this.enregistrementListe.set(true);
        this.erreurFenetreListe.set('');
        const edition = this.listeEnEdition;
        const requete = edition ? this.listeService.modifierPortefeuille(edition.id, saisie) : this.listeService.creerPortefeuille(saisie);

        requete.subscribe({
            next: (liste) => {
                this.enregistrementListe.set(false);
                this.fenetreListeVisible.set(false);
                this.notifierListes('success', edition ? `« ${liste.nom} » a été modifiée.` : `« ${liste.nom} » a été créée.`);
                this.chargerListes();
                if (edition && this.listeOuverte()?.id === edition.id) this.afficherListe(liste, false);
            },
            error: (erreur) => {
                this.enregistrementListe.set(false);
                this.erreurFenetreListe.set(apiErrorMessage(erreur, 'Enregistrement impossible.'));
            }
        });
    }

    confirmerSuppressionListe(liste: Portefeuille): void {
        this.confirmationListes.confirm({
            header: 'Supprimer la liste',
            message: `Supprimer « ${liste.nom} » et ses ${liste.nb_actifs} actif(s) ? Cette action est définitive.`,
            icon: 'pi pi-exclamation-triangle',
            acceptLabel: 'Supprimer',
            rejectLabel: 'Annuler',
            acceptButtonProps: { severity: 'danger', icon: 'pi pi-trash' },
            rejectButtonProps: { severity: 'secondary', outlined: true },
            accept: () =>
                this.listeService.supprimerPortefeuille(liste.id).subscribe({
                    next: () => {
                        if (this.listeOuverte()?.id === liste.id) this.fermerListe();
                        this.notifierListes('success', `« ${liste.nom} » a été supprimée.`);
                        this.chargerListes();
                    },
                    error: (erreur) => this.notifierListes('error', apiErrorMessage(erreur, 'Suppression impossible.'))
                })
        });
    }

    // ---------- Mes actifs : ajout d'un actif ----------

    /** Depuis « Mes actifs » : la liste est connue, on choisit l'actif. */
    ouvrirAjout(liste: Portefeuille): void {
        this.choixListeAjout.set(false);
        this.cibleAjout.set(liste);
        this.idListeAjout = liste.id;
        this.symboleAjout = null;
        this.quantiteAjout = null;
        this.erreurAjout.set('');

        const courante = this.listeOuverte();
        if (courante?.id === liste.id) {
            this.detenusAjout.set(new Set(courante.actifs.map((p) => p.symbole)));
        } else {
            this.chargerDetenus(liste.id);
        }

        this.ajoutVisible.set(true);
    }

    /** Depuis « Tous les actifs » : l'actif est connu, on choisit la liste. */
    ouvrirAjoutDepuisTous(actif: Actif): void {
        this.chargerDonneesMesActifs();

        this.choixListeAjout.set(true);
        this.cibleAjout.set(null);
        this.idListeAjout = null;
        this.symboleAjout = actif.symbole;
        this.quantiteAjout = null;
        this.detenusAjout.set(new Set());
        this.erreurAjout.set('');
        this.ajoutVisible.set(true);
    }

    choisirListeAjout(id: number | null): void {
        this.idListeAjout = id;
        this.cibleAjout.set(this.listes().find((l) => l.id === id) ?? null);
        this.erreurAjout.set('');
        if (id !== null) this.chargerDetenus(id);
    }

    private chargerDetenus(id: number): void {
        this.detenusAjout.set(new Set());
        this.listeService.getPortefeuille(id).subscribe({
            next: (detail) => {
                if (this.cibleAjout()?.id === id) this.detenusAjout.set(new Set(detail.actifs.map((p) => p.symbole)));
            }
        });
    }

    actifDejaDansListe(): boolean {
        return this.choixListeAjout() && !!this.symboleAjout && this.detenusAjout().has(this.symboleAjout);
    }

    ajouterActif(): void {
        const liste = this.cibleAjout();
        if (!liste || !this.symboleAjout || this.actifDejaDansListe()) return;

        this.ajoutEnCours.set(true);
        this.erreurAjout.set('');

        this.listeService.ajouterActif(liste.id, this.symboleAjout, this.quantiteAjout).subscribe({
            next: (position) => {
                this.ajoutEnCours.set(false);
                this.ajoutVisible.set(false);
                this.notifierListes('success', `${position.symbole} a été ajouté à « ${liste.nom} ».`);
                this.chargerListes();
                // Un actif tout juste importé peut apporter de nouveaux pics.
                this.chargerPics();
                if (this.listeOuverte()?.id === liste.id) this.afficherListe(liste, false);
            },
            error: (erreur) => {
                this.ajoutEnCours.set(false);
                this.erreurAjout.set(apiErrorMessage(erreur, 'Ajout impossible.'));
            }
        });
    }

    // ---------- Mes actifs : actifs d'une liste ----------

    quantiteModifiee(position: Position): boolean {
        return versNombre(this.quantites[position.symbole]) !== versNombre(position.quantite);
    }

    enregistrerQuantite(position: Position): void {
        const liste = this.listeOuverte();
        if (!liste) return;

        this.listeService.modifierQuantite(liste.id, position.symbole, this.quantites[position.symbole] ?? null).subscribe({
            next: (maj) => {
                this.listeOuverte.update((actuelle) => (actuelle?.id === liste.id ? { ...actuelle, actifs: actuelle.actifs.map((p) => (p.symbole === maj.symbole ? maj : p)) } : actuelle));
                this.notifierListes('success', `Quantité de ${maj.symbole} enregistrée.`);
            },
            error: (erreur) => this.notifierListes('error', apiErrorMessage(erreur, 'Modification impossible.'))
        });
    }

    retirerActif(position: Position): void {
        const liste = this.listeOuverte();
        if (!liste) return;

        this.confirmationListes.confirm({
            header: 'Retirer un actif',
            message: `Retirer ${position.symbole} de « ${liste.nom} » ?`,
            icon: 'pi pi-question-circle',
            acceptLabel: 'Retirer',
            rejectLabel: 'Annuler',
            acceptButtonProps: { severity: 'danger' },
            rejectButtonProps: { severity: 'secondary', outlined: true },
            accept: () =>
                this.listeService.retirerActif(liste.id, position.symbole).subscribe({
                    next: () => {
                        this.afficherListe(liste, false);
                        this.chargerListes();
                        this.notifierListes('success', `${position.symbole} a été retiré.`);
                    },
                    error: (erreur) => this.notifierListes('error', apiErrorMessage(erreur, 'Retrait impossible.'))
                })
        });
    }

    // ---------- Utilitaires ----------

    private notifierListes(severity: 'success' | 'error', detail: string): void {
        this.messagesListes.add({ severity, summary: severity === 'success' ? 'Succès' : 'Erreur', detail });
    }

    couleurListe(liste: Portefeuille): string {
        return COULEURS_LISTES[liste.id % COULEURS_LISTES.length];
    }

    initialesListe(nom: string): string {
        const mots = nom.trim().split(/\s+/).filter(Boolean);
        return ((mots[0]?.[0] ?? '') + (mots[1]?.[0] ?? mots[0]?.[1] ?? '')).toUpperCase() || '?';
    }

    infoType(id: string): InfoTypeActif {
        return TYPES_ACTIFS[id] ?? { libelle: id, icone: 'pi-circle', couleur: '#64748b', severite: 'secondary' };
    }
}
