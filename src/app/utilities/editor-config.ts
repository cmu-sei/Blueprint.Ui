// Copyright 2022 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the
// project root for license information.
import { AngularEditorConfig } from '@kolkov/angular-editor';

const EDITOR_FONTS = [
  { class: 'arial', name: 'Arial' },
  { class: 'times-new-roman', name: 'Times New Roman' },
  { class: 'calibri', name: 'Calibri' },
  { class: 'comic-sans-ms', name: 'Comic Sans MS' },
];

/**
 * Standard angular-editor configuration for editing rich text.
 */
export const EDITOR_CONFIG: AngularEditorConfig = {
  editable: true,
  spellcheck: true,
  height: 'auto',
  minHeight: '0',
  maxHeight: 'auto',
  width: 'auto',
  minWidth: '0',
  translate: 'yes',
  enableToolbar: true,
  showToolbar: true,
  placeholder: 'Enter text here...',
  defaultParagraphSeparator: '',
  defaultFontName: '',
  defaultFontSize: '',
  fonts: EDITOR_FONTS,
  uploadUrl: '',
  uploadWithCredentials: false,
  sanitize: false,
  toolbarPosition: 'top',
  toolbarHiddenButtons: [['backgroundColor']],
};

/**
 * Editing configuration that wraps content in paragraphs and offers a
 * left-align class, for content whose alignment is authored by the user.
 */
export const EDITOR_CONFIG_PARAGRAPH: AngularEditorConfig = {
  ...EDITOR_CONFIG,
  defaultParagraphSeparator: 'p',
  customClasses: [
    {
      name: 'Left Aligned',
      class: 'text-left',
      tag: 'p',
    },
  ],
};

/**
 * Standard angular-editor configuration for displaying read-only rich text.
 * Fills the width of its container and reserves a tall viewing area.
 */
export const VIEW_CONFIG: AngularEditorConfig = {
  editable: false,
  height: 'auto',
  minHeight: '1200px',
  width: '100%',
  minWidth: '0',
  translate: 'yes',
  enableToolbar: false,
  showToolbar: false,
  placeholder: '',
  defaultParagraphSeparator: '',
  defaultFontName: '',
  defaultFontSize: '',
  sanitize: false,
};

/**
 * Read-only configuration that sizes itself to its content rather than
 * reserving a fixed viewing area.
 */
export const VIEW_CONFIG_AUTO_SIZE: AngularEditorConfig = {
  ...VIEW_CONFIG,
  minHeight: '0',
  maxHeight: 'auto',
  width: 'auto',
};
