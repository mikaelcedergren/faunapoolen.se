export const META_PIXEL_ID = '1698072815050895';
export type MetaEvent = 'PageView' | 'Lead';
type Pixel = ((...args: unknown[]) => void) & {
  callMethod?: (...args: unknown[]) => void;
  queue: unknown[][];
  push: Pixel;
  loaded: boolean;
  version: string;
  disablePushState: boolean;
};
type PixelWindow = Window & { fbq?: Pixel; _fbq?: Pixel };

/** The SDK is created only by an explicit marketing opt-in on the public origin. */
export class MetaPixel {
  private configured = false;
  private readonly document: Document;

  constructor(document: Document) {
    this.document = document;
  }

  send(event: MetaEvent): void {
    const browser = this.document.defaultView as PixelWindow | null;
    if (!browser || browser.location.origin !== 'https://faunapoolen.se') return;
    if (!this.configured) {
      this.configured = true;
      const pixel: Pixel = Object.assign(
        (...args: unknown[]) => {
          if (pixel.callMethod) pixel.callMethod(...args);
          else pixel.queue.push(args);
        },
        { queue: [] as unknown[][], loaded: true, version: '2.0', disablePushState: true },
      ) as Pixel;
      pixel.push = pixel;
      browser.fbq = browser._fbq = pixel;
      pixel('consent', 'revoke');
      pixel('set', 'autoConfig', false, META_PIXEL_ID);
      pixel('init', META_PIXEL_ID);
      const script = this.document.createElement('script');
      script.async = true;
      script.src = 'https://connect.facebook.net/en_US/fbevents.js';
      this.document.head.appendChild(script);
    }
    browser.fbq?.('consent', 'grant');
    browser.fbq?.('trackSingle', META_PIXEL_ID, event);
  }

  revoke(): void {
    const browser = this.document.defaultView as PixelWindow | null;
    const pixel = browser?.fbq;
    if (pixel) {
      // A visitor may withdraw while the SDK download is still pending.
      if (Array.isArray(pixel.queue))
        pixel.queue = pixel.queue.filter((args) => args[0] !== 'trackSingle');
      pixel('consent', 'revoke');
    }
    for (const name of ['_fbp', '_fbc']) {
      for (const domain of ['', '; domain=faunapoolen.se', '; domain=.faunapoolen.se']) {
        this.document.cookie = `${name}=; max-age=0; path=/${domain}; SameSite=Lax`;
      }
    }
  }
}
