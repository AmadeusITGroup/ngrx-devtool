import {
  Component,
  DestroyRef,
  inject,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { AsyncPipe } from '@angular/common';
import { filter, map, Observable, shareReplay } from 'rxjs';
import { SidenavComponent, SideNavLinksGroup } from '../components/sidenav';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, AsyncPipe, SidenavComponent],
  templateUrl: './app.html',
  styleUrls: ['./app.scss']
})
export class AppComponent {
  public title = 'NgRx DevTool';

  public linksGroups: SideNavLinksGroup[] = [
    {
      label: '',
      links: [
        { url: '/home', label: 'Home' },
        { url: '/features', label: 'Features' },
        { url: '/run-locally', label: 'Run app locally' }
      ]
    },
    {
      label: 'Getting Started',
      links: [
        { url: '/installation', label: 'Installation' },
        { url: '/configuration', label: 'Configuration' },
        { url: '/quick-start', label: 'Quick Start' },
        { url: '/how-it-works', label: 'How It Works' }
      ]
    },
    {
      label: 'Features',
      links: [
        { url: '/action-monitoring', label: 'Action Monitoring' },
        { url: '/effect-tracking', label: 'Effect Tracking' },
        { url: '/state-visualization', label: 'State Visualization' },
        { url: '/diff-viewer', label: 'Diff Viewer' },
        { url: '/performance', label: 'Performance' }
      ]
    },
    {
      label: 'Troubleshooting',
      links: [
        { url: '/common-issues', label: 'Troubleshooting' },
        { url: '/faq', label: 'FAQ' }
      ]
    }
  ];

  public activeUrl$: Observable<string>;

  private destroyRef = inject(DestroyRef);
  private router = inject(Router);

  constructor() {
    this.activeUrl$ = this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      map((event) => event.urlAfterRedirects),
      shareReplay(1),
      takeUntilDestroyed(this.destroyRef)
    );
  }
}

