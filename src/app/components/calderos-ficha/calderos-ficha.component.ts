import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { CalderosService, CalderoFicha } from '../../services/calderos-ficha.service';
import { PlantsFichaService, PlantsFicha } from '../../services/plants-ficha.service';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

@Component({
  selector: 'app-calderos-ficha',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './calderos-ficha.component.html',
  styleUrl: './calderos-ficha.component.css'
})
export class CalderosComponent implements OnInit, OnDestroy {
  form!: FormGroup;
  loading = false;
  error: string | null = null;
  isEditing = false;
  isCreating = false;
  isViewing = false; // New flag for viewing mode
  isLoadingData = false;
  formStep: number = 1; // Track form step (1 or 2)
  
  plants: PlantsFicha[] = [];
  calderos: CalderoFicha[] = [];
  selectedPlant: PlantsFicha | null = null;
  selectedCaldero: CalderoFicha | null = null;
  selectedTipoCaldero: string = '';
  imagePreview: string | null = null;
  private originalImagePreview: string | null = null;
  private pendingImageDeletion = false;
  private destroy$ = new Subject<void>();

  // Type options
  tipoCalderoOptions = [
    { value: 'cilindrico_horizontal', label: 'Cilíndrico Horizontal', config: 'Cilíndrico Horizontal' },
    { value: 'cilindrico_vertical', label: 'Cilíndrico Vertical', config: 'Cilíndrico Vertical' },
    { value: 'apin', label: 'Tipo caja (box)', config: 'Tipo caja (box)' }
  ];

  // Combustible options
  combustibleOptions = [
    { value: 'Gas Natural (Camisea)', label: 'Gas Natural (Camisea)' },
    { value: 'Gas Natural (Talara)', label: 'Gas Natural (Talara)' },
    { value: 'S.U.P', label: 'S.U.P' },
    { value: 'Diesel', label: 'Diesel' },
    { value: 'Petróleo Industrial Nº 6', label: 'Petróleo Industrial Nº 6' },
    { value: 'Petróleo Industrial Nº 500', label: 'Petróleo Industrial Nº 500' }
  ];

  // Treatment options
  tratamientoExternoOptions = ['Ablandamiento', 'Desmineralización', 'Osmosis inversa', 'Otro'];
  tratamientoInternoOptions = ['Fosfatos', 'Polímeros', 'Otros'];

  // Years dropdown
  years: number[] = [];

  constructor(
    private fb: FormBuilder,
    private calderosService: CalderosService,
    private plantsFichaService: PlantsFichaService,
    private router: Router
  ) {
    this.initializeForm();
    this.generateYears();
  }

