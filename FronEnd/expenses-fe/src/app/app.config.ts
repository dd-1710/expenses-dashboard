import { ApplicationConfig, importProvidersFrom, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';
import { routes } from './app.routes';
import { FontAwesomeModule,FaIconLibrary } from '@fortawesome/angular-fontawesome';
import { faWallet } from '@fortawesome/free-solid-svg-icons';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    {
      provide: FaIconLibrary,
      useFactory: () => {
        const library = new FaIconLibrary();
        library.addIcons(faWallet);
        return library;
      }
    }

  ]

};

 const library = new FaIconLibrary
 library.addIcons(faWallet)
