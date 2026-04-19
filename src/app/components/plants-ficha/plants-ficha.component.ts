import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { PlantsFichaService, PlantsFicha } from '../../services/plants-ficha.service';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

// Peru Departments and Provinces (same as in company-ficha)
const PERU_DEPARTMENTS: { [key: string]: string[] } = {
  'Lima': ['Lima', 'Barranca', 'Cañete', 'Huacho', 'Huancayo', 'Pisco'],
  'Arequipa': ['Arequipa', 'Camaná', 'Islay', 'Caravelí', 'Chumbivilcas'],
  'Callao': ['Callao'],
  'La Libertad': ['Trujillo', 'Ascope', 'Bolívar', 'Santiago de Chuco', 'Virú'],
  'Lambayeque': ['Chiclayo', 'Lambayeque', 'Ferreñafe', 'Chclayo'],
  'Ica': ['Ica', 'Chincha', 'Nazca', 'Palpa', 'Pisco'],
  'Junín': ['Huancayo', 'Concepción', 'Satipo', 'Tarma', 'Chanchamayo'],
  'Cusco': ['Cusco', 'Acomayo', 'Chumbivilcas', 'Canchis', 'Canas'],
  'Puno': ['Puno', 'Azángaro', 'Carabaya', 'El Collao', 'Lampa'],
  'Ancash': ['Huaraz', 'Casma', 'Chimbote', 'Huarmey', 'Carhuaz'],
  'Cajamarca': ['Cajamarca', 'Bambamarca', 'San Marcos', 'Celendín', 'Chota'],
  'Ayacucho': ['Huamanga', 'Huanta', 'La Mar', 'Lucanas', 'Cangallo'],
  'Apurímac': ['Abancay', 'Andahuaylas', 'Cotabambas', 'Chincheros', 'Grau'],
  'Huancavelica': ['Huancavelica', 'Tayacaja', 'Acobamba', 'Angaraes', 'Castrovirreyna'],
  'Huánuco': ['Huánuco', 'Yarowilca', 'Puerto Inca', 'Mariscal Castilla', 'Ambo'],
  'Piura': ['Piura', 'Paita', 'Sullana', 'Talara', 'Morropón'],
  'Loreto': ['Iquitos', 'Requena', 'Nauta', 'Mazamari', 'Contamana'],
  'Ucayali': ['Pucallpa', 'Coronel Portillo', 'Ucayali', 'Atalaya', 'Tahuania'],
  'Madre de Dios': ['Puerto Maldonado', 'Manu', 'Tambopata', 'Inambari', 'La Pampa'],
  'San Martín': ['Moyobamba', 'Tarapoto', 'Lamas', 'Rioja', 'Huallaga'],
  'Tacna': ['Tacna', 'Candarave', 'Jorge Basadre', 'Tarata', 'Sama'],
  'Tumbes': ['Tumbes', 'Zarumilla', 'Contralmirante Villar', 'San Juan de la Virgen', 'Aguas Verdes'],
  'Moquegua': ['Moquegua', 'Ilo', 'Mariscal Nieto', 'Carumas', 'Torata'],
  'Pasco': ['Cerro de Pasco', 'Yauli', 'Junín', 'Oxapampa', 'Chontabamba']
};

@Component({
  selector: 'app-plants-ficha',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './plants-ficha.component.html',
  styleUrl: './plants-ficha.component.css'
})
export class PlantsFichaComponent implements OnInit, OnDestroy {
  form!: FormGroup;
  loading = false;
  error: string | null = null;
  isEditing = false;
  isCreating = false;
  isViewing = false;
  isLoadingData = false;
  
  plants: PlantsFicha[] = [];
  selectedPlant: PlantsFicha | null = null;
  private destroy$ = new Subject<void>();

  // Data for dropdowns
  departments = Object.keys(PERU_DEPARTMENTS).sort();
  filteredProvinces: string[] = [];
  selectedImageFile: File | null = null;
  imagePreview: string | null = null;
  private originalImagePreview: string | null = null;
  private pendingImageDeletion = false;

  constructor(
    private fb: FormBuilder,
    private plantsFichaService: PlantsFichaService,
    private router: Router
  ) {
    this.initializeForm();
  }

