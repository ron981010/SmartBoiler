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
    component: LoginComponent
  },
  {
    path: 'signup',
    component: SignupComponent
  },
  {
    path: 'dashboard',
    component: DashboardComponent,
    canActivate: [AuthGuard]
  },
  {
    path: 'new-evaluation',
    component: EnergyFormComponent,
    canActivate: [AuthGuard]
  },
  {
    path: 'company-ficha',
    component: CompanyFichaComponent,
    canActivate: [AuthGuard]
  },
  {
    path: 'plants-ficha',
    component: PlantsFichaComponent,
    canActivate: [AuthGuard]
  },
  {
    path: 'calderos-ficha',
    component: CalderosComponent,
    canActivate: [AuthGuard]
  },
  {
    path: '**',
    redirectTo: '/login'
  }
];
