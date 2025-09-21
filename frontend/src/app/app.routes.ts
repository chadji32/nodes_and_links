import { Routes } from '@angular/router';
import { LayoutComponent } from './layout/layout.component';
import { ChartsComponent } from './components/charts/charts.component';
import { ChartsResolver } from './components/charts/charts.resolver';
import { HomeComponent } from './components/home/home.component';

export const routes: Routes = [
    {
      path: '',
      component: LayoutComponent,
      children: [
        { path: '', pathMatch: 'full', component: HomeComponent },
        { path: 'charts', component: ChartsComponent, resolve: { data: ChartsResolver } }
      ]
    },
    { path: '**', redirectTo: '' }
  ];
  