  ngOnInit() {
    console.log('🔥 CalderosComponent initialized');
    this.loadPlants();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private generateYears() {
    const currentYear = new Date().getFullYear();
    for (let year = 1900; year <= currentYear; year++) {
      this.years.push(year);
    }
    this.years.reverse();
  }

  private initializeForm() {
    this.form = this.fb.group({
      id: [''],
      nombre: ['', Validators.required],
      marca: ['', Validators.required],
      tipo_caldero: ['', Validators.required],
      configuracion: ['', Validators.required],
      combustible: ['', Validators.required],
      capacidad_instalada: ['', Validators.required],
      capacidad_unidad: ['lb/h'],
      presion_diseno: ['', Validators.required],
      presion_unidad: ['Psi g'],
      imagen_path: [''],
      superficie: [''],
      anio: [''],
      tratamiento_externo: [''],
      tratamiento_interno: [''],
      diametro_d: [''],
      longitud_l: [''],
      altura_h: [''],
      ancho_a: ['']
    });
  }

  private loadPlants() {
    this.isLoadingData = true;
    this.error = null;

    this.plantsFichaService.getAllPlants()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (plants) => {
          this.isLoadingData = false;
          this.plants = plants;
        },
        error: (error) => {
          this.isLoadingData = false;
          console.log('No plants found');
        }
      });
  }

  selectPlant(plant: PlantsFicha) {
    this.selectedPlant = plant;
    this.selectedCaldero = null;
    this.calderos = [];
    this.loadCalderos(plant.id!);
  }

  private loadCalderos(plantId: number) {
    this.loading = true;
    this.calderosService.getCaldereosByPlant(plantId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (calderos) => {
          this.loading = false;
          this.calderos = calderos;
        },
        error: (error) => {
          this.loading = false;
          console.log('No calderos found');
          this.calderos = [];
        }
      });
  }

  viewCaldero(caldero: CalderoFicha) {
    this.selectedCaldero = caldero;
    this.selectedTipoCaldero = caldero.tipo_caldero || '';
    this.imagePreview = caldero.imagen_path && !caldero.imagen_path.startsWith('data:')
      ? `/uploads/${caldero.imagen_path}`
      : caldero.imagen_path || null;
    
    // Map backend field names (with special characters) to form field names (without special characters)
    const formData = { ...caldero } as any;
    if (caldero['presion_diseño'] !== undefined) {
      formData['presion_diseno'] = caldero['presion_diseño'];
    }
    if (caldero['año'] !== undefined) {
      formData['anio'] = caldero['año'];
    }
    
    // Set configuracion based on tipo_caldero
    const typeOption = this.tipoCalderoOptions.find(t => t.value === caldero.tipo_caldero);
    if (typeOption) {
      formData.configuracion = typeOption.config;
      this.selectedTipoCaldero = caldero.tipo_caldero;
    }
    
    this.form.patchValue(formData);
    this.pendingImageDeletion = false;
    this.originalImagePreview = null;
    this.form.disable();
    this.isViewing = true;
    this.isEditing = false;
    this.formStep = 1;
  }

  selectTipoCaldero(tipo: string) {
    this.selectedTipoCaldero = tipo;
    const typeOption = this.tipoCalderoOptions.find(t => t.value === tipo);
    if (typeOption) {
      this.form.patchValue({ tipo_caldero: tipo, configuracion: typeOption.config });
    }
  }

  onConfiguracionChanged(event: any) {
    const configuracion = event.target.value;
    const typeOption = this.tipoCalderoOptions.find(t => t.config === configuracion);
    if (typeOption) {
      this.form.patchValue({ tipo_caldero: typeOption.value });
      this.selectedTipoCaldero = typeOption.value;
    }
  }

  getSelectedTipoCaldero(): string {
    const configuracion = this.form.get('configuracion')?.value;
    if (!configuracion) return '';
    
    const typeOption = this.tipoCalderoOptions.find(t => t.config === configuracion);
    return typeOption?.value || '';
  }

  getCurrentTipoCaldero(): string {
    return this.getSelectedTipoCaldero() || this.selectedTipoCaldero || this.selectedCaldero?.tipo_caldero || '';
  }

  onPlantSelected(event: any) {
    const plantId = event.target.value;
    if (!plantId) {
      this.selectedPlant = null;
      this.calderos = [];
      return;
    }
    
    const plant = this.plants.find(p => p.id == plantId);
    if (plant) {
      this.selectedPlant = plant;
      this.loadCalderos(plant.id!);
    }
  }

  createNewCaldero() {
    if (!this.selectedPlant) {
      this.error = 'Por favor selecciona una planta primero';
      return;
    }
    this.isCreating = true;
    this.formStep = 1;
    this.form.reset({ 
      capacidad_unidad: 'lb/h',
      presion_unidad: 'Psi g'
    });
    this.form.enable();
    this.imagePreview = null;
    this.originalImagePreview = null;
    this.pendingImageDeletion = false;
  }

  nextStep() {
    if (this.formStep === 1) {
      // If viewing, just move to next step without validation
      if (this.isViewing && !this.isEditing) {
        this.formStep = 2;
        return;
      }
      
      // Validate step 1 fields (only the visible ones) when creating or editing
      const requiredFields = ['nombre', 'marca', 'configuracion', 'combustible', 'capacidad_instalada', 'presion_diseno'];
      
      let isValid = true;
      requiredFields.forEach(field => {
        const control = this.form.get(field);
        if (!control?.value) {
          isValid = false;
          control?.markAsTouched();
        }
      });
      
      if (isValid) {
        this.formStep = 2;
      } else {
        this.error = 'Por favor completa todos los campos requeridos';
      }
    }
  }

  previousStep() {
    if (this.formStep === 2) {
      this.formStep = 1;
      this.error = null;
    }
  }

  editCaldero() {
    this.isEditing = true;
    this.isViewing = false;
    this.form.enable();
    this.originalImagePreview = this.imagePreview;
    this.pendingImageDeletion = false;
  }

  cancelEdit() {
    this.isEditing = false;
    this.isCreating = false;
    this.formStep = 1;
    this.pendingImageDeletion = false;
    if (this.selectedCaldero) {
      this.viewCaldero(this.selectedCaldero);
    } else {
      this.form.reset();
      this.imagePreview = this.originalImagePreview;
      this.selectedTipoCaldero = '';
      this.isViewing = false;
    }
    this.originalImagePreview = null;
  }

  backToList() {
    this.selectedCaldero = null;
    this.form.reset();
    this.imagePreview = null;
    this.selectedTipoCaldero = '';
    this.formStep = 1;
    this.isViewing = false;
  }

  backToPlants() {
    this.selectedPlant = null;
    this.calderos = [];
    this.selectedCaldero = null;
    this.form.reset();
    this.imagePreview = null;
    this.selectedTipoCaldero = '';
  }

  onImageSelected(event: any) {
    if (!(this.isCreating || this.isEditing)) {
      return;
    }

    const file: File = event.target.files[0];
    if (file) {
      this.pendingImageDeletion = false;
      const reader = new FileReader();
      reader.onload = (e: any) => {
        this.imagePreview = e.target.result;
      };
      reader.readAsDataURL(file);
    }
  }

  deleteImage() {
    if (!(this.isCreating || this.isEditing)) {
      return;
    }

    if (!this.imagePreview && !this.selectedCaldero?.imagen_path) {
      return;
    }

    this.pendingImageDeletion = true;
    this.imagePreview = null;
  }

  onSave() {
    if (this.form.invalid) {
      this.error = 'Por favor completa todos los campos requeridos';
      console.log('Form invalid. Errors:', this.form.errors);
      return;
    }

    // Validate dimension fields based on boiler type
    const tipoCaldero = this.getSelectedTipoCaldero();
    const formValues = this.form.getRawValue() as any;
    
    if (tipoCaldero === 'cilindrico_horizontal') {
      if (!formValues.diametro_d || !formValues.longitud_l) {
        this.error = 'Por favor completa Diámetro y Longitud';
        return;
      }
    } else if (tipoCaldero === 'cilindrico_vertical') {
      if (!formValues.diametro_d || !formValues.altura_h) {
        this.error = 'Por favor completa Diámetro y Altura';
        return;
      }
    } else if (tipoCaldero === 'apin') {
      if (!formValues.ancho_a || !formValues.longitud_l) {
        this.error = 'Por favor completa Ancho y Longitud';
        return;
      }
    }

    this.loading = true;
    this.error = null;

    if (!this.selectedPlant) {
      this.error = 'Planta no seleccionada';
      this.loading = false;
      return;
    }

    // Map form field names to backend field names (with special characters)
    if (formValues.presion_diseno !== undefined && formValues.presion_diseno !== '') {
      formValues['presion_diseño'] = formValues.presion_diseno;
      delete formValues.presion_diseno;
    }
    if (formValues.anio !== undefined && formValues.anio !== '') {
      formValues['año'] = formValues.anio;
      delete formValues.anio;
    }

    formValues.plant_id = this.selectedPlant.id;

    // Handle image
    if (this.pendingImageDeletion) {
      formValues.imagen_path = '';
    } else if (this.imagePreview && this.imagePreview.startsWith('data:')) {
      formValues.imagen_path = this.imagePreview;
    } else if (this.selectedCaldero?.imagen_path) {
      formValues.imagen_path = this.selectedCaldero.imagen_path;
    } else {
      formValues.imagen_path = '';
    }

    console.log('Saving caldero:', {
      nombre: formValues.nombre,
      tipo: formValues.tipo_caldero,
      planta: this.selectedPlant.nombre
    });

    const savedStep = this.formStep;

    this.calderosService.saveCaldero(formValues)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          console.log('✓ Caldero saved successfully:', response);

          const savedCalderoId = Number(response?.id || formValues.id || this.selectedCaldero?.id);

          this.calderosService.getCaldereosByPlant(this.selectedPlant!.id!)
            .pipe(takeUntil(this.destroy$))
            .subscribe({
              next: (calderos) => {
                this.calderos = calderos;
              },
              error: (listError) => {
                console.error('Error reloading calderos list:', listError);
              }
            });

          if (!savedCalderoId) {
            this.loading = false;
            this.isEditing = false;
            this.isCreating = false;
            this.isViewing = true;
            this.pendingImageDeletion = false;
            this.originalImagePreview = null;
            return;
          }

          this.calderosService.getCaldero(savedCalderoId)
            .pipe(takeUntil(this.destroy$))
            .subscribe({
              next: (updatedCaldero) => {
                this.loading = false;
                this.selectedCaldero = updatedCaldero;
                this.viewCaldero(updatedCaldero);
                this.formStep = savedStep;
                this.pendingImageDeletion = false;
                this.originalImagePreview = null;
              },
              error: (reloadError) => {
                this.loading = false;
                this.error = 'Guardó, pero no se pudo recargar el caldero: ' + (reloadError.error?.error || reloadError.message);
                console.error('Error reloading saved caldero:', reloadError);
              }
            });
        },
        error: (error) => {
          this.loading = false;
          this.error = 'Error al guardar: ' + (error.error?.error || error.message);
          console.error('❌ Save error:', error);
          console.error('Error details:', error.error);
        }
      });
  }

  deleteCaldero() {
    if (!this.selectedCaldero?.id) return;

    if (confirm('¿Estás seguro de que deseas eliminar este caldero?')) {
      this.loading = true;
      this.calderosService.deleteCaldero(this.selectedCaldero.id)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (response) => {
            this.loading = false;
            console.log('✓ Caldero deleted successfully');
            this.loadCalderos(this.selectedPlant!.id!);
            this.selectedCaldero = null;
            this.form.reset();
            this.imagePreview = null;
          },
          error: (error) => {
            this.loading = false;
            this.error = 'Error al eliminar: ' + (error.error?.error || error.message);
            console.error('❌ Delete error:', error);
          }
        });
    }
  }

  goBack() {
    this.router.navigate(['/dashboard']);
  }

  // Check if field should be shown based on caldero type
  shouldShowField(fieldName: string): boolean {
    if (!this.selectedTipoCaldero && !this.selectedCaldero?.tipo_caldero) return false;
    
    const tipo = this.selectedTipoCaldero || this.selectedCaldero?.tipo_caldero;
    
    if (fieldName === 'diametro_d' || fieldName === 'longitud_l') {
      return tipo === 'cilindrico_horizontal';
    }
    if (fieldName === 'diametro_d' || fieldName === 'altura_h') {
      return tipo === 'cilindrico_vertical';
    }
    if (fieldName === 'ancho_a' || fieldName === 'longitud_l') {
      return tipo === 'apin';
    }
    return true;
  }
}