  ngOnInit() {
    console.log('🌱 PlantsFichaComponent initialized');
    this.loadPlants();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private initializeForm() {
    this.form = this.fb.group({
      id: [''],
      nombre: ['', Validators.required],
      avenue: [''],
      avenue_number: [''],
      district: ['', Validators.required],
      department: ['Lima', Validators.required],
      province: ['Lima', Validators.required],
      correo: [''],
      email: [''],
      image_path: ['']
    });

    // Subscribe to department changes
    this.form.get('department')?.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(department => {
        this.updateProvincesList(department);
      });

    // Initialize provinces
    this.updateProvincesList('Lima');
  }

  private updateProvincesList(department: string) {
    this.filteredProvinces = PERU_DEPARTMENTS[department] || [];
    const currentProvince = this.form.get('province')?.value;
    if (!this.filteredProvinces.includes(currentProvince)) {
      this.form.patchValue({ province: this.filteredProvinces[0] || '' });
    }
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

  viewPlant(plant: PlantsFicha) {
    this.selectedPlant = plant;
    this.imagePreview = plant.image_path && !plant.image_path.startsWith('data:') 
      ? `/uploads/${plant.image_path}` 
      : (plant.image_path || null);
    this.pendingImageDeletion = false;
    this.selectedImageFile = null;
    this.form.patchValue(plant);
    this.form.disable();
    this.isViewing = true;
    this.isEditing = false;
    this.isCreating = false;
  }

  createNewPlant() {
    this.isCreating = true;
    this.isViewing = false;
    this.isEditing = false;
    this.selectedPlant = null;
    this.form.reset({ department: 'Lima', province: 'Lima' });
    this.imagePreview = null;
    this.pendingImageDeletion = false;
    this.selectedImageFile = null;
    this.form.enable();
  }

  editPlant() {
    this.isEditing = true;
    this.isViewing = false;
    this.form.enable();
    this.originalImagePreview = this.imagePreview;
    this.pendingImageDeletion = false;
  }

  cancelEdit() {
    this.isEditing = false;
    this.isCreating = false;
    this.pendingImageDeletion = false;
    this.selectedImageFile = null;
    this.imagePreview = this.originalImagePreview;
    this.originalImagePreview = null;
    if (this.selectedPlant) {
      this.viewPlant(this.selectedPlant);
    } else {
      this.form.reset({ department: 'Lima', province: 'Lima' });
      this.imagePreview = null;
      this.isViewing = false;
    }
  }

  onImageSelected(event: any) {
    if (!(this.isCreating || this.isEditing)) {
      return;
    }

    const file: File = event.target.files[0];
    if (file) {
      this.selectedImageFile = file;
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

    if (!this.imagePreview) {
      return;
    }

    this.pendingImageDeletion = true;
    this.selectedImageFile = null;
    this.imagePreview = null;
  }

  onSave() {
    if (this.form.invalid) {
      this.error = 'Por favor completa todos los campos requeridos';
      console.log('Form invalid. Errors:', this.form.errors);
      return;
    }

    this.loading = true;
    this.error = null;

    const formValues = this.form.getRawValue();

    // Handle image
    if (this.pendingImageDeletion) {
      formValues.image_path = '';
    } else if (this.imagePreview && this.imagePreview.startsWith('data:')) {
      formValues.image_path = this.imagePreview;
    } else if (this.selectedPlant?.image_path) {
      formValues.image_path = this.selectedPlant.image_path;
    } else {
      formValues.image_path = '';
    }

    console.log('Saving plant:', { 
      id: formValues.id,
      nombre: formValues.nombre, 
      image_path: formValues.image_path ? (formValues.image_path.startsWith('data:') ? '[base64 image]' : formValues.image_path) : '[empty]',
      email: formValues.email || '[empty]'
    });

    this.plantsFichaService.savePlant(formValues)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          console.log('✓ Plant saved successfully:', response);

          const savedPlantId = Number(response?.id || formValues.id || this.selectedPlant?.id);

          this.plantsFichaService.getAllPlants()
            .pipe(takeUntil(this.destroy$))
            .subscribe({
              next: (plants) => {
                this.plants = plants;
              },
              error: (listError) => {
                console.error('Error reloading plants list:', listError);
              }
            });

          if (!savedPlantId) {
            this.loading = false;
            this.isEditing = false;
            this.isCreating = false;
            this.pendingImageDeletion = false;
            this.originalImagePreview = null;
            this.selectedImageFile = null;
            return;
          }

          this.plantsFichaService.getPlant(savedPlantId)
            .pipe(takeUntil(this.destroy$))
            .subscribe({
              next: (updatedPlant) => {
                this.loading = false;
                this.selectedPlant = updatedPlant;
                this.viewPlant(updatedPlant);
                this.pendingImageDeletion = false;
                this.originalImagePreview = null;
                this.selectedImageFile = null;
              },
              error: (reloadError) => {
                this.loading = false;
                this.error = 'Guardó, pero no se pudo recargar la planta: ' + (reloadError.error?.error || reloadError.message);
                console.error('Error reloading saved plant:', reloadError);
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

  deletePlant() {
    if (!this.selectedPlant?.id) return;

    if (confirm('¿Estás seguro de que deseas eliminar esta planta?\n\nLos calderos asociados a esta planta también serán eliminados.')) {
      this.loading = true;
      this.plantsFichaService.deletePlant(this.selectedPlant.id)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (response) => {
            this.loading = false;
            console.log('✓ Plant deleted successfully');
            this.loadPlants();
            this.form.reset();
            this.imagePreview = null;
            this.selectedPlant = null;
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

  backToList() {
    if (this.plants.length > 0) {
      this.form.reset();
      this.selectedPlant = null;
      this.imagePreview = null;
      this.isViewing = false;
    }
  }
}
