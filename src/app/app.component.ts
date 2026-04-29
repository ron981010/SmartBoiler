import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { trigger, transition, style, query, animate, group } from '@angular/animations';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  templateUrl: './app.component.html',
  styles: [],
  animations: [
    trigger('routeAnimations', [
      transition('* <=> *', [
        query(':enter, :leave', style({ position: 'absolute', top: 0, left: 0, width: '100%' }), { optional: true }),
        query(':enter', style({ transform: 'translateX(10%) scale(0.995)', opacity: 0 }), { optional: true }),
        group([
          query(':leave', [
            animate('480ms cubic-bezier(.2,.8,.2,1)', style({ transform: 'translateX(-10%) scale(0.995)', opacity: 0 }))
          ], { optional: true }),
          query(':enter', [
            animate('640ms cubic-bezier(.2,.8,.2,1)', style({ transform: 'translateX(0)', opacity: 1 }))
          ], { optional: true })
        ])
      ])
    ])
  ]
})
export class AppComponent {
  prepareRoute(outlet: RouterOutlet) {
    // Avoid accessing `activatedRoute` when the outlet is not yet active
    if (!outlet || !('isActivated' in outlet) || !outlet.isActivated) return '';
    // Prefer explicit animation data set on the route
    const dataAnim = outlet.activatedRouteData?.['animation'];
    if (dataAnim) return dataAnim;
    // Fallback to snapshot url segments (works for routes without data)
    const snapshot = outlet.activatedRoute?.snapshot;
    if (snapshot) {
      const url = snapshot.url?.map(s => s.path).filter(Boolean).join('/');
      if (url) return url;
      const cfg = snapshot.routeConfig?.path;
      if (cfg) return cfg;
    }
    // Final fallback
    return outlet.activatedRoute?.routeConfig?.path || '';
  }
}
