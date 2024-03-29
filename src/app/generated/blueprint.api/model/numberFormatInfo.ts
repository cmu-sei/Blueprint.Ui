/*
Copyright 2022 Carnegie Mellon University. All Rights Reserved. 
 Released under a MIT (SEI)-style license. See LICENSE.md in the
// project root for license information.
*/

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
import { DigitShapes } from './digitShapes';


export interface NumberFormatInfo { 
    currencyDecimalDigits?: number;
    currencyDecimalSeparator?: string;
    readonly isReadOnly?: boolean;
    currencyGroupSizes?: Array<number>;
    numberGroupSizes?: Array<number>;
    percentGroupSizes?: Array<number>;
    currencyGroupSeparator?: string;
    currencySymbol?: string;
    naNSymbol?: string;
    currencyNegativePattern?: number;
    numberNegativePattern?: number;
    percentPositivePattern?: number;
    percentNegativePattern?: number;
    negativeInfinitySymbol?: string;
    negativeSign?: string;
    numberDecimalDigits?: number;
    numberDecimalSeparator?: string;
    numberGroupSeparator?: string;
    currencyPositivePattern?: number;
    positiveInfinitySymbol?: string;
    positiveSign?: string;
    percentDecimalDigits?: number;
    percentDecimalSeparator?: string;
    percentGroupSeparator?: string;
    percentSymbol?: string;
    perMilleSymbol?: string;
    nativeDigits?: Array<string>;
    digitSubstitution?: DigitShapes;
}
