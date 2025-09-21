import { Routes } from "@angular/router";
import { ChartsComponent } from "../components/charts/charts.component";
import { ChartsResolver } from "../components/charts/charts.resolver";
import { LayoutComponent } from "./layout.component";

export const routes: Routes = [
    {
        path: 'charts', 
        component: ChartsComponent
    }
  ];