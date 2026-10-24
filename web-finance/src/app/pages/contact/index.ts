import {Component} from '@angular/core';
import {ContactHeroWidget} from './components/contactherowidget';

@Component({
    selector: 'contact',
    standalone: true,
    imports: [ContactHeroWidget],
    template: `<contact-hero-widget />`
})
export class Contact {}
