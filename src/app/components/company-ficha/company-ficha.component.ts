import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { CompanyFichaService, CompanyFicha } from '../../services/company-ficha.service';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

// CIIU Data
const CIIU_OPTIONS = [
  { code: 'A', description: 'Agricultura, Ganadería, Silvicultura y Pesca' },
  { code: 'B', description: 'Explotación de Minas y Canteras' },
  { code: 'C', description: 'Industrias Manufactureras' },
  { code: 'D', description: 'Suministro de Electricidad, Gas, Vapor y Aire acondicionado' },
  { code: 'E', description: 'Distribución de Agua; Gestión de Desechos y Actividades de Saneamiento' },
  { code: 'F', description: 'Construcción' },
  { code: 'G', description: 'Comercio; Reparación de vehículos automotores y motocicletas' },
  { code: 'H', description: 'Transporte y Almacenamiento' },
  { code: 'I', description: 'Actividades de Alojamiento y de Servicio de comidas' },
  { code: 'J', description: 'Información y Comunicación' },
  { code: 'K', description: 'Actividades Financieras y de Seguros' },
  { code: 'L', description: 'Actividades Inmobiliarias' },
  { code: 'M', description: 'Actividades Profesionales, Científicas y Técnicas' },
  { code: 'N', description: 'Actividades de Servicios Administrativos y de Apoyo' },
  { code: 'O', description: 'Administración Pública y Defensa y Planes de Seguridad Social' },
  { code: 'P', description: 'Enseñanza' },
  { code: 'Q', description: 'Actividades de atención de la Salud humana y de Asistencia social' },
  { code: 'R', description: 'Artes, Entretenimiento y Recreación' },
  { code: 'S', description: 'Otras actividades de Servicios' },
  { code: 'T', description: 'Actividades de Hogares (Bienes y Servicios para Uso propio)' },
  { code: 'U', description: 'Actividades de Organizaciones y Órganos Extraterritoriales' }
];

// Peru Departments and Provinces
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
  selector: 'app-company-ficha',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './company-ficha.component.html',
  styleUrl: './company-ficha.component.css'
})
export class CompanyFichaComponent implements OnInit, OnDestroy {
  form!: FormGroup;
  loading = false;
  error: string | null = null;
  isEditing = false;
  isLoadingData = false;
  ficha: CompanyFicha | null = null;
  private destroy$ = new Subject<void>();

  // Data for dropdowns
  ciuuOptions = CIIU_OPTIONS;
  departments = Object.keys(PERU_DEPARTMENTS).sort();
  filteredProvinces: string[] = [];
  selectedImageFile: File | null = null;
  imagePreview: string | null = null;
  private originalImagePreview: string | null = null; // Store original image on edit
  private pendingImageDeletion = false;

  constructor(
    private fb: FormBuilder,
    private companyFichaService: CompanyFichaService,
    private router: Router
  ) {
    this.initializeForm();
  }

