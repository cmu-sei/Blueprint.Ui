/*
 Copyright 2024 Carnegie Mellon University. All Rights Reserved.
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
/* tslint:disable:no-unused-variable member-ordering */

import { Inject, Injectable, Optional }                      from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams,
         HttpResponse, HttpEvent }                           from '@angular/common/http';
import { CustomHttpUrlEncodingCodec }                        from '../encoder';

import { Observable }                                        from 'rxjs';

import { PlayerApplicationTeam } from '../model/playerApplicationTeam';

import { BASE_PATH, COLLECTION_FORMATS }                     from '../variables';
import { Configuration }                                     from '../configuration';


@Injectable({
  providedIn: 'root'
})
export class PlayerApplicationTeamService {

    protected basePath = 'http://localhost';
    public defaultHeaders = new HttpHeaders();
    public configuration = new Configuration();

    constructor(protected httpClient: HttpClient, @Optional()@Inject(BASE_PATH) basePath: string, @Optional() configuration: Configuration) {

        if (configuration) {
            this.configuration = configuration;
            this.configuration.basePath = configuration.basePath || basePath || this.basePath;

        } else {
            this.configuration.basePath = basePath || this.basePath;
        }
    }

    /**
     * @param consumes string[] mime-types
     * @return true: consumes contains 'multipart/form-data', false: otherwise
     */
    private canConsumeForm(consumes: string[]): boolean {
        const form = 'multipart/form-data';
        for (const consume of consumes) {
            if (form === consume) {
                return true;
            }
        }
        return false;
    }


    /**
     * Creates a new PlayerApplicationTeam
     * Creates a new PlayerApplicationTeam with the attributes specified  &lt;para /&gt;
     * @param PlayerApplicationTeam The data to create the PlayerApplicationTeam with
     * @param observe set whether or not to return the data Observable as the body, response or events. defaults to returning the body.
     * @param reportProgress flag to report request and response progress.
     */
    public createPlayerApplicationTeam(PlayerApplicationTeam?: PlayerApplicationTeam, observe?: 'body', reportProgress?: boolean): Observable<PlayerApplicationTeam>;
    public createPlayerApplicationTeam(PlayerApplicationTeam?: PlayerApplicationTeam, observe?: 'response', reportProgress?: boolean): Observable<HttpResponse<PlayerApplicationTeam>>;
    public createPlayerApplicationTeam(PlayerApplicationTeam?: PlayerApplicationTeam, observe?: 'events', reportProgress?: boolean): Observable<HttpEvent<PlayerApplicationTeam>>;
    public createPlayerApplicationTeam(PlayerApplicationTeam?: PlayerApplicationTeam, observe: any = 'body', reportProgress: boolean = false ): Observable<any> {

        let headers = this.defaultHeaders;

        // authentication (oauth2) required
        if (this.configuration.accessToken) {
            const accessToken = typeof this.configuration.accessToken === 'function'
                ? this.configuration.accessToken()
                : this.configuration.accessToken;
            headers = headers.set('Authorization', 'Bearer ' + accessToken);
        }

        // to determine the Accept header
        let httpHeaderAccepts: string[] = [
            'text/plain',
            'application/json',
            'text/json'
        ];
        const httpHeaderAcceptSelected: string | undefined = this.configuration.selectHeaderAccept(httpHeaderAccepts);
        if (httpHeaderAcceptSelected !== undefined) {
            headers = headers.set('Accept', httpHeaderAcceptSelected);
        }

        // to determine the Content-Type header
        const consumes: string[] = [
            'application/json',
            'text/json',
            'application/_*+json'
        ];
        const httpContentTypeSelected: string | undefined = this.configuration.selectHeaderContentType(consumes);
        if (httpContentTypeSelected !== undefined) {
            headers = headers.set('Content-Type', httpContentTypeSelected);
        }

        return this.httpClient.post<PlayerApplicationTeam>(`${this.configuration.basePath}/api/teamplayerApplications`,
            PlayerApplicationTeam,
            {
                withCredentials: this.configuration.withCredentials,
                headers: headers,
                observe: observe,
                reportProgress: reportProgress
            }
        );
    }

