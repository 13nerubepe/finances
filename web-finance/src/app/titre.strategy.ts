import { Injectable, inject } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { RouterStateSnapshot, TitleStrategy } from '@angular/router';

export const NOM_APPLICATION = 'MEFA';
const TITRE_PAR_DEFAUT = `${NOM_APPLICATION} – Suivi et analyse des marchés financiers`;

@Injectable({ providedIn: 'root' })
export class TitreStrategy extends TitleStrategy {
    private readonly title = inject(Title);

    override updateTitle(etat: RouterStateSnapshot): void {
        const titre = this.buildTitle(etat);
        this.title.setTitle(titre ? `${titre} · ${NOM_APPLICATION}` : TITRE_PAR_DEFAUT);
    }
}
