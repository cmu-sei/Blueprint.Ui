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
import { CalendarAlgorithmType } from './calendarAlgorithmType';


export interface Calendar { 
    readonly minSupportedDateTime?: Date;
    readonly maxSupportedDateTime?: Date;
    algorithmType?: CalendarAlgorithmType;
    readonly isReadOnly?: boolean;
    readonly eras?: Array<number>;
    twoDigitYearMax?: number;
}
