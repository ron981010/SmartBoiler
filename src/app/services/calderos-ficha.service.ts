import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface CalderoFicha {
  id?: number;
  user_id?: number;
  plant_id: number;
  nombre: string;
  marca: string;
  tipo_caldero: string; // 'cilindrico_horizontal' | 'cilindrico_vertical' | 'apin'
  configuracion: string;
  combustible: string;
  capacidad_instalada: number;
  capacidad_unidad: string;
  presion_diseño: number;
  presion_unidad: string;
  imagen_path?: string;
  superficie: number;
  año: number;
  tratamiento_externo: string;
  tratamiento_interno: string;
  diametro_d?: number;
  longitud_l?: number;
  altura_h?: number;
  ancho_a?: number;
  created_at?: string;
  updated_at?: string;
}

@Injectable({
  providedIn: 'root'
})
export class CalderosService {
  private apiUrl = '/api';

  constructor(private http: HttpClient) { }

  getAllCalderos(): Observable<CalderoFicha[]> {
    return this.http.get<CalderoFicha[]>(`${this.apiUrl}/calderos-ficha`);
  }

  getCaldereosByPlant(plantId: number): Observable<CalderoFicha[]> {
    return this.http.get<CalderoFicha[]>(`${this.apiUrl}/calderos-ficha/plant/${plantId}`);
  }

  getCaldero(id: number): Observable<CalderoFicha> {
    return this.http.get<CalderoFicha>(`${this.apiUrl}/calderos-ficha/${id}`);
  }

  saveCaldero(caldero: CalderoFicha): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/calderos-ficha`, caldero);
  }

  deleteCaldero(id: number): Observable<any> {
    return this.http.delete<any>(`${this.apiUrl}/calderos-ficha/${id}`);
  }
}
