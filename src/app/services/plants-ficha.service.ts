import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface PlantsFicha {
  id?: number;
  user_id?: number;
  nombre: string;
  avenue: string;
  avenue_number: string;
  avenue_address: string;
  district: string;
  province: string;
  department: string;
  correo: string;
  email: string;
  image_path?: string;
  created_at?: string;
  updated_at?: string;
}

@Injectable({
  providedIn: 'root'
})
export class PlantsFichaService {
  private apiUrl = '/api';

  constructor(private http: HttpClient) { }

  getAllPlants(): Observable<PlantsFicha[]> {
    return this.http.get<PlantsFicha[]>(`${this.apiUrl}/plants-ficha`);
  }

  getPlant(id: number): Observable<PlantsFicha> {
    return this.http.get<PlantsFicha>(`${this.apiUrl}/plants-ficha/${id}`);
  }

  savePlant(plant: PlantsFicha): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/plants-ficha`, plant);
  }

  deletePlant(id: number): Observable<any> {
    return this.http.delete<any>(`${this.apiUrl}/plants-ficha/${id}`);
  }
}
