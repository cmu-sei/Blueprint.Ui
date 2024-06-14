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


export interface Inject { 
    dateCreated?: Date;
    dateModified?: Date | null;
    createdBy?: string;
    modifiedBy?: string | null;
    id?: string;
    injectTypeId?: string;
    requiresInjectId?: string | null;
    requiresInject?: Inject;
    dataValues?: Array<DataValue> | null;
}

