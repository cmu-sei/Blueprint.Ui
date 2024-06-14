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
import { EventType } from './eventType';


export interface ScenarioEvent { 
    dateCreated?: Date;
    dateModified?: Date | null;
    createdBy?: string;
    modifiedBy?: string | null;
    id?: string;
    mselId?: string;
    dataValues?: Array<DataValue> | null;
    groupOrder?: number;
    isHidden?: boolean;
    rowMetadata?: string | null;
    deltaSeconds?: number;
    scenarioEventType?: EventType;
    description?: string | null;
    injectId?: string | null;
}

