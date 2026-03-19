# BlueprintUi

This project was generated with [Angular CLI](https://github.com/angular/angular-cli) version 9.1.

## Documentation

[Blueprint Documentation](https://cmu-sei.github.io/crucible/blueprint/)

## Color Theming

Blueprint uses a monochrome gray Material 3 SCSS palette with runtime top-bar color overrides from `settings.json`.

### Changing the top bar color

| File | Field / Value | Purpose |
|------|---------------|---------|
| `src/assets/config/settings.json` | `"AppTopBarHexColor": "#007CB5"` | Runtime config -- top bar background color |
| `src/assets/config/settings.json` | `"AppTopBarHexTextColor": "#FFFFFF"` | Runtime config -- top bar text color |
| `src/app/app.component.ts` | `'#C41230'` / `'#FFFFFF'` fallbacks in `setTheme()` | Runtime fallbacks when settings are not provided |

To change the top bar color for a deployment, update `AppTopBarHexColor` and `AppTopBarHexTextColor` in `settings.json`.

## Development server

Run `ng serve` for a dev server. Navigate to `http://localhost:4725/`. The app will automatically reload if you change any of the source files.

## Code scaffolding

Run `ng generate component component-name` to generate a new component. You can also use `ng generate directive|pipe|service|class|guard|interface|enum|module`.

## Build

Run `ng build` to build the project. The build artifacts will be stored in the `dist/` directory. Use the `--prod` flag for a production build.

## Running unit tests

Blueprint UI uses **Vitest** with `@testing-library/angular`. Test files use the `.vitest.ts` extension.

```bash
npm test                    # Run all tests (jsdom, fast)
npm run test:watch          # Watch mode
npm run test:coverage       # With coverage report
npm run test:browser        # Run in headless Chromium via Playwright
```

### Permission Tests

Comprehensive permission tests verify UI gating for all 26 system permissions:

| File | Coverage |
|------|----------|
| `src/app/test-utils/mock-permission-data.service.ts` | `permissionProvider()` factory for component tests |
| `src/app/data/permission/permission-data.service.vitest.ts` | All 26 `SystemPermission` values, `canViewAdministration()` edge cases |

Key patterns tested:
- All 26 `SystemPermission` enum values: granted → `true`, missing → `false`
- `canViewAdministration()` returns `true` for any `View*` permission, `false` for `Manage*`/`Create*` only

## Running end-to-end tests with Playwright

One time from powershell to install playwright and playwright browsers on windows managed laptop:
  set this environment variable on your system:  PLAYWRIGHT_BROWSERS_PATH="C:\SEI\Tools\ms-playwright"
  cd Blueprint.Ui
  npm install
  npx playwright install

  npx playwright test
    Runs the end-to-end tests.

  npx playwright test --debug
    Runs the tests in debug mode.

## Further help

To get more help on the Angular CLI use `ng help` or go check out the [Angular CLI README](https://github.com/angular/angular-cli/blob/master/README.md).
