/**
 * CONNEXION
 */
export interface User {
    id: string;
    email: string;
    first_name: string;
    last_name: string;
}

/**
 * INSCRIPTION
 */
export interface RegisterPayload {
    email: string;
    password: string;
    first_name?: string;
    last_name?: string;
    phone: string;
}

/**
 * Données envoyées lors de la connexion
 * */
export interface LoginPayload {
    email: string;
    password: string;
}


/**
 * Réponse d'authentification JWT
 */

export interface AccessToken {
    access: string;
    refresh?: string;
}

/**
 * Erreurs renvoyées par l'API
 * Error body returned by the API: `detail` + stable `code`, or per-field messages.
 * */
export interface ApiError {
    detail?: string;
    code?: string;
    [field: string]: unknown;
}

/** Informations du profil */
export interface UserProfile {
    full_name: string;
    email: string;
    phone: string | null;
    avatar_url: string | null;
    two_factor_enabled: boolean;
}

/** Mise à jour du profil */
export interface UpdateProfilePayload {
    full_name: string;
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









