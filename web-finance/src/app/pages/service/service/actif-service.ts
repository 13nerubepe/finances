import { Injectable, inject, signal } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { EMPTY, Observable, expand, map, reduce } from 'rxjs';

import {
    Actif,
    Actualite,
    CorrelationsResponse, ExplicationPic,
    FiltresCours,
    FiltresPicsJournaliers,
    Frequence,
    HistoricalPrice,
    HistoricalPriceResponse,
    MessageAssistantIA,
    PicJournalier,
    PicsResponse,
    ReponseAssistantIA,
    RequeteAssistantIA,
    SourceActualites,
    TopMover,
    TopMoversResponse,
    VolatiliteResponse
} from '@/app/models/actif-model';
import { User } from '@/app/models/auth.models';
import { environment } from '@/environments/environment';

@Injectable({
    providedIn: 'root'
})
export class ActifService {
    private http = inject(HttpClient);

    // Utilisateur connecté
    user = signal<User | null>(null);

    // Adresse de base de l'API, sans slash à la fin
    private apiUrl = environment.apiUrl.replace(/\/+$/, '');

    private actifsUrl = `${this.apiUrl}/actifs/`;
    private coursUrl = `${this.apiUrl}/cours/`;
    private correlationsUrl = `${this.apiUrl}/correlations/`;
    private picsJournaliersUrl = `${this.apiUrl}/pics-journaliers/`;
    private actualitesUrl = `${this.apiUrl}/actualites/`;
    private sourcesUrl = `${this.apiUrl}/sources/`;
    private assistantUrl = `${this.apiUrl}/assistant-ia/`;

    // ---------- ACTIFS ----------

    // Récupère la liste des actifs
    getAssets(): Observable<Actif[]> {
        return this.http.get<Actif[]>(this.actifsUrl);
    }

    // Récupère un actif avec son symbole, par exemple AAPL
    getAssetBySymbole(symbole: string): Observable<Actif> {
        return this.http.get<Actif>(`${this.actifsUrl}${encodeURIComponent(symbole)}/`);
    }

    // ---------- COURS ----------

    // Récupère une page de cours
    getAssetHistory(filtres: FiltresCours): Observable<HistoricalPriceResponse> {
        let params = new HttpParams()
            .set('actif', filtres.actif)
            .set('ordre', '-horodatage')
            .set('taille', 100);

        if (filtres.debut) {
            params = params.set('debut', filtres.debut);
        }

        if (filtres.fin) {
            params = params.set('fin', filtres.fin);
        }

        return this.http.get<HistoricalPriceResponse>(this.coursUrl, { params });
    }

    // Récupère toutes les pages et trie les cours du plus ancien au plus récent
    getAllAssetHistory(filtres: FiltresCours): Observable<HistoricalPrice[]> {
        return this.getAssetHistory(filtres).pipe(
            expand((reponse) => (reponse.next ? this.http.get<HistoricalPriceResponse>(reponse.next) : EMPTY)),
            map((reponse) => reponse.results),
            reduce((cours, page) => cours.concat(page), [] as HistoricalPrice[]),
            map((cours) => cours.sort((a, b) => a.horodatage.localeCompare(b.horodatage)))
        );
    }

    // ---------- VOLATILITÉ ET PICS ----------

    // Récupère le rendement, l'écart-type glissant et l'amplitude d'un actif
    getVolatilite(symbole: string, frequence: Frequence = '1j', fenetre = 20, debut?: string, fin?: string): Observable<VolatiliteResponse> {
        const params = this.creerParamsAnalyse(frequence, fenetre, debut, fin);
        return this.http.get<VolatiliteResponse>(`${this.actifsUrl}${encodeURIComponent(symbole)}/volatilite/`, { params });
    }

    // Récupère les mouvements inhabituels d'un actif
    getPics(symbole: string, frequence: Frequence = '1j', fenetre = 20, seuil = 2, debut?: string, fin?: string): Observable<PicsResponse> {
        const params = this.creerParamsAnalyse(frequence, fenetre, debut, fin).set('seuil', seuil);
        return this.http.get<PicsResponse>(`${this.actifsUrl}${encodeURIComponent(symbole)}/pics/`, { params });
    }

