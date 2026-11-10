/*
Copyright 2022 Carnegie Mellon University. All Rights Reserved.
 Released under a MIT (SEI)-style license. See LICENSE.md in the
// project root for license information.
*/

/*
 {{ originalHtmlText | plainText }}
*/
import { Pipe, PipeTransform } from '@angular/core';

@Pipe({ name: 'plainText' })
export class PlainTextPipe implements PipeTransform{

  constructor() { }

  transform(text: string ) {

    if (!text) {
      return text;
    }

    const plainText = text.replace(/<(?:.|\n)*?>/gm, ' ');

    return plainText;
  }

}
