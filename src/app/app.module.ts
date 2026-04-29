import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { ReactiveFormsModule } from '@angular/forms';

import { AppComponent } from './app.component';
import { EnergyFormComponent } from './energy-form/energy-form.component';

@NgModule({
  declarations: [],
  imports: [BrowserModule, BrowserAnimationsModule, ReactiveFormsModule, AppComponent, EnergyFormComponent],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule {}
