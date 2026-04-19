import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject } from 'rxjs';
import { tap } from 'rxjs/operators';

export interface Evaluation {
  id: string;
  userId: string;
  calderaId: string;
  fuelType: string;
  operationHours: number;
  dataJson: any;
  resultsSummary: any;
  createdAt: string;
  updatedAt: string;
}

export interface CreateEvaluationRequest {
  calderaId: string;
  fuelType: string;
  operationHours: number;
  dataJson: any;
}

export interface UpdateEvaluationRequest {
  resultsSummary?: any;
  dataJson?: any;
}

@Injectable({
  providedIn: 'root'
})
export class EvaluationService {
  private apiUrl = '/api/evaluations';

  private evaluationsSubject = new BehaviorSubject<Evaluation[]>([]);
  public evaluations$ = this.evaluationsSubject.asObservable();

  private currentEvaluationSubject = new BehaviorSubject<Evaluation | null>(null);
  public currentEvaluation$ = this.currentEvaluationSubject.asObservable();

  constructor(private http: HttpClient) {}

  /**
   * Get all evaluations for the current user
   */
  getAllEvaluations(): Observable<Evaluation[]> {
    return this.http.get<Evaluation[]>(`${this.apiUrl}`).pipe(
      tap(evaluations => this.evaluationsSubject.next(evaluations))
    );
  }

  /**
   * Get a specific evaluation by ID
   */
  getEvaluation(id: string): Observable<Evaluation> {
    return this.http.get<Evaluation>(`${this.apiUrl}/${id}`).pipe(
      tap(evaluation => this.currentEvaluationSubject.next(evaluation))
    );
  }

  /**
   * Create a new evaluation
   */
  createEvaluation(data: CreateEvaluationRequest): Observable<Evaluation> {
    return this.http.post<Evaluation>(`${this.apiUrl}`, data).pipe(
      tap(evaluation => {
        const current = this.evaluationsSubject.value;
        this.evaluationsSubject.next([...current, evaluation]);
      })
    );
  }

  /**
   * Update an existing evaluation
   */
  updateEvaluation(id: string, data: UpdateEvaluationRequest): Observable<Evaluation> {
    return this.http.put<Evaluation>(`${this.apiUrl}/${id}`, data).pipe(
      tap(updatedEvaluation => {
        const current = this.evaluationsSubject.value;
        const index = current.findIndex(e => e.id === id);
        if (index !== -1) {
          current[index] = updatedEvaluation;
          this.evaluationsSubject.next([...current]);
        }
      })
    );
  }

  /**
   * Delete an evaluation
   */
  deleteEvaluation(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`).pipe(
      tap(() => {
        const current = this.evaluationsSubject.value;
        this.evaluationsSubject.next(current.filter(e => e.id !== id));
      })
    );
  }

  /**
   * Get current loaded evaluation
   */
  getCurrentEvaluation(): Evaluation | null {
    return this.currentEvaluationSubject.value;
  }

  /**
   * Load local evaluations (for mock/testing)
   */
  loadMockEvaluations(): void {
    const mockEvaluations: Evaluation[] = [
      {
        id: '1',
        userId: 'user1',
        calderaId: '1',
        fuelType: 'Gas Natural Talara',
        operationHours: 8760,
        dataJson: {},
        resultsSummary: { efficiency: 0.85 },
        createdAt: '2024-10-15T10:00:00Z',
        updatedAt: '2024-10-15T10:00:00Z'
      }
    ];
    this.evaluationsSubject.next(mockEvaluations);
  }
}
