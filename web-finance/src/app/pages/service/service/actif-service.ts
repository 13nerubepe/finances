
import { Injectable, inject, signal } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, of, map, throwError } from 'rxjs';

import {
    Actif,
    ActifOption,
    Actualite,
    ActualiteResponse,
    AlerteRisque,
    AnalyseVolatiliteParams,
    FiltresCours,
    HistoricalPrice,
    IndicateursVolatilite,
    MatriceCorrelation,
    MessageAssistantIA,
    MouvementInhabituel,
    NouvelleTransaction,
    PointVolatilite,
    Portefeuille,
    PortfolioDistributionResponse,
    PositionPortefeuille,
    HistoriquePortefeuille,
    PerformancePortefeuille,
    RendementActif,
    ReponseAssistantIA,
    RequeteAssistantIA,
    ResultatAnalyseVolatilite,
    TopMoversResponse,
    Transaction
} from '@/app/models/actif-model';

import { User } from '@/app/models/auth.models';
import { environment } from '@/environments/environment';
import { TOP_MOVERS_MOCK } from '@/app/DATA/topmoves-mock.data';
import { ACTUALITES_MOCK } from '@/app/DATA/actualites-mock.data';
import { ACTIFS_MOCK, COURS_HISTORIQUES_MOCK } from '@/app/DATA/marche-mock.data.ts';
import { RESULTAT_ANALYSE_VOLATILITE_MOCK } from '@/app/DATA/volatile-mock.data';

@Injectable({
    providedIn: 'root'
})
export class ActifService {

    private readonly http = inject(HttpClient);

    readonly user = signal<User | null>(null);

    // Évite les doubles slashs dans les URL.
    private readonly apiUrl = environment.apiUrl.replace(/\/+$/, '');

    // Passe à false lorsque tu veux utiliser les API Django.
    private readonly useMockData = true;

    // URL des ressources
    private readonly actifsUrl = `${this.apiUrl}/actifs/`;
    private readonly coursUrl = `${this.apiUrl}/cours/`;
    private readonly volatiliteUrl = `${this.apiUrl}/volatilite/`;
    private readonly alertesUrl = `${this.apiUrl}/alertes/`;
    private readonly portefeuillesUrl = `${this.apiUrl}/portefeuilles/`;
    private readonly positionsUrl = `${this.apiUrl}/positions-portefeuille/`;
    private readonly transactionsUrl = `${this.apiUrl}/transactions/`;
    private readonly historiquePortefeuilleUrl =
        `${this.apiUrl}/historique-portefeuilles/`;
    private readonly performancesUrl =
        `${this.apiUrl}/performances-portefeuille/`;
    private readonly actualitesUrl = `${this.apiUrl}/actualites/`;
    private readonly assistantUrl = `${this.apiUrl}/assistant-ia/`;

    // =========================================================
    // 1. ACTIFS FINANCIERS
    // =========================================================

    getAssets(): Observable<Actif[]> {

        return of(ACTIFS_MOCK);

        // return this.http.get<Actif[]>(this.actifsUrl);
    }

    getAssetById(id: number): Observable<Actif> {
        // return this.http.get<Actif>(`${this.actifsUrl}${id}/`);

        const actif = ACTIFS_MOCK.find(
            (item) => item.actifId === id
        );

        if (!actif) {
            return throwError(() => new Error(`Actif ${id} introuvable`));
        }
        return of(actif);
    }

    getAssetBySymbol(symbol: string): Observable<Actif> {
        // const params = new HttpParams().set('symbol', symbol);
        //
        // return this.http.get<Actif>(
        //     `${this.actifsUrl}by-symbol/`,
        //     { params }
        // );

        const actif = ACTIFS_MOCK.find(
            item => item.symbol.toUpperCase() === symbol.toUpperCase()
        );

        if (!actif) {
            return throwError(
                () => new Error(`Aucun actif trouvé pour le symbole ${symbol}`)
            );
        }

        return of(actif);
    }

    rechercherActifs(recherche: string): Observable<Actif[]> {
        // const params = new HttpParams().set('search', recherche);
        //
        // return this.http.get<Actif[]>(
        //     this.actifsUrl,
        //     { params }
        // );

        if (this.useMockData) {
            const terme = recherche.trim().toLowerCase();

            const actifs = ACTIFS_MOCK.filter(actif =>
                actif.name.toLowerCase().includes(terme) ||
                actif.symbol.toLowerCase().includes(terme)
            );

            return of(actifs);
        }

        const params = new HttpParams().set('search', recherche);

        return this.http.get<Actif[]>(
            this.actifsUrl,
            { params }
        );
    }

