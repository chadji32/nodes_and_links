import { inject } from '@angular/core';
import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { catchError, throwError } from 'rxjs';
import { MessageService } from 'primeng/api';

// Intercepts HTTP errors
export const apiErrorInterceptor: HttpInterceptorFn = (req, next) => {

  const toast = inject(MessageService);

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 400) {
        toast.add({
          severity: 'error',
          summary: 'Something went wrong',
          detail: 'Please check your input and try again.',
          life: 6000,
        });
      } else if (error.error && error.error.code) {
        const code = String(error.error.code);
        const msg = error.error.message || 'Request failed';
        const details = Array.isArray(error.error.details) ? error.error.details : [];
        const extra = details
          .map((d: any) => d?.message || (typeof d === 'string' ? d : ''))
          .filter(Boolean)
          .join(' • ');

        toast.add({
          severity: 'error',
          summary: code.replace(/_/g, ' '),
          detail: extra ? `${msg} — ${extra}` : msg,
          life: 8000,
        });
      } else {
        toast.add({
          severity: 'error',
          summary: `Error ${error.status || ''}`.trim(),
          detail: error.message || 'Unexpected error',
          life: 6000,
        });
      }
      return throwError(() => error);
    })
  );
};
