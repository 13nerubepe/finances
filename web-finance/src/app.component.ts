import { Component, inject, OnInit } from '@angular/core';
import { RouterModule } from '@angular/router';
import { AuthService } from '@/app/pages/service/service/auth.service';

@Component({
    selector: 'app-root',
    standalone: true,
    imports: [RouterModule],
    template: `<router-outlet></router-outlet>`
})
export class AppComponent implements OnInit {
    private authService = inject(AuthService);

    ngOnInit(): void {
        this.authService.restoreSession().subscribe({
            next: (restored) => {
                console.log('Session restaurée :', restored);
            },
            error: (error) => {
                console.error('Erreur de restauration de session', error);
            }
        });
    }
}
