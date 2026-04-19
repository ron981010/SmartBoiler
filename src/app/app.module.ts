import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { ReactiveFormsModule } from '@angular/forms';

import { AppComponent } from './app.component';
import { EnergyFormComponent } from './energy-form/energy-form.component';

@NgModule({
  declarations: [],
  imports: [BrowserModule, ReactiveFormsModule, AppComponent, EnergyFormComponent],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule {}
