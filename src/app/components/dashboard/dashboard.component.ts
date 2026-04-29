import { Component, OnInit, OnDestroy, AfterViewChecked, Renderer2 } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { EvaluationService, Evaluation } from '../../services/evaluation.service';
import { CompanyFichaService } from '../../services/company-ficha.service';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import * as ApexCharts from 'apexcharts';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css']
})
export class DashboardComponent implements OnInit, OnDestroy, AfterViewChecked {
  userEmail = '';
  companyName = '';
  companyImageUrl: string | null = null;
  evaluations: Evaluation[] = [];
  loading = false;
  error: string | null = null;
  menuOpen = false;
  showArchive = false;
  private destroy$ = new Subject<void>();
  private evaluationChart: any;
  private trendChart: any;

  constructor(
    private router: Router,
    private authService: AuthService,
    private evaluationService: EvaluationService,
    private companyFichaService: CompanyFichaService
    , private renderer: Renderer2
  ) {}

  private _portedArchiveEl: HTMLElement | null = null;
  private _portedOverlayEl: HTMLElement | null = null;

  ngOnInit() {
    // Ensure menu is closed on init to avoid visible sliver
    this.menuOpen = false;
    // Small safeguard in case other lifecycle hooks toggle it
    setTimeout(() => { this.menuOpen = false; }, 40);

    // Get current user email
    const user = this.authService.getCurrentUser();
    this.userEmail = user?.email || 'usuario@email.com';

    this.loadCompanyAndInitializeDashboard();
  }

