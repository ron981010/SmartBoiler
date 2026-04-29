import { Component, OnInit, ViewChild, AfterViewChecked, OnDestroy, Renderer2 } from '@angular/core';
import { FormControl, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { ConversionService, Combustible } from '../conversion.service';
import { EvaluationService } from '../services/evaluation.service';
import { CalderosService } from '../services/calderos-ficha.service';
import { CompanyFichaService } from '../services/company-ficha.service';
import { PlantsFichaService } from '../services/plants-ficha.service';
import * as ApexCharts from 'apexcharts';

export type ChartOptions = ApexCharts.ApexOptions;
type ResultsUnitSystem = 'USB' | 'LKS' | 'SI';
type ResultsQuantity = 'temp_c' | 'mass_flow' | 'energy_flow' | 'energy_specific' | 'emission_factor' | 'annual_mass' | 'cost_mass';

interface FieldConfig {
  id: string;
  label: string;
  icon: string;
  valueControl: FormControl<number | null>;
  unitControl: FormControl<string | null>;
  standardValue: number | null;
  standardUnitLabel: string;
  unitOptions: string[];
}

@Component({
  selector: 'app-energy-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule],
  templateUrl: './energy-form.component.html',
  styleUrls: ['./energy-form.component.css']
})
export class EnergyFormComponent implements OnInit, AfterViewChecked, OnDestroy {
  private readonly DEFAULT_OPERATION_HOURS = 7920;
  private readonly DEFAULT_COST_VALUES = [8.0, 3.0, 2.0, 1.3, 1.0, 6.0, 78.7];

  fields: FieldConfig[] = [];
  selectedCombustible: FormControl<Combustible | null> = new FormControl<Combustible | null>('Diesel');
  combustibles: Combustible[] = ['Gas Natural Talara', 'Gas Natural Camisea', 'GLP', 'Diesel', 'P.I.6', 'P.I.500'];

  operationTimeControl = new FormControl<number | null>(this.DEFAULT_OPERATION_HOURS);

  currentScreen = 1;
  showMeasurementInfo = false;

  // When evaluation finishes switch to results section
  evaluationMode = false;
  showCharts = false;
  efiChartView: 1 | 2 = 1;
  emiChartView: 1 | 2 = 1;

  // Saving state
  savingEvaluation = false;
  saveError: string | null = null;

  // Lista de calderas para la pantalla de registro (solo una puede estar seleccionada)
  // "Caldera Example" es la caldera de prueba con los valores del flujo verificado
  private readonly CALDERA_EXAMPLE = {
    id: 0,
    name: 'Caldera Example',
    img: 'assets/caldera.png',
    selected: true,
    // Valores de proceso verificados
    I2: 49896, I3: 300,
    combustible: 'Diesel' as Combustible,
    I9: 1739.3, I9Unit: 'kg/h',
    I10: 32, I10Unit: '°C',
    I11: 30, I11Unit: '°C',
    I12: 50,
    I13: 1.78,
    I14: 120, I14Unit: '°C',
    I15: 3.6, I16: 402.6,
    I17: 200, I17Unit: 'Psi g',
    I18: 250, I18Unit: '°C',
    I19: 7, I20: 350,
    I21: 262.8, I21Unit: '°C',
    I22: 3, vaporType: 'saturado',
    I23: 43, I23Unit: '°C',
    I24: 53, I24Unit: '°C',
    I25: 61, I25Unit: '°C',
    I26: 60, I26Unit: '°C',
    I4H: 3.6, I5H: 5,
    I35: 7.5
  };

  calderas: Array<{id:number; name:string; img:string; selected:boolean}> = [];
  companyName = '';
  plants: Array<{id: number; nombre: string}> = [];
  selectedPlantId: number | null = null;
  searchQuery = '';
  private allCalderasDB: any[] = [];

  // Datos de las pantallas 2, 3 y 4
  dataFields = {
    I2: 49896,
    I3: 300,
    I9: 1739.3,
    I9Unit: 'kg/h',
    I10: 32,
    I10Unit: '°C',
    I11: 30,
    I11Unit: '°C',
    I12: 50,
    I13: 1.78,
    I35: 7.5,
    I14: 120,
    I14Unit: '°C',
    I15: 3.6,
    I16: 402.6,
    I17: 200,
    I17Unit: 'Psi g',
    I18: 250,
    I18Unit: '°C',
    I19: 7,
    I20: 350,
    I21: 262.8,
    I21Unit: '°C',
    I22: 3,
    vaporType: 'saturado',
    I23: 43,
    I23Unit: '°C',
    I24: 53,
    I24Unit: '°C',
    I25: 61,
    I25Unit: '°C',
    I26: 60,
    I26Unit: '°C',
    I4H: 3.6,
    I5H: 5
  };

  // cost screen data
  costEditable = false;
  costItems: Array<{ label: string; value: number | null }> = [
    { label: 'Mano de Obra', value: 8.0 },
    { label: 'Electricidad', value: 3.0 },
    { label: 'Agua', value: 2.0 },
    { label: 'Purgas', value: 1.3 },
    { label: 'Quimicos', value: 1.0 },
    { label: 'Depreciación', value: 6.0 },
    { label: 'Energía', value: 78.7 }
  ];


  getCostTotal(): number {
    return this.costItems.reduce((sum, item) => sum + (item.value || 0), 0);
  }

  // Opciones para Índice Bacharach
  bacharachOptions: number[] = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

  currentDate = {
    day: '',
    month: '',
    year: '',
    hour: ''
  };

  // Rótulos disponibles por combustible para I35 (Precio)
  rotolosPrecio: Record<Combustible, string[]> = {
    'Gas Natural Talara': ['US$/Sft3', 'US$/Nm3', 'US$/106 Btu'],
    'Gas Natural Camisea': ['US$/Sft3', 'US$/Nm3', 'US$/106 Btu'],
    'GLP': ['US$/l', 'US$/kg', 'US$/t', 'US$/gal', 'US$/Bbl', 'US$/106 Btu'],
    'Diesel': ['US$/gal', 'US$/l', 'US$/Bbl', 'US$/106 Btu'],
    'P.I.6': ['US$/gal', 'US$/l', 'US$/Bbl', 'US$/106 Btu'],
    'P.I.500': ['US$/gal', 'US$/l', 'US$/Bbl', 'US$/106 Btu']
  };

  // Rótulos disponibles por combustible para I9 (Consumo)
  rotulosConsumo: Record<Combustible, string[]> = {
    'Gas Natural Talara': ['kg/h', 'Nm3/h', 'Sft3/h'],
    'Gas Natural Camisea': ['kg/h', 'Nm3/h', 'Sft3/h'],
    'GLP': ['gal/h', 'l/h', 'kg/h'],
    'Diesel': ['kg/h', 'gal/h', 'l/h'],
    'P.I.6': ['kg/h', 'gal/h', 'l/h'],
    'P.I.500': ['kg/h', 'gal/h', 'l/h']
  };

  evaluationResults: any = null;
  resultsUnitSystem: ResultsUnitSystem = 'USB';
  activeResultsTab: string = 'COM';
  tabsList: string[] = ['COM', 'PRO', 'EFI', 'BMS', 'BEN', 'EMI'];

  private efiGauge: any | null = null;
  private excesoAireGauge: any | null = null;
  private factorCargaGauge: any | null = null;
  private bmsChart: any | null = null;
  // ... (rest of chart setup)


  constructor(
    private conv: ConversionService,
    private evaluationService: EvaluationService,
    private calderosService: CalderosService,
    private companyService: CompanyFichaService,
    private plantService: PlantsFichaService,
    private router: Router,
    private renderer: Renderer2
  ) { }

  // Keep references to elements we port to document.body so we can clean up
  private _portedNavEl: HTMLElement | null = null;
  private _portedContinueEl: HTMLElement | null = null;

  ngOnInit(): void {
    const now = new Date();
    this.currentDate = {
      day: String(now.getDate()).padStart(2, '0'),
      month: String(now.getMonth() + 1).padStart(2, '0'),
      year: String(now.getFullYear()),
      hour: String(now.getHours()).padStart(2, '0')
    };

    // Cargar nombre de empresa y plantas del usuario
    this.companyService.getCompanyFicha().subscribe({ next: (c) => this.companyName = c.empresa || '', error: () => {} });
    this.plantService.getAllPlants().subscribe({ next: (ps) => this.plants = ps.map(p => ({ id: p.id!, nombre: p.nombre })), error: () => {} });

    // Cargar calderas desde la DB (+ siempre mostrar Caldera Example primero)
    this.calderas = [{ ...this.CALDERA_EXAMPLE, selected: true }];
    this.calderosService.getAllCalderos().subscribe({
      next: (dbCalderas) => {
        const fromDb = dbCalderas.map(c => ({
          id: c.id!,
          name: c.nombre || `Caldero #${c.id}`,
          img: c.imagen_path ? `/uploads/${c.imagen_path}` : 'assets/caldera.png',
          selected: false,
          // campos de diseño del caldero
          _dbData: c
        }));
        this.allCalderasDB = fromDb;
        this.calderas = [
          { ...this.CALDERA_EXAMPLE, selected: true },
          ...fromDb
        ];
      },
      error: () => {
        // Si falla la carga (ej: no autenticado aún), mante solo Caldera Example
        this.calderas = [{ ...this.CALDERA_EXAMPLE, selected: true }];
      }
    });

    const precioField: FieldConfig = {
      id: 'I35',
      label: 'Precio',
      icon: '💲',
      valueControl: new FormControl<number | null>(7.5),
      unitControl: new FormControl<string | null>('US$/106 Btu'),
      standardValue: null,
      standardUnitLabel: 'US$/106 Btu',
      unitOptions: this.rotolosPrecio['Diesel']
    };

    const consumoField: FieldConfig = {
      id: 'I9',
      label: 'Consumo',
      icon: '🔥',
      valueControl: new FormControl<number | null>(1739.3),
      unitControl: new FormControl<string | null>('kg/h'),
      standardValue: null,
      standardUnitLabel: 'kg/h',
      unitOptions: this.rotulosConsumo['Diesel']
    };

    this.fields = [
      precioField,
      consumoField,
      {
        id: 'I17',
        label: 'Presión',
        icon: '⚙',
        valueControl: new FormControl<number | null>(200),
        unitControl: new FormControl<string | null>('Psi g'),
        standardValue: null,
        standardUnitLabel: 'Psi g',
        unitOptions: ['Psi g', 'kg/cm2 g', 'atm g', 'Bar g', 'MPa g']
      },
      {
        id: 'I10',
        label: 'Temperatura',
        icon: '🌡',
        valueControl: new FormControl<number | null>(32),
        unitControl: new FormControl<string | null>('°C'),
        standardValue: null,
        standardUnitLabel: '°C',
        unitOptions: ['°C', '°F']
      }
    ];

    // Pre-rellenar dataFields con Caldera Example (fields ya inicializados)
    this.applyCalderaDefaults(this.CALDERA_EXAMPLE);

    // Subscribe to combustible changes para actualizar rótulos en I35 y I9
    this.selectedCombustible.valueChanges.subscribe((comb) => {
      if (comb) {
        // Actualizar rótulos de Precio (I35)
        const opcionesPrecio = this.rotolosPrecio[comb];
        precioField.unitOptions = opcionesPrecio;
        if (!opcionesPrecio.includes(precioField.unitControl.value || '')) {
          precioField.unitControl.setValue(opcionesPrecio[0]);
        }
        this.updateFieldStandard(precioField);

        // Actualizar rótulos de Consumo (I9)
        const opcionesConsumo = this.rotulosConsumo[comb];
        consumoField.unitOptions = opcionesConsumo;
        if (!opcionesConsumo.includes(consumoField.unitControl.value || '')) {
          consumoField.unitControl.setValue(opcionesConsumo[0]);
          this.dataFields.I9Unit = opcionesConsumo[0];
        }
        this.updateFieldStandard(consumoField);
      }
    });

    // Subscribe to changes for each field
    this.fields.forEach(field => {
      field.valueControl.valueChanges.subscribe(() => this.updateFieldStandard(field));
      field.unitControl.valueChanges.subscribe(() => this.updateFieldStandard(field));
    });
  }

  ngAfterViewChecked(): void {
    // Port the currently visible navigation buttons to document.body so
    // `position: fixed` anchors to the viewport even when route animations
    // apply CSS transforms to intermediate ancestors.
    try {
      const nav = document.querySelector('.navigation-buttons') as HTMLElement | null;
      if (nav && nav !== this._portedNavEl) {
        // Append the live element to body (keeps Angular listeners intact)
        document.body.appendChild(nav);
        this._portedNavEl = nav;
      }

      const cont = document.querySelector('.continue-wrap') as HTMLElement | null;
      if (cont && cont !== this._portedContinueEl) {
        document.body.appendChild(cont);
        this._portedContinueEl = cont;
      }
    } catch (e) {
      // ignore DOM timing errors
      // console.warn('EnergyForm porting error', e);
    }
  }

  ngOnDestroy(): void {
    // No need to restore elements — they are destroyed with the component.
    this._portedNavEl = null;
    this._portedContinueEl = null;
  }

  updateFieldStandard(field: FieldConfig) {
    const val = field.valueControl.value;
    const unit = field.unitControl.value;
    if (val === null || val === undefined || unit === null) {
      field.standardValue = null;
      return;
    }

    const comb = this.selectedCombustible.value;
    if (!comb) return;

    switch (field.id) {
      case 'I35':
        field.standardValue = this.conv.priceToPerMMBtu(+val, comb, unit);
        break;
      case 'I9':
        field.standardValue = this.conv.consumptionToKgPerH(+val, unit, comb);
        break;
      case 'I17':
        field.standardValue = this.conv.pressureToPsiG(+val, unit);
        break;
      default:
        // Temperature
        field.standardValue = this.conv.temperatureToC(+val, unit);
        break;
    }
  }

  formatNumber(value: number | null, digits = 3) {
    if (value === null || isNaN(value)) return '-';
    return value.toLocaleString(undefined, { maximumFractionDigits: digits });
  }

  clearCurrentScreen() {
    switch (this.currentScreen) {
      case 2:
        this.clearScreen2Fields();
        break;
      case 3:
        this.clearScreen3Fields();
        break;
      case 4:
        this.clearScreen4Fields();
        break;
      case 5:
        this.clearScreen5Fields();
        break;
      case 6:
        this.clearScreen6Fields();
        break;
      default:
        break;
    }
  }

  private clearScreen2Fields() {
    // Combustible / Aire
    this.fields.find(f => f.id === 'I35')?.valueControl.setValue(null);
    this.fields.find(f => f.id === 'I9')?.valueControl.setValue(null);
    this.fields.find(f => f.id === 'I10')?.valueControl.setValue(null);

    this.dataFields.I35 = null as any;
    this.dataFields.I9 = null as any;
    this.dataFields.I10 = null as any;
    this.dataFields.I11 = null as any;
    this.dataFields.I12 = null as any;
    this.dataFields.I13 = null as any;
  }

  private clearScreen3Fields() {
    // Agua / Vapor
    this.fields.find(f => f.id === 'I17')?.valueControl.setValue(null);

    this.dataFields.I14 = null as any;
    this.dataFields.I15 = null as any;
    this.dataFields.I16 = null as any;
    this.dataFields.I17 = null as any;
    this.dataFields.I18 = null as any;
    this.dataFields.vaporType = 'saturado';
  }

  private clearScreen4Fields() {
    // Costo
    this.costEditable = false;
    this.costItems.forEach(i => i.value = null);
  }

  private clearScreen5Fields() {
    // Gases
    this.dataFields.I19 = null as any;
    this.dataFields.I20 = null as any;
    this.dataFields.I21 = null as any;
    this.dataFields.I22 = null as any;
  }

  private clearScreen6Fields() {
    // Temperatura de paredes
    this.dataFields.I23 = null as any;
    this.dataFields.I24 = null as any;
    this.dataFields.I25 = null as any;
    this.dataFields.I26 = null as any;
  }

  // Rellena dataFields con los valores de Caldera Example
  private applyCalderaDefaults(ex: typeof this.CALDERA_EXAMPLE) {
    this.operationTimeControl.setValue(this.DEFAULT_OPERATION_HOURS);
    this.dataFields.I2 = ex.I2;
    this.dataFields.I3 = ex.I3;
    this.dataFields.I9 = ex.I9;
    this.dataFields.I9Unit = ex.I9Unit;
    this.dataFields.I10 = ex.I10;
    this.dataFields.I10Unit = ex.I10Unit;
    this.dataFields.I11 = ex.I11;
    this.dataFields.I11Unit = ex.I11Unit;
    this.dataFields.I12 = ex.I12;
    this.dataFields.I13 = ex.I13;
    this.dataFields.I14 = ex.I14;
    this.dataFields.I14Unit = ex.I14Unit;
    this.dataFields.I15 = ex.I15;
    this.dataFields.I16 = ex.I16;
    this.dataFields.I17 = ex.I17;
    this.dataFields.I17Unit = ex.I17Unit;
    this.dataFields.I18 = ex.I18;
    this.dataFields.I18Unit = ex.I18Unit;
    this.dataFields.I19 = ex.I19;
    this.dataFields.I20 = ex.I20;
    this.dataFields.I21 = ex.I21;
    this.dataFields.I21Unit = ex.I21Unit;
    this.dataFields.I22 = ex.I22;
    this.dataFields.I23 = ex.I23;
    this.dataFields.I23Unit = ex.I23Unit;
    this.dataFields.I24 = ex.I24;
    this.dataFields.I24Unit = ex.I24Unit;
    this.dataFields.I25 = ex.I25;
    this.dataFields.I25Unit = ex.I25Unit;
    this.dataFields.I26 = ex.I26;
    this.dataFields.I26Unit = ex.I26Unit;
    this.dataFields.I4H = ex.I4H;
    this.dataFields.I5H = ex.I5H;
    this.dataFields.I35 = ex.I35;
    this.dataFields.vaporType = ex.vaporType ?? 'saturado';

    this.costEditable = false;
    this.costItems.forEach((i, idx) => i.value = this.DEFAULT_COST_VALUES[idx] || null);

    // Campos de proceso
    const setField = (id: string, val: number | null, unit?: string) => {
      const f = this.fields.find(f => f.id === id);
      if (!f) return;
      f.valueControl.setValue(val);
      if (unit && f.unitControl) f.unitControl.setValue(unit);
    };
    setField('I9',  ex.I9,  ex.I9Unit);
    setField('I10', ex.I10, ex.I10Unit);
    setField('I11', ex.I11, ex.I11Unit);
    setField('I12', ex.I12);
    setField('I13', ex.I13);
    setField('I14', ex.I14, ex.I14Unit);
    setField('I15', ex.I15);
    setField('I16', ex.I16);
    setField('I17', ex.I17, ex.I17Unit);
    setField('I18', ex.I18, ex.I18Unit);
    setField('I19', ex.I19);
    setField('I20', ex.I20);
    setField('I21', ex.I21, ex.I21Unit);
    setField('I22', ex.I22);
    setField('I23', ex.I23, ex.I23Unit);
    setField('I24', ex.I24, ex.I24Unit);
    setField('I25', ex.I25, ex.I25Unit);
    setField('I26', ex.I26, ex.I26Unit);
    setField('I35', ex.I35);
    this.selectedCombustible.setValue(ex.combustible);
  }

  // Limpia todos los campos de proceso (para calderos de la DB)
  private clearProcessFields() {
    this.operationTimeControl.setValue(null);
    this.fields.forEach(f => f.valueControl.setValue(null));
    this.selectedCombustible.setValue(null);
    this.dataFields.I2 = null as any;
    this.dataFields.I3 = null as any;
    this.dataFields.I9 = null as any;
    this.dataFields.I10 = null as any;
    this.dataFields.I11 = null as any;
    this.dataFields.I12 = null as any;
    this.dataFields.I13 = null as any;
    this.dataFields.I14 = null as any;
    this.dataFields.I15 = null as any;
    this.dataFields.I16 = null as any;
    this.dataFields.I17 = null as any;
    this.dataFields.I18 = null as any;
    this.dataFields.I19 = null as any;
    this.dataFields.I20 = null as any;
    this.dataFields.I21 = null as any;
    this.dataFields.I22 = null as any;
    this.dataFields.I23 = null as any;
    this.dataFields.I24 = null as any;
    this.dataFields.I25 = null as any;
    this.dataFields.I26 = null as any;
    this.dataFields.I35 = null as any;
    this.dataFields.I4H = null as any;
    this.dataFields.I5H = null as any;
    this.dataFields.vaporType = 'saturado';
    this.costEditable = false;
    this.costItems.forEach(i => i.value = null);
  }

  // Selección única: al seleccionar una caldera, deselecciona las demás y pre-rellena datos
  toggleCalderaSelection(id: number) {
    this.calderas.forEach(c => (c as any).selected = ((c as any).id === id));
    if (id === 0) {
      // Caldera Example → valores de prueba verificados
      this.applyCalderaDefaults(this.CALDERA_EXAMPLE);
    } else {
      // Caldero de la DB: limpiar form y rellenar solo con datos de la ficha
      this.clearProcessFields();
      const selected = (this.calderas.find(c => (c as any).id === id) as any)?._dbData;
      if (selected) {
        if (selected.capacidad_instalada != null) this.dataFields.I2 = selected.capacidad_instalada;
        if (selected.superficie != null)          this.dataFields.I3 = selected.superficie;
        const combMap: Record<string, Combustible> = {
          'Diesel': 'Diesel', 'GLP': 'GLP',
          'Gas Natural': 'Gas Natural Camisea',
          'Gas Natural Camisea': 'Gas Natural Camisea'
        };
        const comb = combMap[selected.combustible];
        if (comb) this.selectedCombustible.setValue(comb);
      }
    }
  }

  // navigate to a specific screen number
  goToScreen(n: number) {
    if (n >= 1 && n <= 8) {
      this.currentScreen = n;
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  // helper para mostrar nombre de caldera actualmente seleccionada
  get selectedCalderaName(): string {
    const c = this.calderas.find(x => x.selected);
    return c ? c.name : '';
  }

  get filteredCalderas() {
    const q = this.searchQuery.trim().toLowerCase();
    const list = this.selectedPlantId
      ? this.calderas.filter(c => (c as any).id === 0 || (c as any)._dbData?.plant_id === this.selectedPlantId)
      : this.calderas;
    if (!q) return list;
    return list.filter(c => c.name.toLowerCase().includes(q));
  }

  toggleMeasurementInfo() {
    this.showMeasurementInfo = !this.showMeasurementInfo;
  }

  closeMeasurementInfo() {
    this.showMeasurementInfo = false;
  }

  calculateStandard(value: number | null, unit: string | null, fieldId: string): number | null {
    if (value === null || value === undefined || unit === null) {
      return null;
    }

    const comb = this.selectedCombustible.value;
    if (!comb) return null;

    switch (fieldId) {
      case 'I9':
        return this.conv.consumptionToKgPerH(+value, unit, comb);
      case 'I10':
      case 'I11':
      case 'I14':
      case 'I18':
      case 'I21':
      case 'I23':
      case 'I24':
      case 'I25':
      case 'I26':
        return this.conv.temperatureToC(+value, unit);
      case 'I17':
        return this.conv.pressureToPsiG(+value, unit);
      default:
        return null;
    }
  }

  nextScreen() {
    if (this.evaluationMode) {
      // no navigation once evaluation section is active
      return;
    }
    if (this.currentScreen < 8) {
      this.currentScreen++;
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  prevScreen() {
    if (this.evaluationMode) {
      return;
    }
    if (this.currentScreen > 1) {
      this.currentScreen--;
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  async evaluateData() {
    // ── Validar campos requeridos ────────────────────────────────────────────
    const I35_v = this.fields.find(f => f.id === 'I35')?.valueControl.value;
    const I9_v  = this.fields.find(f => f.id === 'I9')?.valueControl.value;
    const I17_v = this.fields.find(f => f.id === 'I17')?.valueControl.value;
    const I10_v = this.fields.find(f => f.id === 'I10')?.valueControl.value;

    const requiredChecks = [
      { val: I9_v ?? this.dataFields.I9, name: 'Consumo (I9)' },
      { val: I17_v ?? this.dataFields.I17, name: 'Presión (I17)' },
      { val: I10_v ?? this.dataFields.I10, name: 'Temperatura ambiente (I10)' },
      { val: this.dataFields.I19, name: 'CO₂ (I19)' },
      { val: this.dataFields.I20, name: 'Temperatura de gases (I20)' },
      { val: this.dataFields.I21, name: 'Temperatura de gases 2 (I21)' },
    ];
    const missing = requiredChecks.filter(c => c.val === null || c.val === undefined || c.val === 0);
    if (missing.length > 0) {
      alert('Por favor rellene los campos requeridos:\n' + missing.map(m => '• ' + m.name).join('\n'));
      return;
    }

    // ── Mapear nombre del selector Angular → nombre esperado por el backend ─
    const combMap: Record<string, string> = {
      'Gas Natural Camisea': 'Gas Natural (Camisea)',
      'Gas Natural Talara':  'Gas Natural (Talara)',
      'GLP':    'GLP',
      'Diesel': 'Diesel',
      'P.I.6':  'P.I. 6',
      'P.I.500':'P.I. 500',
    };
    const tipoComb  = combMap[this.selectedCombustible.value ?? 'GLP'] ?? 'GLP';
    const tipoVapor = this.dataFields.vaporType === 'sobrecalentado' ? 'Sobrecalentado' : 'Saturado';

    // ── Construir payload de inputs ─────────────────────────────────────────
    const payload = {
      tipo_combustible: tipoComb,
      tipo_vapor:       tipoVapor,
      I9:  Number(I9_v ?? this.dataFields.I9)  || 0,
      I10: Number(I10_v ?? this.dataFields.I10) || 0,
      I11: Number(this.dataFields.I11) || 0,
      I12: Number(this.dataFields.I12) || 0,
      I13: Number(this.dataFields.I13) || 0,
      I14: Number(this.dataFields.I14) || 0,
      I15: Number(this.dataFields.I15) || 1,
      I16: Number(this.dataFields.I16) || 2,
      I17: Number(I17_v ?? this.dataFields.I17) || 0,
      I18: Number(this.dataFields.I18) || 0,
      I19: Number(this.dataFields.I19) || 0,
      I20: Number(this.dataFields.I20) || 0,
      I21: Number(this.dataFields.I21) || 0,
      I22: Number(this.dataFields.I22) ?? 0,
      I23: Number(this.dataFields.I23) || 0,
      I24: Number(this.dataFields.I24) || 0,
      I25: Number(this.dataFields.I25) || 0,
      I26: Number(this.dataFields.I26) || 0,
      I2:  Number(this.dataFields.I2)  || 49896,
      I3:  Number(this.dataFields.I3)  || 300,
      I4H: Number(this.dataFields.I4H) || 3.6,
      I5H: Number(this.dataFields.I5H) || 5,
      I35: Number(I35_v ?? this.dataFields.I35) || 0,
      I36: Number(this.operationTimeControl.value) || 7920,
      I37: this.costItems[0]?.value ?? 0,
      I38: this.costItems[1]?.value ?? 0,
      I39: this.costItems[2]?.value ?? 0,
      I40: this.costItems[3]?.value ?? 0,
      I41: this.costItems[4]?.value ?? 0,
      I42: this.costItems[5]?.value ?? 0,
    };

    // ── Llamar al backend Node.js ───────────────────────────────────────────
    let r: any;
    try {
      const token = localStorage.getItem('token');
      const resp = await fetch('/api/calcular', {
        method:  'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload),
      });
      if (!resp.ok) {
        const err = await resp.json();
        console.error('Backend error:', err);
        alert('Error en el cálculo: ' + (err.error ?? 'ver consola'));
        return;
      }
      const data = await resp.json();
      r = data.resultados;
    } catch (e) {
      console.error('No se pudo conectar al backend:', e);
      alert('No se pudo conectar al backend.\n\nAsegúrate de que esté corriendo:\n  node backend/server.js');
      return;
    }

    // ── Helpers de formato ──────────────────────────────────────────────────
    const fmt  = (v: number) => v === 777 ? '777' : v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const pct  = (v: number, t: number) => t > 0 ? (v / t * 100).toFixed(2) : '0.00';
    const tot  = (t: number) => t > 0 ? '100.00' : '0.00';

    const R14  = r.R34 !== 0 ? r.R34 : 1;
    const pctU = r.R35 / R14 * 100;
    const pctC = r.R36 / R14 * 100;
    const pctS = r.R37 / R14 * 100;
    const pctG = r.R38 / R14 * 100;
    const pctR = r.R39 !== 777 ? r.R39 / R14 * 100 : 777;
    const pctP = r.R40 / R14 * 100;

    // ── Guardar resultados ──────────────────────────────────────────────────
    this.evaluationResults = {
      com: {
        R1A: r.R1A,
        R1B: r.R1B,
        R1C: r.R1C,
        R2A: r.R2A,
        R2B: r.R2B,
        R2C: r.R2C,
        R3:  r.R3,
      },
      combustion: {
        excesoAire:                  r.R1B,
        gradoConversionCombustible:  r.R2A,
        eficienciaCombustion:        +pctU.toFixed(1),
      },
      carga: {
        factorCarga:      r.R4,
        factorEvaporacion: r.R5,
        produccionVapor:  r.R19,
      },
      ratios: {
        consumoEnergiaVapor:       r.R6A,
        produccionVaporSuperficie: r.R6B,
        costoVapor:                r.R7,
      },
      eficiencia: {
        calorUtil:          { btu: fmt(r.R35), percent: +pctU.toFixed(1) },
        perdidasChimenea:   { btu: fmt(r.R36), percent: +pctC.toFixed(1) },
        perdidasInquemados: { btu: fmt(r.R37), percent: +pctS.toFixed(1) },
        perdidasInquemadosGas: { btu: fmt(r.R38), percent: +pctG.toFixed(1) },
        perdidasRC:         { btu: r.R39 !== 777 ? fmt(r.R39) : '777', percent: pctR !== 777 ? +pctR.toFixed(1) : 777 },
        perdidasPurgas:     { btu: fmt(r.R40), percent: +pctP.toFixed(1) },
        total:              { btu: fmt(r.R41), percent: 100 },
      },
      bms: {
        entradas: {
          combustible:      { val: fmt(r.R15), percent: pct(r.R15, r.R18) },
          aguaAlimentacion: { val: fmt(r.R16), percent: pct(r.R16, r.R18) },
          aireCombustion:   { val: fmt(r.R17), percent: pct(r.R17, r.R18) },
          total:            { val: fmt(r.R18), percent: tot(r.R18) },
        },
        salidas: {
          produccionVapor: { val: fmt(r.R19), percent: pct(r.R19, r.R28) },
          purgasAgua:      { val: fmt(r.R20), percent: pct(r.R20, r.R28) },
          co2:             { val: fmt(r.R21), percent: pct(r.R21, r.R28) },
          co:              { val: fmt(r.R22), percent: pct(r.R22, r.R28) },
          o2:              { val: fmt(r.R23), percent: pct(r.R23, r.R28) },
          n2:              { val: fmt(r.R24), percent: pct(r.R24, r.R28) },
          h2o:             { val: fmt(r.R25), percent: pct(r.R25, r.R28) },
          so2:             { val: fmt(r.R26), percent: pct(r.R26, r.R28) },
          hollin:          { val: fmt(r.R27), percent: pct(r.R27, r.R28) },
          total:           { val: fmt(r.R28), percent: tot(r.R28) },
        },
      },
      ben: {
        entradas: {
          R29: { val: fmt(r.R29), percent: pct(r.R29, r.R34) },
          R30: { val: fmt(r.R30), percent: pct(r.R30, r.R34) },
          R31: { val: fmt(r.R31), percent: pct(r.R31, r.R34) },
          R32: { val: fmt(r.R32), percent: pct(r.R32, r.R34) },
          R33: { val: fmt(r.R33), percent: pct(r.R33, r.R34) },
          R34: { val: fmt(r.R34), percent: tot(r.R34) },
        },
        salidas: {
          R35: { val: fmt(r.R35), percent: pct(r.R35, r.R41) },
          R36: { val: fmt(r.R36), percent: pct(r.R36, r.R41) },
          R37: { val: fmt(r.R37), percent: pct(r.R37, r.R41) },
          R38: { val: fmt(r.R38), percent: pct(r.R38, r.R41) },
          R39: { val: r.R39 !== 777 ? fmt(r.R39) : '777', percent: r.R39 !== 777 ? pct(r.R39, r.R41) : '777' },
          R40: { val: fmt(r.R40), percent: pct(r.R40, r.R41) },
          R41: { val: fmt(r.R41), percent: tot(r.R41) },
        },
      },
      emi: {
        R42: r.R42, R43: r.R43, R44: r.R44, R45: r.R45,
        R46: r.R46, R47: r.R47, R48: r.R48, R49: r.R49,
        R50: r.R50,
      },
      graficoEficiencia: +pctU.toFixed(1),
    };

    console.log('evaluationResults (backend):', this.evaluationResults);

    // switch to results section and show first (detailed) view
    this.evaluationMode = true;
    this.showCharts = false;
    this.currentScreen = 1;

    // initialize charts so they are ready when the user opens the charts view
    setTimeout(() => {
      this.setupCharts();
    }, 0);
  }

  toggleCharts() {
    this.showCharts = !this.showCharts;
    if (this.showCharts) {
      this.efiChartView = 1;
      this.emiChartView = 1;
    }
  }

  goToNextChartView() {
    if (this.activeResultsTab === 'EFI') {
      this.efiChartView = 2;
    } else if (this.activeResultsTab === 'EMI') {
      this.emiChartView = 2;
    }
  }

  handleChartsBack() {
    if (this.activeResultsTab === 'EFI' && this.efiChartView === 2) {
      this.efiChartView = 1;
      return;
    }
    if (this.activeResultsTab === 'EMI' && this.emiChartView === 2) {
      this.emiChartView = 1;
      return;
    }

    this.toggleCharts();
  }

  getEmiCO2Comb(): string {
    const bms = this.evaluationResults?.bms;
    if (!bms) return '0';
    const co2 = this.parseNumeric(bms.salidas.co2?.val) || 0;
    const comb = this.parseNumeric(bms.entradas.combustible?.val) || 1;
    return (co2 / comb).toFixed(3);
  }

  getEmiSO2Comb(): string {
    const bms = this.evaluationResults?.bms;
    if (!bms) return '0';
    const so2 = this.parseNumeric(bms.salidas.so2?.val) || 0;
    const comb = this.parseNumeric(bms.entradas.combustible?.val) || 1;
    return (so2 / comb).toFixed(3);
  }

  getEmiCO2Vapor(): string {
    const bms = this.evaluationResults?.bms;
    if (!bms) return '0';
    const co2 = this.parseNumeric(bms.salidas.co2?.val) || 0;
    const vapor = this.parseNumeric(bms.salidas.produccionVapor?.val) || 1;
    return (co2 / vapor).toFixed(3);
  }

  getEmiSO2Vapor(): string {
    const bms = this.evaluationResults?.bms;
    if (!bms) return '0';
    const so2 = this.parseNumeric(bms.salidas.so2?.val) || 0;
    const vapor = this.parseNumeric(bms.salidas.produccionVapor?.val) || 1;
    return (so2 / vapor).toFixed(3);
  }

  getSankeyInquemados(): number {
    if (!this.evaluationResults?.eficiencia) return 0;
    const e = this.evaluationResults.eficiencia;
    const inq = (e.perdidasInquemados?.percent || 0)
              + (e.perdidasInquemadosGas?.percent || 0)
              + (e.perdidasPurgas?.percent || 0);
    return +inq.toFixed(1);
  }

  private getEfiPiePercents(): { util: number; chimenea: number; rc: number; inq: number } {
    if (!this.evaluationResults?.eficiencia) return { util: 0, chimenea: 0, rc: 0, inq: 0 };
    const e = this.evaluationResults.eficiencia;
    return {
      util: e.calorUtil?.percent || 0,
      chimenea: e.perdidasChimenea?.percent || 0,
      rc: e.perdidasRC?.percent === 777 ? 0 : (e.perdidasRC?.percent || 0),
      inq: this.getSankeyInquemados()
    };
  }

  getEfiPieSegment(type: 'util' | 'chimenea' | 'rc' | 'inq'): string {
    const circ = 2 * Math.PI * 50; // ~314.16
    const p = this.getEfiPiePercents();
    const pct = p[type];
    const len = (pct / 100) * circ;
    return `${len} ${circ}`;
  }

  getEfiPieOffset(type: 'chimenea' | 'rc' | 'inq'): string {
    const circ = 2 * Math.PI * 50;
    const p = this.getEfiPiePercents();
    let cumulative = 0;
    if (type === 'chimenea') cumulative = p.util;
    else if (type === 'rc') cumulative = p.util + p.chimenea;
    else cumulative = p.util + p.chimenea + p.rc;
    return `${-(cumulative / 100) * circ}`;
  }

  setResultsUnitSystem(system: ResultsUnitSystem) {
    this.resultsUnitSystem = system;
  }

  isResultsUnitSystem(system: ResultsUnitSystem): boolean {
    return this.resultsUnitSystem === system;
  }

  getResultsUnit(quantity: ResultsQuantity, baseUnit: string): string {
    if (this.resultsUnitSystem === 'USB') {
      return baseUnit;
    }

    if (this.resultsUnitSystem === 'LKS') {
      switch (quantity) {
        case 'temp_c': return '°C';
        case 'mass_flow': return 't/h';
        case 'energy_flow': return 'Mcal/h';
        case 'energy_specific': return 'kcal/kg';
        case 'emission_factor': return 'kg/Gcal';
        case 'annual_mass': return 't/año';
        case 'cost_mass': return 'US$/t';
        default: return baseUnit;
      }
    }

    // SI (estricto)
    switch (quantity) {
      case 'temp_c': return 'K';
      case 'mass_flow': return 'kg/s';
      case 'energy_flow': return 'kW';
      case 'energy_specific': return 'kJ/kg';
      case 'emission_factor': return 'kg/GJ';
      case 'annual_mass': return 'kg/s';
      case 'cost_mass': return 'US$/kg';
      default: return baseUnit;
    }
  }

  displayResultValue(value: any, quantity: ResultsQuantity): any {
    if (this.resultsUnitSystem === 'USB') {
      return value;
    }

    const parsed = this.parseNumeric(value);
    if (parsed === null) {
      return value;
    }

    let converted = parsed;

    if (this.resultsUnitSystem === 'LKS') {
      switch (quantity) {
        case 'mass_flow':
          converted = parsed / 1000; // kg/h -> t/h
          break;
        case 'energy_flow':
          converted = parsed / 1000; // kcal/h -> Mcal/h
          break;
        default:
          converted = parsed;
      }
    }

    if (this.resultsUnitSystem === 'SI') {
      switch (quantity) {
        case 'temp_c':
          converted = parsed + 273.15; // C -> K
          break;
        case 'mass_flow':
          converted = parsed / 3600; // kg/h -> kg/s
          break;
        case 'energy_flow':
          converted = parsed * 0.001163; // kcal/h -> kW
          break;
        case 'energy_specific':
          converted = parsed * 4.1868; // kcal/kg -> kJ/kg
          break;
        case 'emission_factor':
          converted = parsed / 4.1868; // kg/Gcal -> kg/GJ
          break;
        case 'annual_mass':
          converted = parsed * 0.0000317098; // t/año -> kg/s
          break;
        case 'cost_mass':
          converted = parsed / 1000; // US$/t -> US$/kg
          break;
        default:
          converted = parsed;
      }
    }

    return this.formatByQuantity(converted, quantity);
  }

  private parseNumeric(value: any): number | null {
    if (value === null || value === undefined) {
      return null;
    }

    const normalized = String(value).replace(/,/g, '').trim();
    if (!normalized) {
      return null;
    }

    const n = Number(normalized);
    return Number.isFinite(n) ? n : null;
  }

  private formatByQuantity(value: number, quantity: ResultsQuantity): string {
    let digits = 2;

    if (quantity === 'mass_flow' || quantity === 'energy_flow' || quantity === 'energy_specific' || quantity === 'emission_factor') {
      digits = this.resultsUnitSystem === 'SI' ? 3 : 2;
    }

    if (quantity === 'annual_mass') {
      digits = this.resultsUnitSystem === 'SI' ? 6 : 2;
    }

    if (quantity === 'temp_c') {
      digits = 1;
    }

    return value.toLocaleString('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: digits
    });
  }

  private clampPercent(value: any): number {
    const n = Number(value);
    if (isNaN(n)) return 0;
    return Math.max(0, Math.min(100, n));
  }

  getBmsChartData(): Array<{ label: string; value: number; width: number; section: 'in' | 'out' }> {
    const bms = this.evaluationResults?.bms;
    if (!bms) return [];

    const entradas = bms.entradas;
    const salidas = bms.salidas;

    const items = [
      { label: 'Aire', value: this.parseNumeric(entradas.aireCombustion?.val) || 0, section: 'in' as const },
      { label: 'H.Aire', value: this.parseNumeric(entradas.aguaAlimentacion?.val) || 0, section: 'in' as const },
      { label: 'Comb.', value: this.parseNumeric(entradas.combustible?.val) || 0, section: 'in' as const },
      { label: 'CO2', value: this.parseNumeric(salidas.co2?.val) || 0, section: 'out' as const },
      { label: 'N2', value: this.parseNumeric(salidas.n2?.val) || 0, section: 'out' as const },
      { label: 'O2', value: this.parseNumeric(salidas.o2?.val) || 0, section: 'out' as const },
      { label: 'SO2', value: this.parseNumeric(salidas.so2?.val) || 0, section: 'out' as const },
      { label: 'H2O', value: this.parseNumeric(salidas.h2o?.val) || 0, section: 'out' as const },
      { label: 'CO', value: this.parseNumeric(salidas.co?.val) || 0, section: 'out' as const },
      { label: 'Hollín', value: this.parseNumeric(salidas.hollin?.val) || 0, section: 'out' as const },
    ];

    const max = Math.max(1, ...items.map(i => i.value));
    return items.map(i => ({ ...i, width: (i.value / max) * 100 }));
  }

  getBenChartData(): Array<{ label: string; value: number; width: number; section: 'in' | 'out' }> {
    const ben = this.evaluationResults?.ben;
    if (!ben) return [];

    const entradas = ben.entradas;
    const salidas = ben.salidas;

    const items = [
      { label: 'Comb.', value: this.parseNumeric(entradas.R29?.val) || 0, section: 'in' as const },
      { label: 'Agua', value: this.parseNumeric(entradas.R30?.val) || 0, section: 'in' as const },
      { label: 'Aire', value: this.parseNumeric(entradas.R31?.val) || 0, section: 'in' as const },
      { label: 'Calor útil', value: this.parseNumeric(salidas.R35?.val) || 0, section: 'out' as const },
      { label: 'Chimenea', value: this.parseNumeric(salidas.R36?.val) || 0, section: 'out' as const },
      { label: 'Inq. sól.', value: this.parseNumeric(salidas.R37?.val) || 0, section: 'out' as const },
      { label: 'Inq. gas', value: this.parseNumeric(salidas.R38?.val) || 0, section: 'out' as const },
      { label: 'Rad.+Conv.', value: this.parseNumeric(salidas.R39?.val) || 0, section: 'out' as const },
      { label: 'Purgas', value: this.parseNumeric(salidas.R40?.val) || 0, section: 'out' as const },
    ];

    const max = Math.max(1, ...items.map(i => i.value));
    return items.map(i => ({ ...i, width: (i.value / max) * 100 }));
  }

  getEmiChartData(): Array<{ label: string; value: number; width: number }> {
    const emi = this.evaluationResults?.emi;
    if (!emi) return [];

    const items = [
      { label: 'CO2', value: Number(emi.R46) || 0 },
      { label: 'CO', value: Number(emi.R47) || 0 },
      { label: 'Holín', value: Number(emi.R48) || 0 },
      { label: 'SO2', value: Number(emi.R49) || 0 }
    ];

    const max = Math.max(1, ...items.map(i => i.value));
    return items.map(i => ({ ...i, width: (i.value / max) * 100 }));
  }

  setupCharts() {
    this.destroyCharts(); // Destroy existing charts before creating new ones

    // EFI Gauge
    const efiValue = this.evaluationResults.graficoEficiencia;
    let efiColor;
    if (efiValue > 80) {
      efiColor = '#28a745'; // Verde
    } else if (efiValue >= 75 && efiValue <= 80) {
      efiColor = '#ffa500'; // Naranja
    } else {
      efiColor = '#dc3545'; // Rojo
    }

    const efiGaugeOptions: ChartOptions = {
      series: [efiValue],
      chart: { type: 'radialBar', height: 300, offsetY: -20, sparkline: { enabled: true } },
      plotOptions: {
        radialBar: {
          startAngle: -120, endAngle: 120, hollow: { size: '60%' },
          track: { background: '#eee', strokeWidth: '100%' },
          dataLabels: {
            name: { show: true, color: '#000', fontSize: '16px', offsetY: -10 },
            value: { fontSize: '20px', color: efiColor, offsetY: 10, formatter: (val: any) => val + '%' }
          }
        }
      },
      fill: { colors: [efiColor], type: 'solid' },
      labels: ['Eficiencia'],
    };


    // Exceso de Aire Gauge
    const value = this.evaluationResults.com.R1B;
    const combustible = this.selectedCombustible.value;

    // Define rangos específicos por tipo de combustible
    const fuelRanges: Record<string, { green: [number, number], orange: [number, number] }> = {
      'Gas Natural Camisea': { green: [5, 15], orange: [15, 25] },
      'Gas Natural Talara': { green: [5, 15], orange: [15, 25] },
      'GLP': { green: [10, 20], orange: [20, 30] },
      'Diesel': { green: [15, 25], orange: [25, 35] },
      'P.I.6': { green: [20, 30], orange: [30, 40] },
      'P.I.500': { green: [25, 35], orange: [35, 45] }
    };

    // Obtener rangos para el combustible actual (usar GLP por defecto)
    const ranges = fuelRanges[combustible || 'GLP'] || fuelRanges['GLP'];

    let color;
    if (value >= ranges.green[0] && value <= ranges.green[1]) {
      color = '#28a745'; // Verde (Óptimo)
    } else if (value >= ranges.orange[0] && value <= ranges.orange[1]) {
      color = '#ffa500'; // Naranja (Aceptable)
    } else {
      color = '#dc3545'; // Rojo (Fuera de rango)
    }

    const excesoAireGaugeOptions: ChartOptions = {
      series: [value],
      chart: { type: 'radialBar', height: 220, sparkline: { enabled: true } },
      plotOptions: {
        radialBar: {
          startAngle: -120, endAngle: 120, hollow: { size: '70%' },
          track: { background: '#eee', strokeWidth: '100%' },
          dataLabels: {
            name: { show: true, color: '#000', fontSize: '14px', offsetY: -5 },
            value: { fontSize: '18px', color: color, offsetY: 5, formatter: (val: any) => val + '%' }
          }
        }
      },
      fill: { colors: [color], type: 'solid' },
      labels: ['Exceso de Aire'],
    };

    // Fix for "ApexCharts is not a constructor" runtime error
    const ApexChartsCtor: any = (ApexCharts as any).default || ApexCharts;

    const efiGaugeEl = document.querySelector("#efiGaugeChart");
    if (efiGaugeEl) {
      this.efiGauge = new ApexChartsCtor(efiGaugeEl, efiGaugeOptions);
    }

    const excesoAireGaugeEl = document.querySelector("#excesoAireGaugeChart");
    if (excesoAireGaugeEl) {
      this.excesoAireGauge = new ApexChartsCtor(excesoAireGaugeEl, excesoAireGaugeOptions);
    }

    // Factor de Carga Gauge
    const factorCargaValue = this.evaluationResults.carga.factorCarga;
    let factorCargaColor;
    if (factorCargaValue > 70) {
      factorCargaColor = '#28a745'; // Verde
    } else if (factorCargaValue >= 50 && factorCargaValue <= 70) {
      factorCargaColor = '#ffa500'; // Naranja
    } else {
      factorCargaColor = '#dc3545'; // Rojo
    }

    const factorCargaGaugeOptions: ChartOptions = {
      series: [factorCargaValue],
      chart: { type: 'radialBar', height: 300, offsetY: -20, sparkline: { enabled: true } },
      plotOptions: {
        radialBar: {
          startAngle: -120, endAngle: 120, hollow: { size: '60%' },
          track: { background: '#eee', strokeWidth: '100%' },
          dataLabels: {
            name: { show: true, color: '#000', fontSize: '16px', offsetY: -10 },
            value: { fontSize: '20px', color: factorCargaColor, offsetY: 10, formatter: (val: any) => val + '%' }
          }
        }
      },
      fill: { colors: [factorCargaColor], type: 'solid' },
      labels: ['Factor de Carga'],
    };

    const factorCargaGaugeEl = document.querySelector("#factorCargaGaugeChart");
    if (factorCargaGaugeEl) {
      this.factorCargaGauge = new ApexChartsCtor(factorCargaGaugeEl, factorCargaGaugeOptions);
    }

    // --- BMS Chart (Balance de Masa) ---
    // Función auxiliar para parsear valores numéricos de strings con formato "1,000"
    const parseVal = (strVal: string) => {
      if (!strVal) return 0;
      return parseFloat(strVal.replace(/,/g, ''));
    };

    // Entradas (Negativas para el gráfico)
    const valAire = -Math.abs(parseVal(this.evaluationResults.bms.entradas.aireCombustion.val));
    const valComb = -Math.abs(parseVal(this.evaluationResults.bms.entradas.combustible.val));

    // Salidas (Positivas)
    const valCO2 = parseVal(this.evaluationResults.bms.salidas.co2.val);
    const valN2 = parseVal(this.evaluationResults.bms.salidas.n2.val);
    const valO2 = parseVal(this.evaluationResults.bms.salidas.o2.val);
    const valSO2 = parseVal(this.evaluationResults.bms.salidas.so2.val);
    const valH2O = parseVal(this.evaluationResults.bms.salidas.h2o.val);
    const valCO = parseVal(this.evaluationResults.bms.salidas.co.val);
    const valHollin = parseVal(this.evaluationResults.bms.salidas.hollin.val);

    const bmsChartOptions: ChartOptions = {
      series: [{
        name: 'Masa',
        data: [valAire, valComb, valCO2, valN2, valO2, valSO2, valH2O, valCO, valHollin]
      }],
      chart: {
        type: 'bar',
        height: 350,
        toolbar: { show: false }
      },
      plotOptions: {
        bar: {
          colors: {
            ranges: [{ from: -1000000, to: 1000000, color: '#3282b8' }] // Azul sólido
          },
          columnWidth: '60%',
          dataLabels: {
            position: 'top', // top of bar
          }
        }
      },
      dataLabels: {
        enabled: true,
        formatter: function (val: number) {
          return Math.abs(val).toLocaleString('en-US'); // Mostrar valor positivo
        },
        offsetY: -20,
        style: {
          fontSize: '12px',
          colors: ["#304758"]
        }
      },
      xaxis: {
        categories: ['Aire', 'Comb.', 'CO2', 'N2', 'O2', 'SO2', 'H2O', 'CO', 'Hollín'],
        labels: {
          rotate: -45
        }
      },
      yaxis: {
        title: {
          text: 'Masa (kg/h)'
        },
        labels: {
          formatter: (val: number) => Math.abs(val).toFixed(0)
        }
      },
      title: {
        text: 'Balance de Masa de Combustión',
        align: 'center',
        style: { color: '#0c4a6e' }
      },
      grid: {
        yaxis: {
          lines: { show: true }
        }
      }
    };    // after populating results, navigate to results screen
    this.currentScreen = 8;
    const bmsChartEl = document.querySelector("#bmsChart");
    if (bmsChartEl) {
      this.bmsChart = new ApexChartsCtor(bmsChartEl, bmsChartOptions);
    }

    // Render the chart for the active tab
    this.renderActiveChart();
  }

  setActiveResultsTab(tabName: string) {
    this.activeResultsTab = tabName;
    this.efiChartView = 1;
    this.emiChartView = 1;
    this.renderActiveChart();
  }

  goToPreviousResultTab() {
    const currentIndex = this.tabsList.indexOf(this.activeResultsTab);
    if (currentIndex > 0) {
      this.setActiveResultsTab(this.tabsList[currentIndex - 1]);
    }
  }

  goToNextResultTab() {
    const currentIndex = this.tabsList.indexOf(this.activeResultsTab);
    if (currentIndex < this.tabsList.length - 1) {
      this.setActiveResultsTab(this.tabsList[currentIndex + 1]);
    }
  }

  handleResultsBack() {
    if (this.activeResultsTab === 'COM') {
      this.backToDashboard();
      return;
    }

    this.goToPreviousResultTab();
  }

  reportResults() {
    alert('¡Reporte enviado! Se reportó por correo electrónico a todos los operadores asignados.');
    this.currentScreen = 1;
    this.toggleCalderaSelection(0);
    this.evaluationResults = null;
    this.activeResultsTab = 'COM';
    this.destroyCharts();
  }

  private renderActiveChart() {
    if (this.activeResultsTab === 'COM' && this.excesoAireGauge) {
      this.excesoAireGauge.render();
    } else if (this.activeResultsTab === 'PRO' && this.factorCargaGauge) {
      this.factorCargaGauge.render();
    } else if (this.activeResultsTab === 'EFI' && this.efiGauge) {
      this.efiGauge.render();
    } else if (this.activeResultsTab === 'BMS' && this.bmsChart) {
      this.bmsChart.render();
    }
  }

  private destroyCharts() {
    if (this.efiGauge) {
      this.efiGauge.destroy();
      this.efiGauge = null;
    }
    if (this.excesoAireGauge) {
      this.excesoAireGauge.destroy();
      this.excesoAireGauge = null;
    }
    if (this.factorCargaGauge) {
      this.factorCargaGauge.destroy();
      this.factorCargaGauge = null;
    }
    if (this.bmsChart) {
      this.bmsChart.destroy();
      this.bmsChart = null;
    }
  }

  /**
   * Save evaluation to the database
   */
  saveEvaluation() {
    this.savingEvaluation = true;
    this.saveError = null;

    const selectedCaldera = this.calderas.find(c => c.selected);
    const calderaId = selectedCaldera ? String(selectedCaldera.id) : '1';

    const evaluationData = {
      calderaId: calderaId,
      fuelType: this.selectedCombustible.value || 'GLP',
      operationHours: this.operationTimeControl.value || 0,
      dataJson: {
        ...this.dataFields,
        costItems: this.costItems
      },
      resultsSummary: this.evaluationResults
    };

    this.evaluationService.createEvaluation(evaluationData).subscribe({
      next: (response) => {
        this.savingEvaluation = false;
        console.log('Evaluation saved successfully:', response);
        // Redirect to dashboard
        setTimeout(() => {
          this.router.navigate(['/dashboard']);
        }, 500);
      },
      error: (error) => {
        this.savingEvaluation = false;
        this.saveError = 'Error al guardar la evaluación. Intenta nuevamente.';
        console.error('Error saving evaluation:', error);
      }
    });
  }

  /**
   * Go back to dashboard without saving
   */
  backToDashboard() {
    // Ask for confirmation before abandoning the evaluation
    if (confirm('¿Deseas abandonar esta evaluación sin guardar?')) {
      this.router.navigate(['/dashboard']);
    }
  }
}
