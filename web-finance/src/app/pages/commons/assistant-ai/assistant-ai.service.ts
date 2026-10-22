import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

export interface AssistantReponse {
    reponse: string;
    sources?: string[];
}

@Injectable({ providedIn: 'root' })
export class AssistantIaService {
    private readonly http = inject(HttpClient);

    // TODO : adapter l'URL à ton backend
    private readonly url = '/api/assistant';

    poserQuestion(question: string): Observable<AssistantReponse> {
        return this.http.post<AssistantReponse>(this.url, { question });
    }

}
