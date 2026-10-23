import { Component, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, FormsModule, NgForm, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { CheckboxModule } from 'primeng/checkbox';
import { InputTextModule } from 'primeng/inputtext';
import { PasswordModule } from 'primeng/password';
import { RippleModule } from 'primeng/ripple';
import { AppFloatingConfigurator } from '../../layout/component/app.floatingconfigurator';
import { ActifService } from '@/app/pages/service/service/actif-service';
import { apiErrorMessage } from '@/app/models/api-errors';
import { AuthService } from '@/app/pages/service/service/auth.service';
import { LoginPayload } from '@/app/models/auth.models';


const REMEMBERED_EMAIL_KEY = 'remembered_email';

@Component({
    selector: 'app-login',
    standalone: true,
    imports: [ButtonModule, CheckboxModule, InputTextModule, PasswordModule, FormsModule, RouterModule, RippleModule, ReactiveFormsModule],
    templateUrl: 'login.html'

})
export class Login implements OnInit {

    private readonly fb = inject(FormBuilder);
    private readonly authService = inject(AuthService);
    private readonly router = inject(Router);
    private readonly route = inject(ActivatedRoute);

    readonly loading = signal(false);
    readonly errorMessage = signal('');

    readonly loginForm = this.fb.nonNullable.group({
        email: ['', [Validators.required, Validators.email]],
        password: ['', Validators.required],
        rememberMe: [false]
    });

    ngOnInit(): void {
        const savedEmail = localStorage.getItem(REMEMBERED_EMAIL_KEY);

        if (savedEmail) {
            this.loginForm.patchValue({
                email: savedEmail,
                rememberMe: true
            });
        }
    }

    isInvalid(controlName: 'email' | 'password'): boolean {
        const control = this.loginForm.controls[controlName];

        return control.invalid &&
            (control.touched || control.dirty);
    }

    onSubmit(): void {
        this.errorMessage.set('');

        if (this.loginForm.invalid) {
            this.loginForm.markAllAsTouched();
            return;
        }

        this.loading.set(true);

        const values = this.loginForm.getRawValue();

        const payload: LoginPayload = {
            email: values.email,
            password: values.password
        };

        this.authService.login(payload).subscribe({
            next: () => {
                this.saveRememberedEmail(
                    values.email,
                    values.rememberMe
                );

                this.loading.set(false);

                const returnUrl =
                    this.route.snapshot.queryParamMap.get('returnUrl') || '/';

                void this.router.navigateByUrl(returnUrl);
            },
            error: (error) => {
                this.loading.set(false);
                this.errorMessage.set(apiErrorMessage(error));
            }
        });
    }

    private saveRememberedEmail(
        email: string,
        rememberMe: boolean
    ): void {
        if (rememberMe) {
            localStorage.setItem(REMEMBERED_EMAIL_KEY, email);
        } else {
            localStorage.removeItem(REMEMBERED_EMAIL_KEY);
        }
    }
}