    /**
     * Deletes a PlayerApplicationTeam
     * Deletes a PlayerApplicationTeam with the specified id  &lt;para /&gt;
     * @param id The id of the PlayerApplicationTeam to delete
     * @param observe set whether or not to return the data Observable as the body, response or events. defaults to returning the body.
     * @param reportProgress flag to report request and response progress.
     */
    public deletePlayerApplicationTeam(id: string, observe?: 'body', reportProgress?: boolean): Observable<any>;
    public deletePlayerApplicationTeam(id: string, observe?: 'response', reportProgress?: boolean): Observable<HttpResponse<any>>;
    public deletePlayerApplicationTeam(id: string, observe?: 'events', reportProgress?: boolean): Observable<HttpEvent<any>>;
    public deletePlayerApplicationTeam(id: string, observe: any = 'body', reportProgress: boolean = false ): Observable<any> {
        if (id === null || id === undefined) {
            throw new Error('Required parameter id was null or undefined when calling deletePlayerApplicationTeam.');
        }

        let headers = this.defaultHeaders;

        // authentication (oauth2) required
        if (this.configuration.accessToken) {
            const accessToken = typeof this.configuration.accessToken === 'function'
                ? this.configuration.accessToken()
                : this.configuration.accessToken;
            headers = headers.set('Authorization', 'Bearer ' + accessToken);
        }

        // to determine the Accept header
        let httpHeaderAccepts: string[] = [
            'application/json'
        ];
        const httpHeaderAcceptSelected: string | undefined = this.configuration.selectHeaderAccept(httpHeaderAccepts);
        if (httpHeaderAcceptSelected !== undefined) {
            headers = headers.set('Accept', httpHeaderAcceptSelected);
        }

        // to determine the Content-Type header
        const consumes: string[] = [
        ];

        return this.httpClient.delete<any>(`${this.configuration.basePath}/api/teamplayerApplications/${encodeURIComponent(String(id))}`,
            {
                withCredentials: this.configuration.withCredentials,
                headers: headers,
                observe: observe,
                reportProgress: reportProgress
            }
        );
    }

    /**
     * Deletes a PlayerApplicationTeam by playerApplication ID and team ID
     * Deletes a PlayerApplicationTeam with the specified playerApplication ID and team ID  &lt;para /&gt;
     * @param teamId ID of a team.
     * @param playerApplicationId ID of a playerApplication.
     * @param observe set whether or not to return the data Observable as the body, response or events. defaults to returning the body.
     * @param reportProgress flag to report request and response progress.
     */
    public deletePlayerApplicationTeamByIds(teamId: string, playerApplicationId: string, observe?: 'body', reportProgress?: boolean): Observable<any>;
    public deletePlayerApplicationTeamByIds(teamId: string, playerApplicationId: string, observe?: 'response', reportProgress?: boolean): Observable<HttpResponse<any>>;
    public deletePlayerApplicationTeamByIds(teamId: string, playerApplicationId: string, observe?: 'events', reportProgress?: boolean): Observable<HttpEvent<any>>;
    public deletePlayerApplicationTeamByIds(teamId: string, playerApplicationId: string, observe: any = 'body', reportProgress: boolean = false ): Observable<any> {
        if (teamId === null || teamId === undefined) {
            throw new Error('Required parameter teamId was null or undefined when calling deletePlayerApplicationTeamByIds.');
        }
        if (playerApplicationId === null || playerApplicationId === undefined) {
            throw new Error('Required parameter playerApplicationId was null or undefined when calling deletePlayerApplicationTeamByIds.');
        }

        let headers = this.defaultHeaders;

        // authentication (oauth2) required
        if (this.configuration.accessToken) {
            const accessToken = typeof this.configuration.accessToken === 'function'
                ? this.configuration.accessToken()
                : this.configuration.accessToken;
            headers = headers.set('Authorization', 'Bearer ' + accessToken);
        }

        // to determine the Accept header
        let httpHeaderAccepts: string[] = [
            'application/json'
        ];
        const httpHeaderAcceptSelected: string | undefined = this.configuration.selectHeaderAccept(httpHeaderAccepts);
        if (httpHeaderAcceptSelected !== undefined) {
            headers = headers.set('Accept', httpHeaderAcceptSelected);
        }

        // to determine the Content-Type header
        const consumes: string[] = [
        ];

        return this.httpClient.delete<any>(`${this.configuration.basePath}/api/teams/${encodeURIComponent(String(teamId))}/playerApplications/${encodeURIComponent(String(playerApplicationId))}`,
            {
                withCredentials: this.configuration.withCredentials,
                headers: headers,
                observe: observe,
                reportProgress: reportProgress
            }
        );
    }

