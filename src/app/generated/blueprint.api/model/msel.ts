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
import { Organization } from './organization';
import { MselPage } from './mselPage';
import { CiteRole } from './citeRole';
import { Invitation } from './invitation';
import { UserMselRole } from './userMselRole';
import { ScenarioEvent } from './scenarioEvent';
import { Unit } from './unit';
import { Card } from './card';
import { CiteAction } from './citeAction';
import { DataField } from './dataField';
import { Move } from './move';
import { MselItemStatus } from './mselItemStatus';
import { Team } from './team';
import { IntegrationType } from './integrationType';
import { PlayerApplication } from './playerApplication';


export interface Msel {
    dateCreated?: Date;
    dateModified?: Date | null;
    createdBy?: string;
    modifiedBy?: string | null;
    id?: string;
    name?: string | null;
    description?: string | null;
    status?: MselItemStatus;
    usePlayer?: boolean;
    playerViewId?: string | null;
    playerIntegrationType?: IntegrationType;
    useGallery?: boolean;
    galleryCollectionId?: string | null;
    galleryExhibitId?: string | null;
    galleryIntegrationType?: IntegrationType;
    useCite?: boolean;
    citeEvaluationId?: string | null;
    citeScoringModelId?: string | null;
    citeIntegrationType?: IntegrationType;
    useSteamfitter?: boolean;
    steamfitterScenarioId?: string | null;
    steamfitterIntegrationType?: IntegrationType;
    isTemplate?: boolean;
    startTime?: Date;
    durationSeconds?: number;
    showTimeOnScenarioEventList?: boolean;
    showTimeOnExerciseView?: boolean;
    timeDisplayOrder?: number;
    showMoveOnScenarioEventList?: boolean;
    showMoveOnExerciseView?: boolean;
    moveDisplayOrder?: number;
    showGroupOnScenarioEventList?: boolean;
    showGroupOnExerciseView?: boolean;
    groupDisplayOrder?: number;
    showIntegrationTargetOnScenarioEventList?: boolean;
    showIntegrationTargetOnExerciseView?: boolean;
    integrationTargetDisplayOrder?: number;
    moves?: Array<Move> | null;
    dataFields?: Array<DataField> | null;
    scenarioEvents?: Array<ScenarioEvent> | null;
    teams?: Array<Team> | null;
    units?: Array<Unit> | null;
    userMselRoles?: Array<UserMselRole> | null;
    headerRowMetadata?: string | null;
    organizations?: Array<Organization> | null;
    cards?: Array<Card> | null;
    galleryArticleParameters?: Array<string> | null;
    gallerySourceTypes?: Array<string> | null;
    citeRoles?: Array<CiteRole> | null;
    citeActions?: Array<CiteAction> | null;
    playerApplications?: Array<PlayerApplication> | null;
    pages?: Array<MselPage> | null;
    invitations?: Array<Invitation> | null;
}