    actualiserActif(symbol: string): Observable<Actif> {
        // return this.http.post<Actif>(
        //     `${this.actifsUrl}actualiser/`,
        //     { symbol }
        // );

        if (this.useMockData) {
            const actif = ACTIFS_MOCK.find(
                item => item.symbol.toUpperCase() === symbol.toUpperCase()
            );

            if (!actif) {
                return throwError(
                    () => new Error(`Aucun actif trouvé pour le symbole ${symbol}`)
                );
            }

            // Retourne l'actif simulé sans modifier les données originales.
            return of({ ...actif });
        }

        return this.http.post<Actif>(
            `${this.actifsUrl}actualiser/`,
            { symbol }
        );
    }

    // =========================================================
    // 2. COURS HISTORIQUES
    // =========================================================

    getAssetHistory(filtres: FiltresCours): Observable<HistoricalPrice[]> {
        // let params = new HttpParams()
        //     .set('actifId', filtres.actifId)
        //     .set('dateDebut', filtres.dateDebut)
        //     .set('dateFin', filtres.dateFin);
        //
        // if (filtres.frequence) {
        //     params = params.set('frequence', filtres.frequence);
        // }
        //
        // return this.http.get<HistoricalPrice[]>(
        //     `${this.coursUrl}historique/`,
        //     { params }
        // );

        if (this.useMockData) {
            const historique = COURS_HISTORIQUES_MOCK[filtres.actifId] ?? [];

            const dateDebut = filtres.dateDebut.substring(0, 10);
            const dateFin = filtres.dateFin.substring(0, 10);

            const resultats = historique.filter(cours => {
                const dateCours = cours.date.substring(0, 10);

                return dateCours >= dateDebut && dateCours <= dateFin;
            });

            return of(resultats);
        }

        let params = new HttpParams()
            .set('actifId', filtres.actifId.toString())
            .set('dateDebut', filtres.dateDebut)
            .set('dateFin', filtres.dateFin);

        if (filtres.frequence) {
            params = params.set('frequence', filtres.frequence);
        }

        return this.http.get<HistoricalPrice[]>(
            `${this.coursUrl}historique/`,
            { params }
        );
    }

    getCoursById(id: number): Observable<HistoricalPrice> {
        // return this.http.get<HistoricalPrice>(
        //     `${this.coursUrl}${id}/`
        // );

        if (this.useMockData) {
            const cours = Object.values(COURS_HISTORIQUES_MOCK)
                .flat()
                .find(item => item.id === id);

            if (!cours) {
                return throwError(
                    () => new Error(`Cours avec l'identifiant ${id} introuvable`)
                );
            }

            return of(cours);
        }

        return this.http.get<HistoricalPrice>(
            `${this.coursUrl}${id}/`
        );
    }

    synchroniserCours(actifId: number): Observable<HistoricalPrice[]> {
        // return this.http.post<HistoricalPrice[]>(
        //     `${this.coursUrl}synchroniser/`,
        //     { actifId }
        // );

        if (this.useMockData) {
            const historique = COURS_HISTORIQUES_MOCK[actifId] ?? [];

            if (historique.length === 0) {
                return throwError(
                    () => new Error(
                        `Aucun historique disponible pour l'actif ${actifId}`
                    )
                );
            }

            // Retourne une copie des cours simulés.
            return of([...historique]);
        }

        return this.http.post<HistoricalPrice[]>(
            `${this.coursUrl}synchroniser/`,
            { actifId }
        );
    }

    // =========================================================
    // 3. ANALYSE DE VOLATILITÉ
    // =========================================================

    analyser(
        params: AnalyseVolatiliteParams): Observable<ResultatAnalyseVolatilite> {
        // return this.http.post<ResultatAnalyseVolatilite>(
        //     `${this.volatiliteUrl}analyse/`,
        //     params
        // );

        if (this.useMockData) {
            return of(RESULTAT_ANALYSE_VOLATILITE_MOCK);
        }

        return this.http.post<ResultatAnalyseVolatilite>(
            `${this.volatiliteUrl}analyse/`,
            params
        );
    }