    /**
     * Gets all PlayerApplicationTeams for a playerApplication
     * Returns a list of all of the PlayerApplicationTeams for the playerApplication.
     * @param playerApplicationId The id of the PlayerApplicationTeam
     * @param observe set whether or not to return the data Observable as the body, response or events. defaults to returning the body.
     * @param reportProgress flag to report request and response progress.
     */
    public getPlayerApplicationPlayerApplicationTeams(playerApplicationId: string, observe?: 'body', reportProgress?: boolean): Observable<Array<PlayerApplicationTeam>>;
    public getPlayerApplicationPlayerApplicationTeams(playerApplicationId: string, observe?: 'response', reportProgress?: boolean): Observable<HttpResponse<Array<PlayerApplicationTeam>>>;
    public getPlayerApplicationPlayerApplicationTeams(playerApplicationId: string, observe?: 'events', reportProgress?: boolean): Observable<HttpEvent<Array<PlayerApplicationTeam>>>;
    public getPlayerApplicationPlayerApplicationTeams(playerApplicationId: string, observe: any = 'body', reportProgress: boolean = false ): Observable<any> {
        if (playerApplicationId === null || playerApplicationId === undefined) {
            throw new Error('Required parameter playerApplicationId was null or undefined when calling getPlayerApplicationPlayerApplicationTeams.');
        }

        let headers = this.defaultHeaders;

        // authentication (oauth2) required
        if (this.configuration.accessToken) {
            const accessToken = typeof this.configuration.accessToken === 'function'
                ? this.configuration.accessToken()
                : this.configuration.accessToken;
            headers = headers.set('Authorization', 'Bearer ' + accessToken);
        }

        // to determine the Accept header
        let httpHeaderAccepts: string[] = [
            'text/plain',
            'application/json',
            'text/json'
        ];
        const httpHeaderAcceptSelected: string | undefined = this.configuration.selectHeaderAccept(httpHeaderAccepts);
        if (httpHeaderAcceptSelected !== undefined) {
            headers = headers.set('Accept', httpHeaderAcceptSelected);
        }

        // to determine the Content-Type header
        const consumes: string[] = [
        ];

        return this.httpClient.get<Array<PlayerApplicationTeam>>(`${this.configuration.basePath}/api/playerApplications/${encodeURIComponent(String(playerApplicationId))}/teamplayerApplications`,
            {
                withCredentials: this.configuration.withCredentials,
                headers: headers,
                observe: observe,
                reportProgress: reportProgress
            }
        );
    }

    /**
     * Gets a specific PlayerApplicationTeam by id
     * Returns the PlayerApplicationTeam with the id specified  &lt;para /&gt;
     * @param id The id of the PlayerApplicationTeam
     * @param observe set whether or not to return the data Observable as the body, response or events. defaults to returning the body.
     * @param reportProgress flag to report request and response progress.
     */
    public getPlayerApplicationTeam(id: string, observe?: 'body', reportProgress?: boolean): Observable<PlayerApplicationTeam>;
    public getPlayerApplicationTeam(id: string, observe?: 'response', reportProgress?: boolean): Observable<HttpResponse<PlayerApplicationTeam>>;
    public getPlayerApplicationTeam(id: string, observe?: 'events', reportProgress?: boolean): Observable<HttpEvent<PlayerApplicationTeam>>;
    public getPlayerApplicationTeam(id: string, observe: any = 'body', reportProgress: boolean = false ): Observable<any> {
        if (id === null || id === undefined) {
            throw new Error('Required parameter id was null or undefined when calling getPlayerApplicationTeam.');
        }

        let headers = this.defaultHeaders;

        // authentication (oauth2) required
        if (this.configuration.accessToken) {
            const accessToken = typeof this.configuration.accessToken === 'function'
                ? this.configuration.accessToken()
                : this.configuration.accessToken;
            headers = headers.set('Authorization', 'Bearer ' + accessToken);
        }

        // to determine the Accept header
        let httpHeaderAccepts: string[] = [
            'text/plain',
            'application/json',
            'text/json'
        ];
        const httpHeaderAcceptSelected: string | undefined = this.configuration.selectHeaderAccept(httpHeaderAccepts);
        if (httpHeaderAcceptSelected !== undefined) {
            headers = headers.set('Accept', httpHeaderAcceptSelected);
        }

        // to determine the Content-Type header
        const consumes: string[] = [
        ];

        return this.httpClient.get<PlayerApplicationTeam>(`${this.configuration.basePath}/api/teamplayerApplications/${encodeURIComponent(String(id))}`,
            {
                withCredentials: this.configuration.withCredentials,
                headers: headers,
                observe: observe,
                reportProgress: reportProgress
            }
        );
    }

