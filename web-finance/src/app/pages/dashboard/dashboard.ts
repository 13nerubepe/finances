import { Component } from '@angular/core';
import { NotificationsWidget } from '@/app/commons/notificationswidget';
import { StatsWidget } from '@/app/commons/statswidget';
import { RecentSalesWidget } from '@/app/commons/recentsaleswidget';
import { BestSellingWidget } from '@/app/commons/bestsellingwidget';
import { RevenueStreamWidget } from '@/app/commons/revenuestreamwidget';
import { MarketEvolutionWidget } from '@/app/pages/commons/marketEvolution/market-evolution-widge';
import { PortofolioDistribution } from '@/app/pages/commons/portofolio-distribution/portofolio-distribution';
import { Topmoves } from '@/app/pages/commons/topmoves/topmoves';
import { ActualitesComponent } from '@/app/pages/commons/actualites/actualites';

@Component({
    selector: 'app-dashboard',
    imports: [StatsWidget, MarketEvolutionWidget, PortofolioDistribution, Topmoves, ActualitesComponent],
    styleUrl: './dashboard.scss',
    templateUrl: './dashboard.html'
    // template: `
    //     <div class="grid grid-cols-12 gap-8">
    //         <app-stats-widget class="contents" />
    //         <div class="col-span-12 xl:col-span-6">
    //             <app-recent-sales-widget />
    //             <app-best-selling-widget />
    //         </div>
    //         <div class="col-span-12 xl:col-span-6">
    //             <app-revenue-stream-widget />
    //             <app-notifications-widget />
    //         </div>
    //     </div>
    // `
})
export class Dashboard {}
