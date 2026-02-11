import {
  ChangeDetectionStrategy,
  Component,
  Input,
  ViewEncapsulation,
} from '@angular/core';
import { RouterModule } from '@angular/router';

/** Link information */
export interface SideNavLink {
  /** Url of the link */
  url: string;
  /** Label to display */
  label: string;
}

/** Group of links */
export interface SideNavLinksGroup {
  /** Label of the group */
  label: string;
  /** List of links */
  links: SideNavLink[];
}

@Component({
  selector: 'app-sidenav',
  standalone: true,
  imports: [RouterModule],
  templateUrl: './sidenav.html',
  styleUrls: ['./sidenav.scss'],
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SidenavComponent {
  @Input() linksGroups: SideNavLinksGroup[] = [];
  @Input() activeUrl?: string;
}