    // Récupère les pics journaliers enregistrés (ceux que l'assistant explique), les plus récents d'abord
    getPicsJournaliers(filtres: FiltresPicsJournaliers = {}): Observable<PicJournalier[]> {
        let params = new HttpParams();

        for (const [cle, valeur] of Object.entries(filtres)) {
            if (valeur) {
                params = params.set(cle, valeur);
            }
        }

        return this.http.get<PicJournalier[]>(this.picsJournaliersUrl, { params });
    }

    // ---------- CORRÉLATIONS ----------

    // Récupère la matrice de corrélation de 2 à 10 actifs
    getCorrelations(symboles: string[], frequence: Frequence = '1j', debut?: string, fin?: string): Observable<CorrelationsResponse> {
        let params = new HttpParams()
            .set('actifs', symboles.join(','))
            .set('frequence', frequence);

        if (debut) {
            params = params.set('debut', debut);
        }

        if (fin) {
            params = params.set('fin', fin);
        }

        return this.http.get<CorrelationsResponse>(this.correlationsUrl, { params });
    }

    // ---------- ACTUALITÉS ----------

    // Récupère toutes les actualités, ou celles d'un actif si le symbole est donné
    getActualites(symbole?: string): Observable<Actualite[]> {
        let params = new HttpParams().set('ordering', '-date_publication');

        if (symbole) {
            params = params.set('symbole', symbole);
        }

        return this.http.get<Actualite[]>(this.actualitesUrl, { params });
    }

    // Récupère les sources RSS
    getSources(): Observable<SourceActualites[]> {
        return this.http.get<SourceActualites[]>(this.sourcesUrl);
    }

    // ---------- ASSISTANT IA ----------

    // Demande à l'agent d'expliquer le pic d'un jour (format AAAA-MM-JJ)
    getExplicationPic(symbole: string, jour: string): Observable<ExplicationPic> {
        return this.http.get<ExplicationPic>(`${this.apiUrl}/agent/pics/${encodeURIComponent(symbole)}/${jour}/explication/`);
    }

    // Envoie une question à l'assistant
    envoyerMessage(requete: RequeteAssistantIA): Observable<ReponseAssistantIA> {
        return this.http.post<ReponseAssistantIA>(`${this.assistantUrl}question/`, requete);
    }

    // Récupère l'historique de la conversation
    getHistorique(): Observable<MessageAssistantIA[]> {
        return this.http.get<MessageAssistantIA[]>(`${this.assistantUrl}historique/`);
    }

    // ---------- TABLEAU DE BORD ----------

    // Calcule les 5 plus fortes hausses et baisses à partir de la liste des actifs
    getTopMovers(): Observable<TopMoversResponse> {
        return this.getAssets().pipe(
            map((actifs) => {
                const mouvements: TopMover[] = actifs
                    .filter((actif) => actif.variation !== undefined && actif.variation !== null)
                    .map((actif) => {
                        const prix = Number(actif.prix_actuel ?? 0);
                        const variation = Number(actif.variation);
                        const prixPrecedent = prix / (1 + variation / 100);

                        return {
                            symbol: actif.symbole,
                            name: actif.nom,
                            price: prix,
                            change: prix - prixPrecedent,
                            changePercent: variation
                        };
                    });

                return {
                    gainers: mouvements
                        .filter((actif) => actif.changePercent > 0)
                        .sort((a, b) => b.changePercent - a.changePercent)
                        .slice(0, 5),
                    losers: mouvements
                        .filter((actif) => actif.changePercent < 0)
                        .sort((a, b) => a.changePercent - b.changePercent)
                        .slice(0, 5)
                };
            })
        );
    }

    // ---------- OUTIL INTERNE ----------

    // Prépare les paramètres communs à la volatilité et aux pics
    private creerParamsAnalyse(frequence: Frequence, fenetre: number, debut?: string, fin?: string): HttpParams {
        let params = new HttpParams()
            .set('frequence', frequence)
            .set('fenetre', fenetre);

        if (debut) {
            params = params.set('debut', debut);
        }

        if (fin) {
            params = params.set('fin', fin);
        }

        return params;
    }

    // Cherche les 5 derniers articles qui contiennent un texte
    rechercherActualites(texte?: string): Observable<Actualite[]> {
        let params = new HttpParams().set('ordering', '-date_publication');

        if (texte) {
            params = params.set('search', texte);
        }

        return this.http.get<Actualite[]>(this.actualitesUrl, { params }).pipe(map((articles) => articles.slice(0, 5)));
    }
}
