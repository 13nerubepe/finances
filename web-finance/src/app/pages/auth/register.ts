import { Component, inject, signal } from '@angular/core';
import {
    AbstractControl,
    FormBuilder,
    ReactiveFormsModule,
    ValidationErrors,
    ValidatorFn,
    Validators
} from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { switchMap } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { PasswordModule } from 'primeng/password';
import { SelectModule } from 'primeng/select';
import { ActifService } from '@/app/pages/service/service/actif-service';
import { apiErrorMessage } from '@/app/models/api-errors';
import { Checkbox } from 'primeng/checkbox';
import { AuthService } from '@/app/pages/service/service/auth.service';
import { RegisterPayload, UserProfile } from '@/app/models/auth.models';


/** Vérifie que « mot de passe » et « confirmation » sont identiques. */
const passwordsMatch: ValidatorFn = (group: AbstractControl): ValidationErrors | null => {
    const password = group.get('password')?.value;
    const confirm = group.get('confirm_password')?.value;

    return password && confirm && password !== confirm ? { passwordMismatch: true } : null;
};


@Component({
    selector: 'app-register',
    standalone: true,
    imports: [ReactiveFormsModule, RouterModule, ButtonModule, InputTextModule, PasswordModule, SelectModule, Checkbox],
    templateUrl: './register.html',
})
export class Register {
    private readonly fb = inject(FormBuilder);
    private readonly authService = inject(AuthService);
    private readonly router = inject(Router);

    readonly loading = signal(false);
    readonly errorMessage = signal('');
    readonly successMessage = signal('');

    readonly form = this.fb.nonNullable.group(
        {
            first_name: ['', Validators.required],
            last_name: ['', Validators.required],
            email: ['', [Validators.required, Validators.email]],
            phone: ['', Validators.required],
            password: [
                '',
                [
                    Validators.required,
                    Validators.minLength(8),
                    Validators.pattern(/^(?!\d+$).+$/)
                ]
            ],
            confirm_password: ['', Validators.required],
            acceptTerms: [false, Validators.requiredTrue]
        },
        { validators: passwordsMatch }
    );

    isInvalid(controlName: string): boolean {
        const control = this.form.get(controlName);

        return !!control &&
            control.invalid &&
            (control.touched || control.dirty);
    }

    passwordMismatch(): boolean {
        return this.form.hasError('passwordMismatch') &&
            !!this.form.get('confirm_password')?.touched;
    }

    onSubmit(): void {
        this.errorMessage.set('');
        this.successMessage.set('');

        if (this.form.invalid) {
            this.form.markAllAsTouched();
            return;
        }

        this.loading.set(true);

        const values = this.form.getRawValue();

        const payload: RegisterPayload = {
            first_name: values.first_name,
            last_name: values.last_name,
            email: values.email,
            phone: values.phone,
            password: values.password
        };

        this.authService.register(payload).subscribe({
            next: () => {
                this.loading.set(false);

                void this.router.navigateByUrl('/auth/login', {
                    state: {
                        message: 'Inscription réussie. Vous pouvez vous connecter.'
                    }
                });
            },
            error: (error) => {
                this.loading.set(false);
                this.errorMessage.set(apiErrorMessage(error));
            }
        });
    }

}
