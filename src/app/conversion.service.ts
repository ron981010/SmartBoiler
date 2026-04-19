import { Injectable } from '@angular/core';

export type Combustible = 'Gas Natural Talara' | 'Gas Natural Camisea' | 'GLP' | 'Diesel' | 'P.I.6' | 'P.I.500';

@Injectable({ providedIn: 'root' })
export class ConversionService {
  // Factores de conversión por COMBUSTIBLE y RÓTULO a US$/106 Btu
  // Estructura: combustible -> rótulo -> factor
  // Factores precisos según tabla de energía
  private conversionFactors: Record<Combustible, Record<string, number>> = {
    'Gas Natural Talara': {
      'US$/Sft3': 976.6326,
      'US$/Nm3': 26.1612,
      'US$/106 Btu': 1.0
    },
    'Gas Natural Camisea': {
      'US$/Sft3': 972.8469,
      'US$/Nm3': 26.0598,
      'US$/106 Btu': 1.0
    },
    'GLP': {
      'US$/l': 38.5175,
      'US$/kg': 21.5698,
      'US$/t': 0.0216,
      'US$/gal': 10.1764,
      'US$/Bbl': 0.2423,
      'US$/106 Btu': 1.0
    },
    'Diesel': {
      'US$/gal': 30.2194,
      'US$/l': 114.3804,
      'US$/Bbl': 0.7195,
      'US$/106 Btu': 1.0
    },
    'P.I.6': {
      'US$/gal': 27.8813,
      'US$/l': 105.5305,
      'US$/Bbl': 0.6638,
      'US$/106 Btu': 1.0
    },
    'P.I.500': {
      'US$/gal': 27.6109,
      'US$/l': 104.5072,
      'US$/Bbl': 0.6574,
      'US$/106 Btu': 1.0
    }
  };

  // Densidades y vol->mass helpers (valores aproximados)
  private densities = {
    gas_kg_per_m3: 0.8,    // kg/m3 (aprox para gas natural a NTP)
    liquid_kg_per_m3: 850  // kg/m3 (aprox hidrocarburo)
  };

  // Pressure conversion factors to psi
  private pressureToPsi: Record<string, number> = {
    'Psi g': 1,
    'kg/cm2 g': 14.2233433,
    'atm g': 14.6959488,
    'Bar g': 14.5037738,
    'MPa g': 145.0377377
  };

  // Temperature conversions
  fToC(valueF: number) {
    return (valueF - 32) * (5 / 9);
  }

  cToC(valueC: number) {
    return valueC;
  }

  // Price: input price (number), combustible, unit -> return price in US$/106 Btu
  // Logic: price * factor = US$/106 Btu
  priceToPerMMBtu(price: number, combustible: Combustible, unit: string) {
    const factors = this.conversionFactors[combustible];
    if (!factors) return NaN;
    const factor = factors[unit];
    if (factor === undefined) return NaN;
    return price * factor;
  }

  // Factores de conversión de consumo por combustible a kg/h
  private consumptionFactors: Record<Combustible, Record<string, number>> = {
    'Gas Natural Talara': {
      'kg/h': 1.0,
      'Nm3/h': 0.837,
      'Sft3/h': 0.022
    },
    'Gas Natural Camisea': {
      'kg/h': 1.0,
      'Nm3/h': 0.837,
      'Sft3/h': 0.022
    },
    'GLP': {
      'gal/h': 2.1196,
      'l/h': 0.5600,
      'kg/h': 1.0
    },
    'Diesel': {
      'kg/h': 1.0,
      'gal/h': 3.2551,
      'l/h': 0.86
    },
    'P.I.6': {
      'kg/h': 1.0,
      'gal/h': 3.6715,
      'l/h': 0.9700
    },
    'P.I.500': {
      'kg/h': 1.0,
      'gal/h': 3.7093,
      'l/h': 0.98
    }
  };

  // Consumption: convert flows to kg/h según combustible
  consumptionToKgPerH(value: number, unit: string, combustible: Combustible) {
    const factors = this.consumptionFactors[combustible];
    if (!factors) return NaN;
    const factor = factors[unit];
    if (factor === undefined) return NaN;
    return value * factor;
  }

  // Pressure to Psi g
  pressureToPsiG(value: number, unit: string) {
    const factor = this.pressureToPsi[unit];
    if (factor === undefined) return NaN;
    return value * factor;
  }

  // Temperature to Celsius
  temperatureToC(value: number, unit: string) {
    if (unit === '°F') return this.fToC(value);
    return this.cToC(value);
  }
}
