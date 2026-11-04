import { Component } from '@angular/core';
import { StatsWidget } from '@/app/commons/statswidget';
import { MarketEvolutionWidget } from '@/app/pages/commons/marketEvolution/market-evolution-widge';
import { PortofolioDistribution } from '@/app/pages/commons/portofolio-distribution/portofolio-distribution';
import { Topmoves } from '@/app/pages/commons/topmoves/topmoves';
import { ActualitesComponent } from '@/app/pages/commons/actualites/actualites';

@Component({
    selector: 'app-dashboard',
    imports: [StatsWidget, MarketEvolutionWidget, PortofolioDistribution, Topmoves, ActualitesComponent],
    styleUrl: './dashboard.scss',
    templateUrl: './dashboard.html'
})
export class Dashboard {}
