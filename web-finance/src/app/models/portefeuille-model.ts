import type { Actif } from '@/app/models/actif-model';

/** Un actif dans un portefeuille. Seule la quantité peut être modifiée. */
export interface Position {
    symbole: string;
    nom: string;
    type_actif: Actif['type_actif'];
    quantite: number | null;
    date_ajout: string;
}

/** Réponse de GET /api/portefeuilles/ */
export interface Portefeuille {
    id: number;
    nom: string;
    description: string;
    devise: string;
    date_creation: string;
    nb_actifs: number;
}

/** Réponse de GET /api/portefeuilles/{id}/ */
export interface PortefeuilleDetail extends Portefeuille {
    actifs: Position[];
}

/** Corps de POST et PATCH /api/portefeuilles/ */
export interface PortefeuilleSaisie {
    nom: string;
    description?: string;
    devise?: string;
}
