// src/app/resolvers/charts.resolver.ts
import { Injectable } from '@angular/core';
import { Resolve } from '@angular/router';
import { Observable, forkJoin } from 'rxjs';
import { ApiService } from '../services/api.service';

@Injectable({
  providedIn: 'root',
})
export class ChartsResolver implements Resolve<any> {
  constructor(private api: ApiService) {}

  resolve(): Observable<any> {
    return forkJoin({
      activities: this.api.getActivityProps(),
      adjacency: this.api.getAdjacencyMatrix(),
      combined: this.api.getPmCombined(),
    });
  }
}