    /**
     * Gets all PlayerApplicationTeams in the system
     * Returns a list of all of the PlayerApplicationTeams in the system.  &lt;para /&gt;
     * @param observe set whether or not to return the data Observable as the body, response or events. defaults to returning the body.
     * @param reportProgress flag to report request and response progress.
     */
    public getPlayerApplicationTeams(observe?: 'body', reportProgress?: boolean): Observable<Array<PlayerApplicationTeam>>;
    public getPlayerApplicationTeams(observe?: 'response', reportProgress?: boolean): Observable<HttpResponse<Array<PlayerApplicationTeam>>>;
    public getPlayerApplicationTeams(observe?: 'events', reportProgress?: boolean): Observable<HttpEvent<Array<PlayerApplicationTeam>>>;
    public getPlayerApplicationTeams(observe: any = 'body', reportProgress: boolean = false ): Observable<any> {

        let headers = this.defaultHeaders;

        // authentication (oauth2) required
        if (this.configuration.accessToken) {
            const accessToken = typeof this.configuration.accessToken === 'function'
                ? this.configuration.accessToken()
                : this.configuration.accessToken;
            headers = headers.set('Authorization', 'Bearer ' + accessToken);
        }

        // to determine the Accept header
        let httpHeaderAccepts: string[] = [
            'text/plain',
            'application/json',
            'text/json'
        ];
        const httpHeaderAcceptSelected: string | undefined = this.configuration.selectHeaderAccept(httpHeaderAccepts);
        if (httpHeaderAcceptSelected !== undefined) {
            headers = headers.set('Accept', httpHeaderAcceptSelected);
        }

        // to determine the Content-Type header
        const consumes: string[] = [
        ];

        return this.httpClient.get<Array<PlayerApplicationTeam>>(`${this.configuration.basePath}/api/teamplayerApplications`,
            {
                withCredentials: this.configuration.withCredentials,
                headers: headers,
                observe: observe,
                reportProgress: reportProgress
            }
        );
    }

    /**
     * Gets all PlayerApplicationTeams for a MSEL
     * Returns a list of all of the PlayerApplicationTeams for the collection.
     * @param mselId The id of the Msel
     * @param observe set whether or not to return the data Observable as the body, response or events. defaults to returning the body.
     * @param reportProgress flag to report request and response progress.
     */
    public getMselPlayerApplicationTeams(mselId: string, observe?: 'body', reportProgress?: boolean): Observable<Array<PlayerApplicationTeam>>;
    public getMselPlayerApplicationTeams(mselId: string, observe?: 'response', reportProgress?: boolean): Observable<HttpResponse<Array<PlayerApplicationTeam>>>;
    public getMselPlayerApplicationTeams(mselId: string, observe?: 'events', reportProgress?: boolean): Observable<HttpEvent<Array<PlayerApplicationTeam>>>;
    public getMselPlayerApplicationTeams(mselId: string, observe: any = 'body', reportProgress: boolean = false ): Observable<any> {
        if (mselId === null || mselId === undefined) {
            throw new Error('Required parameter mselId was null or undefined when calling getMselPlayerApplicationTeams.');
        }

        let headers = this.defaultHeaders;

        // authentication (oauth2) required
        if (this.configuration.accessToken) {
            const accessToken = typeof this.configuration.accessToken === 'function'
                ? this.configuration.accessToken()
                : this.configuration.accessToken;
            headers = headers.set('Authorization', 'Bearer ' + accessToken);
        }

        // to determine the Accept header
        let httpHeaderAccepts: string[] = [
            'text/plain',
            'application/json',
            'text/json'
        ];
        const httpHeaderAcceptSelected: string | undefined = this.configuration.selectHeaderAccept(httpHeaderAccepts);
        if (httpHeaderAcceptSelected !== undefined) {
            headers = headers.set('Accept', httpHeaderAcceptSelected);
        }

        // to determine the Content-Type header
        const consumes: string[] = [
        ];

        return this.httpClient.get<Array<PlayerApplicationTeam>>(`${this.configuration.basePath}/api/msels/${encodeURIComponent(String(mselId))}/teamplayerApplications`,
            {
                withCredentials: this.configuration.withCredentials,
                headers: headers,
                observe: observe,
                reportProgress: reportProgress
            }
        );
    }

