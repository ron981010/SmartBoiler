import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject } from 'rxjs';
import { tap } from 'rxjs/operators';

export interface AuthResponse {
  token: string;
  user: {
    id: string;
    email: string;
    name: string;
  };
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface SignupRequest {
  email: string;
  password: string;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private apiUrl = '/api/auth';

  private isAuthenticatedSubject = new BehaviorSubject<boolean>(this.isTokenValid());
  public isAuthenticated$ = this.isAuthenticatedSubject.asObservable();

  private userSubject = new BehaviorSubject<any>(this.getUserFromStorage());
  public user$ = this.userSubject.asObservable();

  constructor(private http: HttpClient) {}

  /**
   * Login user with email and password
   */
  login(credentials: LoginRequest): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.apiUrl}/login`, credentials).pipe(
      tap(response => {
        this.saveToken(response.token);
        this.userSubject.next(response.user);
        this.isAuthenticatedSubject.next(true);
      })
    );
  }

  /**
   * Register new user
   */
  signup(credentials: SignupRequest): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.apiUrl}/signup`, credentials).pipe(
      tap(response => {
        this.saveToken(response.token);
        this.userSubject.next(response.user);
        this.isAuthenticatedSubject.next(true);
      })
    );
  }

  /**
   * Logout current user
   */
  logout(): void {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    this.isAuthenticatedSubject.next(false);
    this.userSubject.next(null);
  }

  /**
   * Get stored JWT token
   */
  getToken(): string | null {
    return localStorage.getItem('token');
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    return this.isTokenValid();
  }

  /**
   * Get current authenticated user
   */
  getCurrentUser(): any {
    return this.userSubject.value;
  }

  /**
   * Refresh token (for future implementation)
   */
  refreshToken(): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.apiUrl}/refresh`, {}).pipe(
      tap(response => this.saveToken(response.token))
    );
  }

  /**
   * Private helper: Save token to localStorage
   */
  private saveToken(token: string): void {
    localStorage.setItem('token', token);
  }

  /**
   * Private helper: Check if token is valid
   */
  private isTokenValid(): boolean {
    const token = localStorage.getItem('token');
    if (!token) return false;

    // TODO: Validate token expiration
    // For now, just check if token exists
    return true;
  }

  /**
   * Private helper: Get user from localStorage
   */
  private getUserFromStorage(): any {
    const userStr = localStorage.getItem('user');
    return userStr ? JSON.parse(userStr) : null;
  }
}
