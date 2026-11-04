import { Component } from '@angular/core';

@Component({
    standalone: true,
    selector: 'app-footer',
    template: `<div class="layout-footer">
        <span class="font-bold text-primary">MEFA</span>
        <span class="text-muted-color">· Suivi et analyse des marchés financiers · © {{ annee }}</span>
    </div>`
})
export class AppFooter {
    readonly annee = new Date().getFullYear();
}
