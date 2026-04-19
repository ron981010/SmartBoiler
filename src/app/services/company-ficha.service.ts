import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface CompanyFicha {
  id?: number;
  user_id?: number;
  empresa: string;
  ciiu: string;
  ciiu_description: string;
  avenue: string;
  avenue_number: string;
  avenue_address: string;
  district: string;
  province: string;
  department: string;
  website: string;
  image_path?: string;
  created_at?: string;
  updated_at?: string;
}

@Injectable({
  providedIn: 'root'
})
export class CompanyFichaService {
  private apiUrl = '/api';

  constructor(private http: HttpClient) { }

  getCompanyFicha(): Observable<CompanyFicha> {
    return this.http.get<CompanyFicha>(`${this.apiUrl}/company-ficha`);
  }

  saveCompanyFicha(ficha: CompanyFicha): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/company-ficha`, ficha);
  }
}
