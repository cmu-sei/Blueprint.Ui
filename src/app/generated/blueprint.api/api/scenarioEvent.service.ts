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

import { ProblemDetails } from '../model/problemDetails';
import { ScenarioEvent } from '../model/scenarioEvent';

import { BASE_PATH, COLLECTION_FORMATS }                     from '../variables';
import { Configuration }                                     from '../configuration';


@Injectable({
  providedIn: 'root'
})
export class ScenarioEventService {

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
     * Creates a new ScenarioEvent
     * Creates a new ScenarioEvent with the attributes specified  &lt;para /&gt;  Accessible only to a SuperUser or an Administrator
     * @param ScenarioEvent The data to create the ScenarioEvent with
     * @param observe set whether or not to return the data Observable as the body, response or events. defaults to returning the body.
     * @param reportProgress flag to report request and response progress.
     */
    public createScenarioEvent(ScenarioEvent?: ScenarioEvent, observe?: 'body', reportProgress?: boolean): Observable<ScenarioEvent>;
    public createScenarioEvent(ScenarioEvent?: ScenarioEvent, observe?: 'response', reportProgress?: boolean): Observable<HttpResponse<ScenarioEvent>>;
    public createScenarioEvent(ScenarioEvent?: ScenarioEvent, observe?: 'events', reportProgress?: boolean): Observable<HttpEvent<ScenarioEvent>>;
    public createScenarioEvent(ScenarioEvent?: ScenarioEvent, observe: any = 'body', reportProgress: boolean = false ): Observable<any> {

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

        return this.httpClient.post<ScenarioEvent>(`${this.configuration.basePath}/api/scenarioevents`,
            ScenarioEvent,
            {
                withCredentials: this.configuration.withCredentials,
                headers: headers,
                observe: observe,
                reportProgress: reportProgress
            }
        );
    }

