import {CommonModule} from '@angular/common';
import {Component} from '@angular/core';
import {InputTextModule} from 'primeng/inputtext';
import {ButtonModule} from 'primeng/button';
import {FormsModule} from '@angular/forms';
import {TextareaModule} from 'primeng/textarea';
import {TranslatePipe} from '@ngx-translate/core';

@Component({
    selector: 'contact-hero-widget',
    standalone: true,
    imports: [CommonModule, InputTextModule, ButtonModule, FormsModule, TextareaModule,TranslatePipe],
    template: ` <section id="contact" class="animate-fadein animate-duration-300 animate-ease-in relative lg:pb-14 lg:pt-32 pt-36 pb-10 overflow-hidden">
        <div class="landing-container mx-auto relative z-10 px-12">



            <h1 class="text-4xl lg:text-6xl font-semibold text-[#22146C] text-center">{{'nousContacter'|translate}}</h1>
            <p class="mt-8 text-center lg:text-xl text-black dark:text-white/64 max-w-2xl mx-auto"> {{'weAre'|translate}}</p>
            <div class="relative mt-20 max-w-[54.5rem] mx-auto">
                <div
                    class="w-full h-full inset-0 bg-white/64 dark:bg-surface-800 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rotate-[4deg] lg:rotate-[7deg] backdrop-blur-[90px] rounded-3xl shadow-[0px_87px_24px_0px_rgba(120,149,206,0.00),0px_56px_22px_0px_rgba(120,149,206,0.01),0px_31px_19px_0px_rgba(120,149,206,0.03),0px_14px_14px_0px_rgba(120,149,206,0.04),0px_3px_8px_0px_rgba(120,149,206,0.06)] dark:shadow-sm"
                ></div>
                <div
                    class="w-full h-full inset-0 bg-white/64 dark:bg-surface-800 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 -rotate-[4deg] lg:-rotate-[7deg] backdrop-blur-[90px] rounded-3xl shadow-[0px_87px_24px_0px_rgba(120,149,206,0.00),0px_56px_22px_0px_rgba(120,149,206,0.01),0px_31px_19px_0px_rgba(120,149,206,0.03),0px_14px_14px_0px_rgba(120,149,206,0.04),0px_3px_8px_0px_rgba(120,149,206,0.06)] dark:shadow-sm"
                ></div>
                <form
                    class="space-y-8 p-8 relative z-10 bg-white/64 dark:bg-surface-800 backdrop-blur-[90px] rounded-3xl shadow-[0px_87px_24px_0px_rgba(120,149,206,0.00),0px_56px_22px_0px_rgba(120,149,206,0.01),0px_31px_19px_0px_rgba(120,149,206,0.03),0px_14px_14px_0px_rgba(120,149,206,0.04),0px_3px_8px_0px_rgba(120,149,206,0.06)] dark:shadow-sm"
                >
                    <div class="flex sm:flex-row flex-col gap-8">
                        <div class="flex flex-col gap-2 flex-1">
                            <label for="first_name" class="font-medium text-surface-500">{{'firstName'|translate}}</label>
                            <input name="first_name" pInputText id="first_name" [(ngModel)]="first_name" class="w-full" />
                        </div>
                        <div class="flex flex-col gap-2 flex-1">
                            <label for="last_name" class="font-medium text-surface-500">{{'lastName'|translate}}</label>
                            <input name="last_name" pInputText id="last_name" [(ngModel)]="last_name" class="w-full" />
                        </div>
                    </div>
                    <div class="flex flex-col gap-2">
                        <label for="email" class="font-medium text-surface-500">{{'emailAddress'|translate}}</label>
                        <input name="email" pInputText id="email" [(ngModel)]="email" class="w-full" />
                    </div>
                    <div class="flex flex-col gap-2">
                        <label for="phone" class="font-medium text-surface-500">{{'phoneNumber'|translate}}</label>
                        <input name="phone" pInputText id="phone" [(ngModel)]="phone" class="w-full" />
                    </div>
                    <div class="flex flex-col gap-2">
                        <label for="message" class="font-medium text-surface-500">{{'message'|translate}}</label>
                        <textarea name="message" pTextarea id="message" [(ngModel)]="message" rows="6" class="w-full !rounded-2xl"></textarea>
                    </div>
                    <button pButton class="w-full" rounded>{{'submit'|translate}}</button>
                </form>
            </div>
        </div>
    </section>`
})
export class ContactHeroWidget {
    first_name = '';

    last_name = '';

    email = '';

    phone = '';

    message = '';
}
