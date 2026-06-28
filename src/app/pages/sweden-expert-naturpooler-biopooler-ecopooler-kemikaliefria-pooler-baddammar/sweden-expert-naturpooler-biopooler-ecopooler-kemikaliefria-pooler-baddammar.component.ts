import { ChangeDetectionStrategy, Component, LOCALE_ID, inject } from '@angular/core';

@Component({
  selector: 'fp-sweden-expert-naturpooler-biopooler-ecopooler-kemikaliefria-pooler-baddammar',
  templateUrl: './sweden-expert-naturpooler-biopooler-ecopooler-kemikaliefria-pooler-baddammar.html',
  styles: [':host { display: contents; }'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SwedenExpertNaturpoolerBiopoolerEcopoolerKemikaliefriaPoolerBaddammarComponent {
  protected readonly en = inject(LOCALE_ID).toLowerCase().startsWith('en');
}
