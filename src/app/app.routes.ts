import { Routes } from '@angular/router';
import { LoginComponent } from './components/login/login.component';
import { SignupComponent } from './components/signup/signup.component';
import { DashboardComponent } from './components/dashboard/dashboard.component';
import { EnergyFormComponent } from './energy-form/energy-form.component';
import { CompanyFichaComponent } from './components/company-ficha/company-ficha.component';
import { PlantsFichaComponent } from './components/plants-ficha/plants-ficha.component';
import { CalderosComponent } from './components/calderos-ficha/calderos-ficha.component';
import { AuthGuard } from './guards/auth.guard';

export const routes: Routes = [
  {
    path: '',
    redirectTo: '/dashboard',
    pathMatch: 'full'
  },
  {
    path: 'login',
    component: LoginComponent,
    data: { animation: 'LoginPage' }
  },
  {
    path: 'signup',
    component: SignupComponent,
    data: { animation: 'SignupPage' }
  },
  {
    path: 'dashboard',
    component: DashboardComponent,
    canActivate: [AuthGuard],
    data: { animation: 'DashboardPage' }
  },
  {
    path: 'new-evaluation',
    component: EnergyFormComponent,
    canActivate: [AuthGuard],
    data: { animation: 'NewEvaluationPage' }
  },
  {
    path: 'company-ficha',
    component: CompanyFichaComponent,
    canActivate: [AuthGuard],
    data: { animation: 'CompanyFichaPage' }
  },
  {
    path: 'plants-ficha',
    component: PlantsFichaComponent,
    canActivate: [AuthGuard],
    data: { animation: 'PlantsFichaPage' }
  },
  {
    path: 'calderos-ficha',
    component: CalderosComponent,
    canActivate: [AuthGuard],
    data: { animation: 'CalderosPage' }
  },
  {
    path: '**',
    redirectTo: '/login'
  }
];
