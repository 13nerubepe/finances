import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { Portefeuille, PortefeuilleDetail, PortefeuilleSaisie, Position } from '@/app/models/portefeuille-model';
import { environment } from '@/environments/environment';

@Injectable({
    providedIn: 'root'
})
export class PortefeuilleService {
    private http = inject(HttpClient);

    private portefeuillesUrl = `${environment.apiUrl.replace(/\/+$/, '')}/portefeuilles/`;

    // ---------- PORTEFEUILLES ----------

    // Récupère les portefeuilles de l'utilisateur connecté
    getPortefeuilles(): Observable<Portefeuille[]> {
        return this.http.get<Portefeuille[]>(this.portefeuillesUrl);
    }

    // Récupère un portefeuille avec ses actifs
    getPortefeuille(id: number): Observable<PortefeuilleDetail> {
        return this.http.get<PortefeuilleDetail>(`${this.portefeuillesUrl}${id}/`);
    }

    creerPortefeuille(saisie: PortefeuilleSaisie): Observable<Portefeuille> {
        return this.http.post<Portefeuille>(this.portefeuillesUrl, saisie);
    }

    modifierPortefeuille(id: number, saisie: Partial<PortefeuilleSaisie>): Observable<Portefeuille> {
        return this.http.patch<Portefeuille>(`${this.portefeuillesUrl}${id}/`, saisie);
    }

    supprimerPortefeuille(id: number): Observable<void> {
        return this.http.delete<void>(`${this.portefeuillesUrl}${id}/`);
    }

    // ---------- ACTIFS D'UN PORTEFEUILLE ----------

    // Ajoute un actif ; le backend importe ses cours s'il ne les a pas encore
    ajouterActif(id: number, symbole: string, quantite: number | null = null): Observable<Position> {
        return this.http.post<Position>(`${this.portefeuillesUrl}${id}/actifs/`, { symbole, quantite });
    }

    modifierQuantite(id: number, symbole: string, quantite: number | null): Observable<Position> {
        return this.http.patch<Position>(this.urlActif(id, symbole), { quantite });
    }

    retirerActif(id: number, symbole: string): Observable<void> {
        return this.http.delete<void>(this.urlActif(id, symbole));
    }

    private urlActif(id: number, symbole: string): string {
        return `${this.portefeuillesUrl}${id}/actifs/${encodeURIComponent(symbole)}/`;
    }
}
