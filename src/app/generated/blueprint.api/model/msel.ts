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
import { Card } from './card';
import { DataField } from './dataField';
import { ItemStatus } from './itemStatus';
import { Move } from './move';
import { ScenarioEvent } from './scenarioEvent';
import { Team } from './team';
import { UserMselRole } from './userMselRole';


export interface Msel {
    dateCreated?: Date;
    dateModified?: Date;
    createdBy?: string;
    modifiedBy?: string;
    id?: string;
    name?: string;
    description?: string;
    status?: ItemStatus;
    usePlayer?: boolean;
    playerViewId?: string;
    useGallery?: boolean;
    galleryCollectionId?: string;
    galleryExhibitId?: string;
    useCite?: boolean;
    citeEvaluationId?: string;
    citeScoringModelId?: string;
    useSteamfitter?: boolean;
    steamfitterScenarioId?: string;
    isTemplate?: boolean;
    startTime?: Date;
    durationSeconds?: number;
    showTimeOnScenarioEventList?: boolean;
    showTimeOnExerciseView?: boolean;
    showMoveOnScenarioEventList?: boolean;
    showMoveOnExerciseView?: boolean;
    showGroupOnScenarioEventList?: boolean;
    showGroupOnExerciseView?: boolean;
    moves?: Array<Move>;
    dataFields?: Array<DataField>;
    scenarioEvents?: Array<ScenarioEvent>;
    teams?: Array<Team>;
    userMselRoles?: Array<UserMselRole>;
    headerRowMetadata?: string;
    cards?: Array<Card>;
    galleryArticleParameters?: Array<string>;
    gallerySourceTypes?: Array<string>;
}
