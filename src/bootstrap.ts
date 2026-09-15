import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/app.component';

export function bootstrap() {
  return bootstrapApplication(AppComponent, appConfig);
}
