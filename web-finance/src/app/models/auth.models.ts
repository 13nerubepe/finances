/** Utilisateur renvoyé par l'API */
export interface User {
    id: number;
    first_name: string;
    last_name: string;
    email: string | null;
    phone: string;
    date_creation: string;

    two_factor_enabled: boolean;
}

/** Inscription */
export interface RegisterPayload {
    first_name: string;
    last_name: string;
    email: string;
    phone: string;
    password: string;
}

/** Connexion */
export interface LoginPayload {
    email: string;
    password: string;
}

/** Réponse de POST /api/auth/connexion/ */
export interface AccessToken {
    access?: string;
    refresh?: string;
    utilisateur?: User;

    // two_factor_required?: boolean;
    // token_2fa?: string;
}

/** Résultat de la première étape de connexion */
export interface LoginResult {
    deuxFacteursRequis: boolean;
    token2fa?: string;
}



/** Erreurs renvoyées par l'API */
export interface ApiError {
    detail?: string;
    code?: string;
    [field: string]: unknown;
}

/** Profil : même format que User*/
export type UserProfile = User;




/** Mise à jour du profil */
export interface UpdateProfilePayload {
    first_name: string;
    last_name: string;
    email: string;
    phone: string;
}

/** Changement de mot de passe */
export interface ChangePasswordPayload {
    current_password: string;
    new_password: string;
}

/** Configuration de la double authentification */
export interface TwoFactorSetupResponse {
    qr_code: string;
    secret: string;
}

/** Activation de la double authentification */
export interface TwoFactorEnableResponse {
    backup_codes: string[];
}









