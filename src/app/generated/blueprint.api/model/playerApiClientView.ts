/*
 Copyright 2022 Carnegie Mellon University. All Rights Reserved.
 Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.
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
import { PlayerApiClientViewStatus } from './playerApiClientViewStatus';


export interface PlayerApiClientView {
    id?: string;
    name?: string;
    description?: string;
    status?: PlayerApiClientViewStatus;
    canManage?: boolean;
    parentViewId?: string;
}