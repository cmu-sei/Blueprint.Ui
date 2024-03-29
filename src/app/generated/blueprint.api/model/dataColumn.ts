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
import { DataSetDateTime } from './dataSetDateTime';
import { DataTable } from './dataTable';
import { IContainer } from './iContainer';
import { ISite } from './iSite';
import { MappingType } from './mappingType';
import { Type } from './type';


export interface DataColumn { 
    site?: ISite;
    container?: IContainer;
    readonly designMode?: boolean;
    allowDBNull?: boolean;
    autoIncrement?: boolean;
    autoIncrementSeed?: number;
    autoIncrementStep?: number;
    caption?: string;
    columnName?: string;
    prefix?: string;
    dataType?: Type;
    dateTimeMode?: DataSetDateTime;
    defaultValue?: any;
    expression?: string;
    readonly extendedProperties?: { [key: string]: any; };
    maxLength?: number;
    namespace?: string;
    readonly ordinal?: number;
    readOnly?: boolean;
    table?: DataTable;
    unique?: boolean;
    columnMapping?: MappingType;
}
