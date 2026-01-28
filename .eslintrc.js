/*
 Copyright 2026 Carnegie Mellon University. All Rights Reserved.
 Released under a MIT (SEI)-style license. See LICENSE.md in the
 project root for license information.
*/

module.exports = {
  "root": true,
  "ignorePatterns": ["projects/**/*", "src/app/generated/**/*"],
  "overrides": [
    {
      "files": ["*.ts"],
      "extends": [
        "eslint:recommended",
        "plugin:@typescript-eslint/recommended",
        "plugin:@angular-eslint/recommended",
        "plugin:@angular-eslint/template/process-inline-templates"
      ],
      "rules": {
        "@angular-eslint/directive-selector": [
          "error",
          {
            "type": "attribute",
            "prefix": "app",
            "style": "camelCase"
          }
        ],
        "@angular-eslint/component-selector": [
          "error",
          {
            "type": "element",
            "prefix": "app",
            "style": "kebab-case"
          }
        ]
      }
    },
    {
      "files": ["*.html"],
      "extends": [
        "plugin:@angular-eslint/template/recommended",
        "plugin:@angular-eslint/template/accessibility"
      ],
      "rules": {
        "@angular-eslint/template/eqeqeq": [
          "error",
          {
            "allowNullOrUndefined": true
          }
        ]
      }
    }
  ]
};