    getAnalyse(params: AnalyseVolatiliteParams): Observable<ResultatAnalyseVolatilite> {
        // let httpParams = new HttpParams()
        //     .set('actifs', params.actifs.join(','))
        //     .set('periode', params.periode);
        //
        // if (params.frequence) {
        //     httpParams = httpParams.set(
        //         'frequence',
        //         params.frequence
        //     );
        // }
        //
        // return this.http.get<ResultatAnalyseVolatilite>(
        //     `${this.volatiliteUrl}analyse/`,
        //     { params: httpParams }
        // );

        if (this.useMockData) {
            return of(RESULTAT_ANALYSE_VOLATILITE_MOCK);
        }

        let httpParams = new HttpParams()
            .set('actifs', params.actifs.join(','))
            .set('periode', params.periode.toString());

        if (params.frequence) {
            httpParams = httpParams.set(
                'frequence',
                params.frequence
            );
        }

        return this.http.get<ResultatAnalyseVolatilite>(
            `${this.volatiliteUrl}analyse/`,
            { params: httpParams }
        );
    }

    analyserVolatilite(
        params: AnalyseVolatiliteParams
    ): Observable<ResultatAnalyseVolatilite> {
        return this.http.post<ResultatAnalyseVolatilite>(
            `${this.volatiliteUrl}analyse/`,
            {
                actifs: params.actifs,
                periode: params.periode,
                frequence: params.frequence ?? 'daily'
            }
        );
    }

    getActifsDisponibles(): Observable<ActifOption[]> {
        return this.http.get<ActifOption[]>(
            `${this.volatiliteUrl}actifs/`
        );
    }

    getVolatiliteGlissante(
        symbol: string,
        fenetre = 20,
        frequence: 'daily' | 'weekly' | 'monthly' = 'daily'
    ): Observable<PointVolatilite[]> {
        const params = new HttpParams()
            .set('symbol', symbol)
            .set('fenetre', fenetre)
            .set('frequence', frequence);

        return this.http.get<PointVolatilite[]>(
            `${this.volatiliteUrl}glissante/`,
            { params }
        );
    }

    getIndicateurs(
        symbol: string,
        periode = 30
    ): Observable<IndicateursVolatilite> {
        const params = new HttpParams()
            .set('symbol', symbol)
            .set('periode', periode);

        return this.http.get<IndicateursVolatilite>(
            `${this.volatiliteUrl}indicateurs/`,
            { params }
        );
    }

    // =========================================================
    // 4. RENDEMENTS, CORRÉLATIONS ET COVARIANCES
    // =========================================================

    getRendements(
        symboles: string[],
        dateDebut: string,
        dateFin: string
    ): Observable<RendementActif[]> {
        const params = new HttpParams()
            .set('symboles', symboles.join(','))
            .set('dateDebut', dateDebut)
            .set('dateFin', dateFin);

        return this.http.get<RendementActif[]>(
            `${this.volatiliteUrl}rendements/`,
            { params }
        );
    }

    calculerRendements(
        symboles: string[],
        periode: number
    ): Observable<RendementActif[]> {
        return this.http.post<RendementActif[]>(
            `${this.volatiliteUrl}rendements/calculer/`,
            { symboles, periode }
        );
    }

    getMatrice(
        symboles: string[],
        periode = 30
    ): Observable<MatriceCorrelation> {
        return this.http.post<MatriceCorrelation>(
            `${this.volatiliteUrl}matrice/`,
            {
                actifs: symboles,
                periode
            }
        );
    }

    getCorrelations(
        symboles: string[],
        periode = 30
    ): Observable<ResultatAnalyseVolatilite['correlations']> {
        return this.http.post<
            ResultatAnalyseVolatilite['correlations']
        >(
            `${this.volatiliteUrl}correlations/`,
            {
                actifs: symboles,
                periode
            }
        );
    }

    // =========================================================
    // 5. MOUVEMENTS INHABITUELS
    // =========================================================

    getMouvements(
        symbol?: string,
        dateDebut?: string,
        dateFin?: string
    ): Observable<MouvementInhabituel[]> {
        let params = new HttpParams();

        if (symbol) {
            params = params.set('symbol', symbol);
        }

        if (dateDebut) {
            params = params.set('dateDebut', dateDebut);
        }

        if (dateFin) {
            params = params.set('dateFin', dateFin);
        }

        return this.http.get<MouvementInhabituel[]>(
            `${this.volatiliteUrl}mouvements-inhabituels/`,
            { params }
        );
    }

    detecter(
        symboles: string[],
        seuilVariation = 3
    ): Observable<MouvementInhabituel[]> {
        return this.http.post<MouvementInhabituel[]>(
            `${this.volatiliteUrl}detecter/`,
            {
                symboles,
                seuilVariation
            }
        );
    }

    // =========================================================
    // 6. ALERTES DE RISQUE
    // =========================================================

