import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import {
  CxGridComponent,
  CxIconComponent,
  CxInlineComponent,
  CxStackComponent,
} from '@mikaelcedergren/cx-framework';

@Component({
  selector: 'fp-nature-pool-benefits',
  imports: [CxGridComponent, CxIconComponent, CxInlineComponent, CxStackComponent],
  templateUrl: './nature-pool-benefits.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NaturePoolBenefitsComponent {
  @Input() introduction?: string;
  protected readonly benefits = {
    eyebrow: $localize`:@@site.poolBenefits.eyebrow:Why choose a nature pool?`,
    heading: $localize`:@@site.poolBenefits.heading:Your own swimming spot, naturally.`,
    body: $localize`:@@site.poolBenefits.body:Step outside for a morning dip, bring everyone together for an afternoon swim, or unwind beside the water. Your nature pool becomes part of the garden, with natural stone and planting around your own swimming spot. We help you choose the size, shape and features that suit your space and the way you want to spend time outdoors.`,
    items: [
      {
        heading: $localize`:@@site.poolBenefits.chlorine.heading:Swim without routine chlorine treatment`,
        body: $localize`:@@site.poolBenefits.chlorine.body:Enjoy water cleaned by filtration and circulation, without the regular chlorine dosing of a conventional pool.`,
      },
      {
        heading: $localize`:@@site.poolBenefits.biology.heading:Let nature help clean your water`,
        body: $localize`:@@site.poolBenefits.biology.body:Beneficial bacteria filter waste while plants absorb nutrients, helping keep your swimming water in balance.`,
      },
      {
        heading: $localize`:@@site.poolBenefits.garden.heading:Make the pool part of your garden`,
        body: $localize`:@@site.poolBenefits.garden.body:Natural stone, planting and a shape suited to your space make your pool feel part of the garden.`,
      },
      {
        heading: $localize`:@@site.poolBenefits.environment.heading:Reduce your pool’s environmental impact`,
        body: $localize`:@@site.poolBenefits.environment.body:Efficient pumps and fewer water changes help save resources, while keeping chemical pool treatments out of your garden.`,
      },
    ],
  };
}