    /**
     * Deletes an ScenarioEvent
     * Deletes an ScenarioEvent with the specified id  &lt;para /&gt;  Accessible only to a SuperUser or a User on an Admin Team within the specified ScenarioEvent
     * @param id The id of the ScenarioEvent to delete
     * @param observe set whether or not to return the data Observable as the body, response or events. defaults to returning the body.
     * @param reportProgress flag to report request and response progress.
     */
    public deleteScenarioEvent(id: string, observe?: 'body', reportProgress?: boolean): Observable<any>;
    public deleteScenarioEvent(id: string, observe?: 'response', reportProgress?: boolean): Observable<HttpResponse<any>>;
    public deleteScenarioEvent(id: string, observe?: 'events', reportProgress?: boolean): Observable<HttpEvent<any>>;
    public deleteScenarioEvent(id: string, observe: any = 'body', reportProgress: boolean = false ): Observable<any> {
        if (id === null || id === undefined) {
            throw new Error('Required parameter id was null or undefined when calling deleteScenarioEvent.');
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

        return this.httpClient.delete<any>(`${this.configuration.basePath}/api/scenarioevents/${encodeURIComponent(String(id))}`,
            {
                withCredentials: this.configuration.withCredentials,
                headers: headers,
                observe: observe,
                reportProgress: reportProgress
            }
        );
    }

    /**
     * Gets a specific ScenarioEvent by id
     * Returns the ScenarioEvent with the id specified  &lt;para /&gt;  Accessible to a User that is a member of a Team within the specified ScenarioEvent
     * @param id The id of the ScenarioEvent
     * @param observe set whether or not to return the data Observable as the body, response or events. defaults to returning the body.
     * @param reportProgress flag to report request and response progress.
     */
    public getScenarioEvent(id: string, observe?: 'body', reportProgress?: boolean): Observable<ScenarioEvent>;
    public getScenarioEvent(id: string, observe?: 'response', reportProgress?: boolean): Observable<HttpResponse<ScenarioEvent>>;
    public getScenarioEvent(id: string, observe?: 'events', reportProgress?: boolean): Observable<HttpEvent<ScenarioEvent>>;
    public getScenarioEvent(id: string, observe: any = 'body', reportProgress: boolean = false ): Observable<any> {
        if (id === null || id === undefined) {
            throw new Error('Required parameter id was null or undefined when calling getScenarioEvent.');
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

        return this.httpClient.get<ScenarioEvent>(`${this.configuration.basePath}/api/scenarioevents/${encodeURIComponent(String(id))}`,
            {
                withCredentials: this.configuration.withCredentials,
                headers: headers,
                observe: observe,
                reportProgress: reportProgress
            }
        );
    }

    /**
     * Gets ScenarioEvents
     * Returns a list of ScenarioEvents.
     * @param MselId Whether or not to return records only for a designated MSEL
     * @param TeamId Whether or not to return records only for a designated team
     * @param MoveId Whether or not to return records only for a designated move
     * @param observe set whether or not to return the data Observable as the body, response or events. defaults to returning the body.
     * @param reportProgress flag to report request and response progress.
     */
    public getScenarioEvents(MselId?: string, TeamId?: string, MoveId?: string, observe?: 'body', reportProgress?: boolean): Observable<Array<ScenarioEvent>>;
    public getScenarioEvents(MselId?: string, TeamId?: string, MoveId?: string, observe?: 'response', reportProgress?: boolean): Observable<HttpResponse<Array<ScenarioEvent>>>;
    public getScenarioEvents(MselId?: string, TeamId?: string, MoveId?: string, observe?: 'events', reportProgress?: boolean): Observable<HttpEvent<Array<ScenarioEvent>>>;
    public getScenarioEvents(MselId?: string, TeamId?: string, MoveId?: string, observe: any = 'body', reportProgress: boolean = false ): Observable<any> {

        let queryParameters = new HttpParams({encoder: new CustomHttpUrlEncodingCodec()});
        if (MselId !== undefined && MselId !== null) {
            queryParameters = queryParameters.set('MselId', <any>MselId);
        }
        if (TeamId !== undefined && TeamId !== null) {
            queryParameters = queryParameters.set('TeamId', <any>TeamId);
        }
        if (MoveId !== undefined && MoveId !== null) {
            queryParameters = queryParameters.set('MoveId', <any>MoveId);
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

        return this.httpClient.get<Array<ScenarioEvent>>(`${this.configuration.basePath}/api/scenarioevents`,
            {
                params: queryParameters,
                withCredentials: this.configuration.withCredentials,
                headers: headers,
                observe: observe,
                reportProgress: reportProgress
            }
        );
    }

    /**
     * Updates an ScenarioEvent
     * Updates an ScenarioEvent with the attributes specified  &lt;para /&gt;  Accessible only to a SuperUser or a User on an Admin Team within the specified ScenarioEvent
     * @param id The Id of the ScenarioEvent to update
     * @param ScenarioEvent The updated ScenarioEvent values
     * @param observe set whether or not to return the data Observable as the body, response or events. defaults to returning the body.
     * @param reportProgress flag to report request and response progress.
     */
    public updateScenarioEvent(id: string, ScenarioEvent?: ScenarioEvent, observe?: 'body', reportProgress?: boolean): Observable<ScenarioEvent>;
    public updateScenarioEvent(id: string, ScenarioEvent?: ScenarioEvent, observe?: 'response', reportProgress?: boolean): Observable<HttpResponse<ScenarioEvent>>;
    public updateScenarioEvent(id: string, ScenarioEvent?: ScenarioEvent, observe?: 'events', reportProgress?: boolean): Observable<HttpEvent<ScenarioEvent>>;
    public updateScenarioEvent(id: string, ScenarioEvent?: ScenarioEvent, observe: any = 'body', reportProgress: boolean = false ): Observable<any> {
        if (id === null || id === undefined) {
            throw new Error('Required parameter id was null or undefined when calling updateScenarioEvent.');
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

        return this.httpClient.put<ScenarioEvent>(`${this.configuration.basePath}/api/scenarioevents/${encodeURIComponent(String(id))}`,
            ScenarioEvent,
            {
                withCredentials: this.configuration.withCredentials,
                headers: headers,
                observe: observe,
                reportProgress: reportProgress
            }
        );
    }

}