    getAlertes(
        symbol?: string,
        niveau?: AlerteRisque['niveau']
    ): Observable<AlerteRisque[]> {
        let params = new HttpParams();

        if (symbol) {
            params = params.set('symbol', symbol);
        }

        if (niveau) {
            params = params.set('niveau', niveau);
        }

        return this.http.get<AlerteRisque[]>(
            this.alertesUrl,
            { params }
        );
    }

    creerAlerte(
        alerte: Omit<AlerteRisque, 'date'>
    ): Observable<AlerteRisque> {
        return this.http.post<AlerteRisque>(
            this.alertesUrl,
            alerte
        );
    }

    supprimerAlerte(id: number): Observable<void> {
        return this.http.delete<void>(
            `${this.alertesUrl}${id}/`
        );
    }

    // =========================================================
    // 7. PORTEFEUILLES
    // =========================================================

    getPortefeuilles(): Observable<Portefeuille[]> {
        return this.http.get<Portefeuille[]>(
            this.portefeuillesUrl
        );
    }

    getPortefeuille(id: number): Observable<Portefeuille> {
        return this.http.get<Portefeuille>(
            `${this.portefeuillesUrl}${id}/`
        );
    }

    creerPortefeuille(
        data: Pick<Portefeuille, 'nom' | 'devise'>
    ): Observable<Portefeuille> {
        return this.http.post<Portefeuille>(
            this.portefeuillesUrl,
            data
        );
    }

    modifierPortefeuille(
        id: number,
        data: Partial<Portefeuille>
    ): Observable<Portefeuille> {
        return this.http.patch<Portefeuille>(
            `${this.portefeuillesUrl}${id}/`,
            data
        );
    }

    supprimerPortefeuille(id: number): Observable<void> {
        return this.http.delete<void>(
            `${this.portefeuillesUrl}${id}/`
        );
    }

    // =========================================================
    // 8. POSITIONS DE PORTEFEUILLE
    // =========================================================

    getPositions(
        portefeuilleId: number
    ): Observable<PositionPortefeuille[]> {
        const params = new HttpParams()
            .set('portefeuilleId', portefeuilleId);

        return this.http.get<PositionPortefeuille[]>(
            this.positionsUrl,
            { params }
        );
    }

    getPosition(id: number): Observable<PositionPortefeuille> {
        return this.http.get<PositionPortefeuille>(
            `${this.positionsUrl}${id}/`
        );
    }

    ajouterPosition(
        data: Pick<
            PositionPortefeuille,
            'portefeuilleId' | 'actifId' | 'quantite' | 'prixAchat'
        >
    ): Observable<PositionPortefeuille> {
        return this.http.post<PositionPortefeuille>(
            this.positionsUrl,
            data
        );
    }

    modifierPosition(
        id: number,
        data: Partial<PositionPortefeuille>
    ): Observable<PositionPortefeuille> {
        return this.http.patch<PositionPortefeuille>(
            `${this.positionsUrl}${id}/`,
            data
        );
    }

    supprimerPosition(id: number): Observable<void> {
        return this.http.delete<void>(
            `${this.positionsUrl}${id}/`
        );
    }

    // =========================================================
    // 9. TRANSACTIONS
    // =========================================================

    getTransactions(
        portefeuilleId: number,
        dateDebut?: string,
        dateFin?: string
    ): Observable<Transaction[]> {
        let params = new HttpParams()
            .set('portefeuilleId', portefeuilleId);

        if (dateDebut) {
            params = params.set('dateDebut', dateDebut);
        }

        if (dateFin) {
            params = params.set('dateFin', dateFin);
        }

        return this.http.get<Transaction[]>(
            this.transactionsUrl,
            { params }
        );
    }

    getTransaction(id: number): Observable<Transaction> {
        return this.http.get<Transaction>(
            `${this.transactionsUrl}${id}/`
        );
    }

    creerTransaction(
        data: NouvelleTransaction
    ): Observable<Transaction> {
        return this.http.post<Transaction>(
            this.transactionsUrl,
            data
        );
    }

    supprimerTransaction(id: number): Observable<void> {
        return this.http.delete<void>(
            `${this.transactionsUrl}${id}/`
        );
    }

    // =========================================================
    // 10. HISTORIQUE DU PORTEFEUILLE
    // =========================================================

    getHistoriquePortefeuille(
        portefeuilleId: number,
        dateDebut?: string,
        dateFin?: string
    ): Observable<HistoriquePortefeuille[]> {
        let params = new HttpParams()
            .set('portefeuilleId', portefeuilleId);

        if (dateDebut) {
            params = params.set('dateDebut', dateDebut);
        }

        if (dateFin) {
            params = params.set('dateFin', dateFin);
        }

        return this.http.get<HistoriquePortefeuille[]>(
            this.historiquePortefeuilleUrl,
            { params }
        );
    }

