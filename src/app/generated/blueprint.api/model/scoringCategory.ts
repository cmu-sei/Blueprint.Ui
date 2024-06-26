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
import { ScoringOption } from './scoringOption';
import { ScoringOptionSelection } from './scoringOptionSelection';


export interface ScoringCategory { 
    dateCreated?: Date;
    dateModified?: Date | null;
    createdBy?: string;
    modifiedBy?: string | null;
    id?: string;
    displayOrder?: number;
    description?: string | null;
    calculationEquation?: string | null;
    isModifierRequired?: boolean;
    scoringWeight?: number;
    moveNumberFirstDisplay?: number;
    moveNumberLastDisplay?: number;
    scoringModelId?: string;
    scoringOptions?: Array<ScoringOption> | null;
    scoringOptionSelection?: ScoringOptionSelection;
}

