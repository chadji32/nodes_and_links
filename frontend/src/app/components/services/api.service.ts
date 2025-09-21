// src/app/services/api.service.ts
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { catchError, throwError } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private http = inject(HttpClient);
  // Base URL
  private base = 'http://localhost:3000/api';

  // GET /api/activity_properties

  getActivityProps() {
    return this.http.get(`${this.base}/activity_properties`).pipe(
      catchError(err => throwError(() => err))
    );
  }

  // GET /api/adjacency_matrix

  getAdjacencyMatrix() {
    return this.http.get(`${this.base}/adjacency_matrix`).pipe(
      catchError(err => throwError(() => err))
    );
  }

  // GET /api/pm_combined
  
  getPmCombined() {
    return this.http.get(`${this.base}/pm_combined`).pipe(
      catchError(err => throwError(() => err))
    );
  }
}
