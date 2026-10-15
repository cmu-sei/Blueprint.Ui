# BlueprintUi

This project was generated with [Angular CLI](https://github.com/angular/angular-cli) and now uses Angular CLI version 21 (Angular 21.2). Node `^20.19.0 || ^22.12.0 || >=24.0.0` is required; the Dockerfile and CI use Node 24.

## Documentation

[Blueprint Documentation](https://cmu-sei.github.io/crucible/blueprint/)

## Color Theming

Blueprint uses a monochrome gray Material 3 SCSS palette with runtime top-bar color overrides from `settings.json`.

### Changing the top bar color

| File | Field / Value | Purpose |
|------|---------------|---------|
| `src/assets/config/settings.json` | `"AppTopBarHexColor": "#007CB5"` | Runtime config -- top bar background color |
| `src/assets/config/settings.json` | `"AppTopBarHexTextColor": "#FFFFFF"` | Runtime config -- top bar text color |
| `src/app/app.module.ts` | `provideCrucibleTheme({ brand: { color: '#007CB5', text: '#FFFFFF' } })` | Runtime fallbacks when settings are not provided |

To change the top bar color for a deployment, update `AppTopBarHexColor` and `AppTopBarHexTextColor` in `settings.json`, or set them in `settings.env.json`, which the app merges over `settings.json` and `settings.shared.json` at startup.

## Development server

Run `npm start` (`ng serve`) for a dev server. Navigate to `http://localhost:4725/`. The app will automatically reload if you change any of the source files.

## Code scaffolding

Run `ng generate component component-name` to generate a new component. You can also use `ng generate directive|pipe|service|class|guard|interface|enum|module`.

## Build

Run `npm run build` (`ng build`) to build the project. The build artifacts will be stored in the `dist/browser` directory. Without a configuration the build is unoptimized; use `--configuration production` for a production build.

## Running unit tests

Unit tests run on Vitest through Angular's `@angular/build:unit-test` builder, following the
Crucible UI test standard.

```bash
npm test                # run every spec once
npm run test:watch      # re-run on change
npm run test:coverage   # run once with coverage and enforce the thresholds in angular.json
```

The shared test helpers (`renderComponent`, the default providers, API stub types, the SignalR fake,
the permission providers) are in `src/app/test-utils/`.

## Running end-to-end tests

End-to-end tests for Blueprint are the Playwright tests in the [crucible-tests](https://github.com/cmu-sei/crucible-tests) repository (`blueprint/`). They run against a running Crucible stack; from that repository, run `./run-tests.sh blueprint`. See its README for setup.

## Further help

To get more help on the Angular CLI use `ng help` or go check out the [Angular CLI README](https://github.com/angular/angular-cli/blob/main/README.md).
