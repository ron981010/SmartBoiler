import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { RouterModule, Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css'
})
export class LoginComponent {
  loginForm!: FormGroup;
  resetForm!: FormGroup;
  loading = false;
  error: string | null = null;
  successMsg: string | null = null;
  showReset = false;

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private authService: AuthService
  ) {
    this.initForm();
  }

  private initForm() {
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]]
    });
    this.resetForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      newPassword: ['', [Validators.required, Validators.minLength(6)]]
    });
  }

  toggleReset() {
    this.showReset = !this.showReset;
    this.error = null;
    this.successMsg = null;
  }

  onReset() {
    if (this.resetForm.invalid) return;
    this.loading = true;
    this.error = null;
    this.successMsg = null;
    const { email, newPassword } = this.resetForm.value;
    this.authService.resetPassword(email, newPassword).subscribe({
      next: () => {
        this.loading = false;
        this.successMsg = 'Contraseña actualizada. Ya puedes iniciar sesión.';
        this.showReset = false;
        this.loginForm.patchValue({ email });
      },
      error: (err) => {
        this.loading = false;
        this.error = err?.error?.error || 'Error al restablecer la contraseña.';
      }
    });
  }

  onSubmit() {
    if (this.loginForm.invalid) {
      this.error = 'Por favor completa los datos correctamente';
      return;
    }

    this.loading = true;
    this.error = null;

    const { email, password } = this.loginForm.value;

    this.authService.login({ email, password }).subscribe({
      next: (response) => {
        this.loading = false;
        // Save user to localStorage for display
        localStorage.setItem('user', JSON.stringify(response.user));
        this.router.navigate(['/dashboard']);
      },
      error: (error) => {
        this.loading = false;
        this.error = error?.error?.message || 'Error al iniciar sesión. Intenta nuevamente.';
        console.error('Login error:', error);
      }
    });
  }

  goToSignup() {
    this.router.navigate(['/signup']);
  }

  socialLogin(provider: string) {
    console.log('Social login:', provider);
    // TODO: Implement social login
  }
}
