# BlueprintUi

This project was generated with [Angular CLI](https://github.com/angular/angular-cli) version 9.1.

## Documentation

[Blueprint Documentation](https://cmu-sei.github.io/crucible/blueprint/)

## Development server

Run `ng serve` for a dev server. Navigate to `http://localhost:4725/`. The app will automatically reload if you change any of the source files.

## Code scaffolding

Run `ng generate component component-name` to generate a new component. You can also use `ng generate directive|pipe|service|class|guard|interface|enum|module`.

## Build

Run `ng build` to build the project. The build artifacts will be stored in the `dist/` directory. Use the `--prod` flag for a production build.

## Running unit tests

Run `ng test` to execute the unit tests via [Karma](https://karma-runner.github.io).

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

