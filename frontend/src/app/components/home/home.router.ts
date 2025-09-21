import { Routes } from "@angular/router";
import { ChartsComponent } from "../charts/charts.component";
import { LayoutComponent } from "../../layout/layout.component";

export const routes: Routes = [
    {
        path: 'charts', 
        component: ChartsComponent
    }
  ];