  ngOnInit() {
    this.loadCompanyFicha();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private initializeForm() {
    this.form = this.fb.group({
      empresa: ['', Validators.required],
      ciiu: ['', Validators.required],
      ciiu_description: [''],
      avenue: [''],
      avenue_number: [''],
      avenue_address: [''],
      district: ['', Validators.required],
      department: ['Lima', Validators.required],
      province: ['Lima', Validators.required],
      website: [''],
      image_path: ['']
    });

    // Subscribe to department changes to filter provinces
    this.form.get('department')?.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(department => {
        this.updateProvincesList(department);
      });

    // Initialize provinces for default department
    this.updateProvincesList('Lima');
  }

  private updateProvincesList(department: string) {
    this.filteredProvinces = PERU_DEPARTMENTS[department] || [];
    // Reset province if not in filtered list
    const currentProvince = this.form.get('province')?.value;
    if (!this.filteredProvinces.includes(currentProvince)) {
      this.form.patchValue({ province: this.filteredProvinces[0] || '' });
    }
  }

  private loadCompanyFicha() {
    this.isLoadingData = true;
    this.error = null;

    this.companyFichaService.getCompanyFicha()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (ficha) => {
          this.isLoadingData = false;
          this.ficha = ficha;
          this.form.patchValue(ficha);
          
          // Load image if it exists
          if (ficha.image_path && !ficha.image_path.startsWith('data:')) {
            // It's a filename, construct the URL
            this.imagePreview = `/uploads/${ficha.image_path}`;
          }
          
          this.form.disable(); // Disable form initially for view mode
        },
        error: (error) => {
          this.isLoadingData = false;
          // Ficha doesn't exist yet, enable form for creation
          this.form.enable();
          console.log('No company ficha found, ready to create');
        }
      });
  }

  onEdit() {
    this.isEditing = true;
    this.form.enable();
    // Save current image state to restore if user cancels
    this.originalImagePreview = this.imagePreview;
    this.pendingImageDeletion = false;
  }

  onCancel() {
    this.isEditing = false;
    this.pendingImageDeletion = false;
    this.form.disable();
    
    // Restore form data from saved ficha
    if (this.ficha) {
      this.form.patchValue(this.ficha);
    }
    
    // Restore original image state (before editing started)
    this.imagePreview = this.originalImagePreview;
    this.originalImagePreview = null;
    this.clearImagePreview();
  }

  onImageSelected(event: any) {
    if (!this.isEditing) {
      return;
    }

    const file: File = event.target.files[0];
    if (file) {
      this.selectedImageFile = file;
      this.pendingImageDeletion = false;
      // Create preview - this will be a base64 string
      const reader = new FileReader();
      reader.onload = (e: any) => {
        this.imagePreview = e.target.result;
      };
      reader.readAsDataURL(file);
    }
  }

  clearImagePreview() {
    this.selectedImageFile = null;
    // Only clear if it's a newly selected base64 image (from file input)
    // Don't clear if it's a saved image URL
    if (this.imagePreview && this.imagePreview.startsWith('data:')) {
      this.imagePreview = null;
    }
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    if (fileInput) {
      fileInput.value = '';
    }
  }

  deleteImage() {
    if (!this.isEditing) {
      return;
    }

    if (!this.imagePreview) {
      // No image to delete
      return;
    }

    this.pendingImageDeletion = true;
    this.imagePreview = null;
    this.clearImagePreview();
  }

  onSave() {
    if (this.form.invalid) {
      this.error = 'Por favor completa todos los campos requeridos';
      return;
    }

    this.loading = true;
    this.error = null;

    const formValues = this.form.getRawValue();
    formValues.avenue_address = '';
    
    // Find CIIU description from selected code
    if (formValues.ciiu) {
      const ciuuItem = this.ciuuOptions.find(c => c.code === formValues.ciiu);
      if (ciuuItem) {
        formValues.ciiu_description = ciuuItem.description;
      }
    }

    // Handle image: pending deletion, new selection, or no change
    if (this.pendingImageDeletion) {
      formValues.image_path = '';
    } else if (this.imagePreview && this.imagePreview.startsWith('data:')) {
      // New image selected (base64 data)
      formValues.image_path = this.imagePreview;
    } else {
      // Image URL from server - no change to image
      formValues.image_path = this.ficha?.image_path || '';
    }

    console.log('Sending company ficha data:', { 
      ...formValues, 
      image_path: formValues.image_path ? (formValues.image_path.startsWith('data:') ? `[base64 image - ${(formValues.image_path.length / 1024).toFixed(2)}KB]` : formValues.image_path) : '[empty]'
    });

    this.companyFichaService.saveCompanyFicha(formValues)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.loading = false;
          
          // Reload ficha to get the saved data from server
          this.companyFichaService.getCompanyFicha()
            .pipe(takeUntil(this.destroy$))
            .subscribe({
              next: (updatedFicha) => {
                this.ficha = updatedFicha;
                this.form.patchValue(updatedFicha);
                
                // Update image preview from saved data
                if (updatedFicha.image_path && !updatedFicha.image_path.startsWith('data:')) {
                  // Load image from server
                  this.imagePreview = `/uploads/${updatedFicha.image_path}`;
                } else {
                  this.imagePreview = null;
                }
                
                this.pendingImageDeletion = false;
                this.originalImagePreview = null;
                this.isEditing = false;
                this.form.disable();
                console.log('✓ Company ficha saved successfully');
              },
              error: (error) => {
                console.error('Error reloading ficha:', error);
              }
            });
        },
        error: (error) => {
          this.loading = false;
          this.error = 'Error al guardar: ' + (error.error?.error || error.message);
          console.error('❌ Save error:', error);
        }
      });
  }

  goBack() {
    this.router.navigate(['/dashboard']);
  }
}