    /**
     * Updates a  PlayerApplicationTeam
     * Updates a PlayerApplicationTeam with the attributes specified.  The ID from the route MUST MATCH the ID contained in the playerApplicationTeam parameter  &lt;para /&gt;  Accessible only to a ContentDeveloper or an Administrator
     * @param id The Id of the PlayerApplicationTeam to update
     * @param PlayerApplicationTeam The updated PlayerApplicationTeam values
     * @param observe set whether or not to return the data Observable as the body, response or events. defaults to returning the body.
     * @param reportProgress flag to report request and response progress.
     */
    public updatePlayerApplicationTeam(id: string, PlayerApplicationTeam?: PlayerApplicationTeam, observe?: 'body', reportProgress?: boolean): Observable<PlayerApplicationTeam>;
    public updatePlayerApplicationTeam(id: string, PlayerApplicationTeam?: PlayerApplicationTeam, observe?: 'response', reportProgress?: boolean): Observable<HttpResponse<PlayerApplicationTeam>>;
    public updatePlayerApplicationTeam(id: string, PlayerApplicationTeam?: PlayerApplicationTeam, observe?: 'events', reportProgress?: boolean): Observable<HttpEvent<PlayerApplicationTeam>>;
    public updatePlayerApplicationTeam(id: string, PlayerApplicationTeam?: PlayerApplicationTeam, observe: any = 'body', reportProgress: boolean = false ): Observable<any> {
        if (id === null || id === undefined) {
            throw new Error('Required parameter id was null or undefined when calling updatePlayerApplicationTeam.');
        }

        let headers = this.defaultHeaders;

        // authentication (oauth2) required
        if (this.configuration.accessToken) {
            const accessToken = typeof this.configuration.accessToken === 'function'
                ? this.configuration.accessToken()
                : this.configuration.accessToken;
            headers = headers.set('Authorization', 'Bearer ' + accessToken);
        }

        // to determine the Accept header
        let httpHeaderAccepts: string[] = [
            'text/plain',
            'application/json',
            'text/json'
        ];
        const httpHeaderAcceptSelected: string | undefined = this.configuration.selectHeaderAccept(httpHeaderAccepts);
        if (httpHeaderAcceptSelected !== undefined) {
            headers = headers.set('Accept', httpHeaderAcceptSelected);
        }

        // to determine the Content-Type header
        const consumes: string[] = [
            'application/json',
            'text/json',
            'application/_*+json'
        ];
        const httpContentTypeSelected: string | undefined = this.configuration.selectHeaderContentType(consumes);
        if (httpContentTypeSelected !== undefined) {
            headers = headers.set('Content-Type', httpContentTypeSelected);
        }

        return this.httpClient.put<PlayerApplicationTeam>(`${this.configuration.basePath}/api/playerApplicationteams/${encodeURIComponent(String(id))}`,
            PlayerApplicationTeam,
            {
                withCredentials: this.configuration.withCredentials,
                headers: headers,
                observe: observe,
                reportProgress: reportProgress
            }
        );
    }

}