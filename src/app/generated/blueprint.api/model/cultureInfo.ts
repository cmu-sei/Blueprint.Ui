/**
 * Blueprint API
 * No description provided (generated by Openapi Generator https://github.com/openapitools/openapi-generator)
 *
 * OpenAPI spec version: v1
 * 
 *
 * NOTE: This class is auto generated by OpenAPI Generator (https://openapi-generator.tech).
 * https://openapi-generator.tech
 * Do not edit the class manually.
 */
import { Calendar } from './calendar';
import { CompareInfo } from './compareInfo';
import { CultureTypes } from './cultureTypes';
import { DateTimeFormatInfo } from './dateTimeFormatInfo';
import { NumberFormatInfo } from './numberFormatInfo';
import { TextInfo } from './textInfo';


export interface CultureInfo { 
    parent?: CultureInfo;
    readonly lcid?: number;
    readonly keyboardLayoutId?: number;
    name?: string;
    readonly ietfLanguageTag?: string;
    readonly displayName?: string;
    readonly nativeName?: string;
    readonly englishName?: string;
    readonly twoLetterISOLanguageName?: string;
    readonly threeLetterISOLanguageName?: string;
    readonly threeLetterWindowsLanguageName?: string;
    compareInfo?: CompareInfo;
    textInfo?: TextInfo;
    readonly isNeutralCulture?: boolean;
    cultureTypes?: CultureTypes;
    numberFormat?: NumberFormatInfo;
    dateTimeFormat?: DateTimeFormatInfo;
    calendar?: Calendar;
    readonly optionalCalendars?: Array<Calendar>;
    useUserOverride?: boolean;
    readonly isReadOnly?: boolean;
}