  private loadCompanyAndInitializeDashboard() {
    this.companyFichaService.getCompanyFicha()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (company) => {
          const companyName = (company?.empresa || '').trim();
          if (!companyName) {
            this.router.navigate(['/company-ficha']);
            return;
          }

          this.companyName = companyName;
          this.companyImageUrl = this.resolveCompanyImageUrl(company?.image_path);
          this.loadEvaluations();

          // Initialize charts after a small delay to ensure DOM is ready
          setTimeout(() => {
            this.initializeCharts();
          }, 500);
        },
        error: () => {
          // If company ficha does not exist yet, force first step to company form
          this.router.navigate(['/company-ficha']);
        }
      });
  }

  private resolveCompanyImageUrl(imagePath?: string): string | null {
    if (!imagePath) return null;
    if (imagePath.startsWith('data:')) return imagePath;
    return `/uploads/${imagePath}`;
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
    if (this.evaluationChart) {
      this.evaluationChart.destroy();
    }
    if (this.trendChart) {
      this.trendChart.destroy();
    }
  }

  ngAfterViewChecked(): void {
    // If archive overlay/panel are present, move them to document.body so
    // `position: fixed` anchors to the viewport and is unaffected by animated
    // transforms on ancestor nodes.
    try {
      const overlay = document.querySelector('.archive-overlay') as HTMLElement | null;
      if (overlay && overlay !== this._portedOverlayEl) {
        document.body.appendChild(overlay);
        this._portedOverlayEl = overlay;
      }

      const panel = document.querySelector('.archive-panel') as HTMLElement | null;
      if (panel && panel !== this._portedArchiveEl) {
        document.body.appendChild(panel);
        this._portedArchiveEl = panel;
      }
    } catch (e) {
      // ignore timing errors
    }
  }

  private loadEvaluations() {
    this.loading = true;
    this.error = null;

    this.evaluationService.getAllEvaluations()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (evaluations) => {
          this.loading = false;
          this.evaluations = evaluations;
        },
        error: (error) => {
          this.loading = false;
          console.error('Error loading evaluations:', error);
        }
      });
  }

  private initializeCharts() {
    // Evaluation Pie Chart
    const evaluationChartElement = document.getElementById('evaluationChart');
    if (evaluationChartElement) {
      this.evaluationChart = new (ApexCharts as any)(evaluationChartElement, {
        series: [45, 30, 25],
        chart: {
          type: 'donut',
          width: '100%',
          height: 160,
          sparkline: {
            enabled: false
          }
        },
        colors: ['#d4a574', '#f4a460', '#daa520'],
        dataLabels: {
          enabled: false
        },
        legend: {
          show: false
        },
        tooltip: {
          theme: 'light'
        }
      });
      try {
        this.evaluationChart.render();
      } catch (err) {
        console.warn('ApexCharts evaluationChart render error:', err);
      }
    }

    // Trend Line Chart
    const trendChartElement = document.getElementById('trendChart');
    if (trendChartElement) {
      this.trendChart = new (ApexCharts as any)(trendChartElement, {
        series: [{
          name: 'Eficiencia',
          data: [65, 68, 72, 75, 78, 82, 85, 88]
        }],
        chart: {
          type: 'area',
          width: '100%',
          height: 200,
          sparkline: {
            enabled: false
          },
          toolbar: {
            show: false
          }
        },
        colors: ['#5b9cff'],
        fill: {
          type: 'gradient',
          gradient: {
            shadeIntensity: 1,
            opacityFrom: 0.45,
            opacityTo: 0.05,
            stops: [20, 100, 100, 100]
          }
        },
        dataLabels: {
          enabled: false
        },
        stroke: {
          curve: 'smooth',
          width: 2
        },
        xaxis: {
          labels: {
            show: true,
            style: {
              fontSize: '11px',
              color: '#999'
            }
          },
          categories: ['Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic', 'Ene']
        },
        yaxis: {
          labels: {
            show: true,
            style: {
              fontSize: '11px',
              color: '#999'
            }
          },
          min: 60,
          max: 100
        },
        tooltip: {
          theme: 'light'
        }
      });
      try {
        this.trendChart.render();
      } catch (err) {
        console.warn('ApexCharts trendChart render error:', err);
      }
    }
  }

  viewFicha(type: string) {
    console.log('View ficha:', type);
    // Navigate to appropriate ficha
    if (type === 'empresa') {
      this.router.navigate(['/company-ficha']);
    } else if (type === 'plantas') {
      this.router.navigate(['/plants-ficha']);
    } else if (type === 'calderas') {
      this.router.navigate(['/calderos-ficha']);
    } else {
      this.router.navigate(['/new-evaluation']);
    }
  }

  createNewEvaluation() {
    console.log('Create new evaluation');
    this.router.navigate(['/new-evaluation']);
  }

  searchEvaluations() {
    this.showArchive = true;
  }

  closeArchive() {
    this.showArchive = false;
  }

  getEvaluationDate(ev: Evaluation): string {
    const raw = (ev as any).createdAt || (ev as any).created_at;
    if (!raw) return '—';
    const iso = raw.includes('T') ? raw : raw.replace(' ', 'T');
    const d = new Date(iso);
    if (isNaN(d.getTime())) return raw.slice(0, 10) || '—';
    return d.toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  getEvaluationHour(ev: Evaluation): string {
    const raw = (ev as any).createdAt || (ev as any).created_at;
    if (!raw) return '';
    const iso = raw.includes('T') ? raw : raw.replace(' ', 'T');
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
  }

  getEficiencia(ev: Evaluation): string {
    try {
      const rs = (ev as any).resultsSummary;
      const efi = rs?.graficoEficiencia;
      return efi !== undefined && efi !== null ? efi + '%' : '—';
    } catch { return '—'; }
  }

  getR1A(ev: Evaluation): string {
    try {
      const rs = (ev as any).resultsSummary;
      return rs?.com?.R1A ?? '—';
    } catch { return '—'; }
  }

  deleteEvaluation(ev: Evaluation, event: Event) {
    event.stopPropagation();
    if (!confirm('¿Eliminar esta evaluación?')) return;
    this.evaluationService.deleteEvaluation(String(ev.id)).subscribe({
      next: () => {
        this.evaluations = this.evaluations.filter(e => e.id !== ev.id);
      },
      error: (err) => console.error('Error al eliminar:', err)
    });
  }

  toggleMenu() {
    this.menuOpen = !this.menuOpen;
  }

  getUserInitial(): string {
    if (!this.userEmail) return 'I';
    return this.userEmail.charAt(0).toUpperCase();
  }

  logout() {
    this.menuOpen = false;
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}
