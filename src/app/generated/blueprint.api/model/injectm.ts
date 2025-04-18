/*
 Copyright 2024 Carnegie Mellon University. All Rights Reserved.
 Released under a MIT (SEI)-style license. See LICENSE.md in the
 project root for license information.
*/

/**
 * Blueprint API
 * No description provided (generated by Openapi Generator https://github.com/openapitools/openapi-generator)
 *
 * The version of the OpenAPI document: v1
 *
 *
 * NOTE: This class is auto generated by OpenAPI Generator (https://openapi-generator.tech).
 * https://openapi-generator.tech
 * Do not edit the class manually.
 */
import { DataValue } from './dataValue';


export interface Injectm {
    dateCreated?: Date;
    dateModified?: Date | null;
    createdBy?: string;
    modifiedBy?: string | null;
    id?: string;
    name?: string | null;
    description?: string | null;
    injectTypeId?: string;
    requiresInjectId?: string | null;
    dataValues?: Array<DataValue> | null;
}
