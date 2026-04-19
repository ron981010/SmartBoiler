import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { RouterModule, Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-signup',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './signup.component.html',
  styleUrl: './signup.component.css'
})
export class SignupComponent {
  signupForm!: FormGroup;
  loading = false;
  error: string | null = null;
  termsAccepted = false;

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private authService: AuthService
  ) {
    this.initForm();
  }

  private initForm() {
    this.signupForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', [Validators.required]],
      terms: [false, [Validators.requiredTrue]]
    }, { validators: this.passwordMatchValidator() });
  }

  private passwordMatchValidator() {
    return (control: AbstractControl): ValidationErrors | null => {
      const password = control.get('password')?.value;
      const confirmPassword = control.get('confirmPassword')?.value;
      
      if (!password || !confirmPassword) {
        return null;
      }

      return password === confirmPassword ? null : { passwordMismatch: true };
    };
  }

  onSubmit() {
    if (this.signupForm.invalid) {
      this.error = 'Por favor completa todos los campos correctamente';
      return;
    }

    if (!this.signupForm.get('terms')?.value) {
      this.error = 'Debes aceptar los Términos de Servicio y la Política de Privacidad';
      return;
    }

    this.loading = true;
    this.error = null;

    const { email, password } = this.signupForm.value;

    this.authService.signup({ email, password }).subscribe({
      next: (response) => {
        this.loading = false;
        // Save user to localStorage for display
        localStorage.setItem('user', JSON.stringify(response.user));
        this.router.navigate(['/dashboard']);
      },
      error: (error) => {
        this.loading = false;
        this.error = error?.error?.message || 'Error al registrarse. Intenta nuevamente.';
        console.error('Signup error:', error);
      }
    });
  }

  goToLogin() {
    this.router.navigate(['/login']);
  }

  getPasswordError(): string | null {
    const password = this.signupForm.get('password');
    const confirmPassword = this.signupForm.get('confirmPassword');

    if (password?.hasError('required')) {
      return 'La contraseña es requerida';
    }
    if (password?.hasError('minlength')) {
      return 'Mínimo 6 caracteres';
    }
    if (confirmPassword?.touched && this.signupForm.hasError('passwordMismatch')) {
      return 'Las contraseñas no coinciden';
    }

    return null;
  }
}