    enregistrerPoint(
        data: Omit<HistoriquePortefeuille, 'historiqueId'>
    ): Observable<HistoriquePortefeuille> {
        return this.http.post<HistoriquePortefeuille>(
            this.historiquePortefeuilleUrl,
            data
        );
    }

    // =========================================================
    // 11. PERFORMANCE DU PORTEFEUILLE
    // =========================================================

    getPerformance(
        portefeuilleId: number,
        dateDebut: string,
        dateFin: string
    ): Observable<PerformancePortefeuille> {
        const params = new HttpParams()
            .set('portefeuilleId', portefeuilleId)
            .set('dateDebut', dateDebut)
            .set('dateFin', dateFin);

        return this.http.get<PerformancePortefeuille>(
            this.performancesUrl,
            { params }
        );
    }

    recalculer(
        portefeuilleId: number,
        dateDebut: string,
        dateFin: string
    ): Observable<PerformancePortefeuille> {
        return this.http.post<PerformancePortefeuille>(
            `${this.performancesUrl}calculer/`,
            {
                portefeuilleId,
                dateDebut,
                dateFin
            }
        );
    }

    // =========================================================
    // 12. ACTUALITÉS FINANCIÈRES
    // Une seule méthode getActualites()
    // =========================================================

    getActualites(
        categorie = 'Toutes',
        recherche = ''
    ): Observable<Actualite[]> {
        if (this.useMockData) {
            let resultats = [...ACTUALITES_MOCK];

            if (categorie !== 'Toutes') {
                resultats = resultats.filter(
                    actualite => actualite.categorie === categorie
                );
            }

            if (recherche.trim()) {
                const terme = recherche.trim().toLowerCase();

                resultats = resultats.filter(actualite =>
                    actualite.titre.toLowerCase().includes(terme) ||
                    actualite.resume.toLowerCase().includes(terme) ||
                    actualite.contenu.toLowerCase().includes(terme)
                );
            }

            return of(resultats);
        }

        let params = new HttpParams();

        if (categorie !== 'Toutes') {
            params = params.set('categorie', categorie);
        }

        if (recherche.trim()) {
            params = params.set('search', recherche.trim());
        }

        return this.http.get<Actualite[] | ActualiteResponse>(
            this.actualitesUrl,
            { params }
        ).pipe(
            map(response =>
                Array.isArray(response)
                    ? response
                    : response.results
            )
        );
    }

    getActualiteById(id: number): Observable<Actualite> {
        return this.http.get<Actualite>(
            `${this.actualitesUrl}${id}/`
        );
    }

    rechercherActualites(
        recherche: string,
        categorie?: string
    ): Observable<Actualite[]> {
        return this.getActualites(
            categorie || 'Toutes',
            recherche
        );
    }

    actualiserFluxRSS(): Observable<{
        message: string;
        count?: number;
    }> {
        return this.http.post<{
            message: string;
            count?: number;
        }>(
            `${this.actualitesUrl}actualiser-rss/`,
            {}
        );
    }

    // =========================================================
    // 13. ASSISTANT IA
    // =========================================================

    envoyerMessage(
        requete: RequeteAssistantIA
    ): Observable<ReponseAssistantIA> {
        return this.http.post<ReponseAssistantIA>(
            `${this.assistantUrl}question/`,
            requete
        );
    }

    getHistorique(): Observable<MessageAssistantIA[]> {
        return this.http.get<MessageAssistantIA[]>(
            `${this.assistantUrl}historique/`
        );
    }

    supprimerHistorique(): Observable<void> {
        return this.http.delete<void>(
            `${this.assistantUrl}historique/`
        );
    }

    supprimerMessage(id: number): Observable<void> {
        return this.http.delete<void>(
            `${this.assistantUrl}historique/${id}/`
        );
    }

    // =========================================================
    // 14. DONNÉES DU TABLEAU DE BORD
    // =========================================================

    // getPortfolioDistribution(): Observable<PortfolioDistributionResponse> {
    //     // return this.http.get<PortfolioDistributionResponse>(
    //     //     `${this.portefeuillesUrl}repartition/`
    //     // );
    //     return of(PORTFOLIO_DISTRIBUTION_MOCK);
    // }

    getTopMovers(): Observable<TopMoversResponse> {
        if (this.useMockData) {
            return of(TOP_MOVERS_MOCK as TopMoversResponse);
        }

        return this.http.get<TopMoversResponse>(
            `${this.apiUrl}/marche/top-movers/`
        );
    }
}
