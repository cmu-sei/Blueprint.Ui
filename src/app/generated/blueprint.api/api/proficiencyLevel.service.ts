/*
 Copyright 2026 Carnegie Mellon University. All Rights Reserved.
 Released under a MIT (SEI)-style license. See LICENSE.md in the
 project root for license information.
*/
/* tslint:disable:no-unused-variable member-ordering */

import { Inject, Injectable, Optional }                      from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams,
         HttpResponse, HttpEvent, HttpParameterCodec, HttpContext
        }       from '@angular/common/http';
import { CustomHttpParameterCodec }                          from '../encoder';
import { Observable }                                        from 'rxjs';

// @ts-ignore
import { ProficiencyLevel } from '../model/proficiencyLevel';
// @ts-ignore
import { ProblemDetails } from '../model/problemDetails';

// @ts-ignore
import { BASE_PATH, COLLECTION_FORMATS }                     from '../variables';
import { Configuration }                                     from '../configuration';
import { BaseService } from '../api.base.service';



@Injectable({
  providedIn: 'root'
})
export class ProficiencyLevelService extends BaseService {

    constructor(protected httpClient: HttpClient, @Optional() @Inject(BASE_PATH) basePath: string|string[], @Optional() configuration?: Configuration) {
        super(basePath, configuration);
    }

    public createProficiencyLevel(proficiencyLevel?: ProficiencyLevel, observe?: 'body', reportProgress?: boolean, options?: {httpHeaderAccept?: 'text/plain' | 'application/json' | 'text/json', context?: HttpContext, transferCache?: boolean}): Observable<ProficiencyLevel>;
    public createProficiencyLevel(proficiencyLevel?: ProficiencyLevel, observe?: 'response', reportProgress?: boolean, options?: {httpHeaderAccept?: 'text/plain' | 'application/json' | 'text/json', context?: HttpContext, transferCache?: boolean}): Observable<HttpResponse<ProficiencyLevel>>;
    public createProficiencyLevel(proficiencyLevel?: ProficiencyLevel, observe?: 'events', reportProgress?: boolean, options?: {httpHeaderAccept?: 'text/plain' | 'application/json' | 'text/json', context?: HttpContext, transferCache?: boolean}): Observable<HttpEvent<ProficiencyLevel>>;
    public createProficiencyLevel(proficiencyLevel?: ProficiencyLevel, observe: any = 'body', reportProgress: boolean = false, options?: {httpHeaderAccept?: 'text/plain' | 'application/json' | 'text/json', context?: HttpContext, transferCache?: boolean}): Observable<any> {

        let localVarHeaders = this.defaultHeaders;
        localVarHeaders = this.configuration.addCredentialToHeaders('oauth2', 'Authorization', localVarHeaders, 'Bearer ');

        const localVarHttpHeaderAcceptSelected: string | undefined = options?.httpHeaderAccept ?? this.configuration.selectHeaderAccept(['text/plain', 'application/json', 'text/json']);
        if (localVarHttpHeaderAcceptSelected !== undefined) {
            localVarHeaders = localVarHeaders.set('Accept', localVarHttpHeaderAcceptSelected);
        }

        const consumes: string[] = ['application/json', 'text/json', 'application/*+json'];
        const httpContentTypeSelected: string | undefined = this.configuration.selectHeaderContentType(consumes);
        if (httpContentTypeSelected !== undefined) {
            localVarHeaders = localVarHeaders.set('Content-Type', httpContentTypeSelected);
        }

        const localVarHttpContext: HttpContext = options?.context ?? new HttpContext();
        const localVarTransferCache: boolean = options?.transferCache ?? true;

        let localVarPath = `/api/proficiencylevels`;
        const { basePath, withCredentials } = this.configuration;
        return this.httpClient.request<ProficiencyLevel>('post', `${basePath}${localVarPath}`,
            {
                context: localVarHttpContext,
                body: proficiencyLevel,
                responseType: 'json',
                ...(withCredentials ? { withCredentials } : {}),
                headers: localVarHeaders,
                observe: observe,
                transferCache: localVarTransferCache,
                reportProgress: reportProgress
            }
        );
    }

    public updateProficiencyLevel(id: string, proficiencyLevel?: ProficiencyLevel, observe?: 'body', reportProgress?: boolean, options?: {httpHeaderAccept?: 'text/plain' | 'application/json' | 'text/json', context?: HttpContext, transferCache?: boolean}): Observable<ProficiencyLevel>;
    public updateProficiencyLevel(id: string, proficiencyLevel?: ProficiencyLevel, observe?: 'response', reportProgress?: boolean, options?: {httpHeaderAccept?: 'text/plain' | 'application/json' | 'text/json', context?: HttpContext, transferCache?: boolean}): Observable<HttpResponse<ProficiencyLevel>>;
    public updateProficiencyLevel(id: string, proficiencyLevel?: ProficiencyLevel, observe?: 'events', reportProgress?: boolean, options?: {httpHeaderAccept?: 'text/plain' | 'application/json' | 'text/json', context?: HttpContext, transferCache?: boolean}): Observable<HttpEvent<ProficiencyLevel>>;
    public updateProficiencyLevel(id: string, proficiencyLevel?: ProficiencyLevel, observe: any = 'body', reportProgress: boolean = false, options?: {httpHeaderAccept?: 'text/plain' | 'application/json' | 'text/json', context?: HttpContext, transferCache?: boolean}): Observable<any> {
        if (id === null || id === undefined) {
            throw new Error('Required parameter id was null or undefined when calling updateProficiencyLevel.');
        }

        let localVarHeaders = this.defaultHeaders;
        localVarHeaders = this.configuration.addCredentialToHeaders('oauth2', 'Authorization', localVarHeaders, 'Bearer ');

        const localVarHttpHeaderAcceptSelected: string | undefined = options?.httpHeaderAccept ?? this.configuration.selectHeaderAccept(['text/plain', 'application/json', 'text/json']);
        if (localVarHttpHeaderAcceptSelected !== undefined) {
            localVarHeaders = localVarHeaders.set('Accept', localVarHttpHeaderAcceptSelected);
        }

        const consumes: string[] = ['application/json', 'text/json', 'application/*+json'];
        const httpContentTypeSelected: string | undefined = this.configuration.selectHeaderContentType(consumes);
        if (httpContentTypeSelected !== undefined) {
            localVarHeaders = localVarHeaders.set('Content-Type', httpContentTypeSelected);
        }

        const localVarHttpContext: HttpContext = options?.context ?? new HttpContext();
        const localVarTransferCache: boolean = options?.transferCache ?? true;

        let localVarPath = `/api/proficiencylevels/${this.configuration.encodeParam({name: "id", value: id, in: "path", style: "simple", explode: false, dataType: "string", dataFormat: "uuid"})}`;
        const { basePath, withCredentials } = this.configuration;
        return this.httpClient.request<ProficiencyLevel>('put', `${basePath}${localVarPath}`,
            {
                context: localVarHttpContext,
                body: proficiencyLevel,
                responseType: 'json',
                ...(withCredentials ? { withCredentials } : {}),
                headers: localVarHeaders,
                observe: observe,
                transferCache: localVarTransferCache,
                reportProgress: reportProgress
            }
        );
    }

    public deleteProficiencyLevel(id: string, observe?: 'body', reportProgress?: boolean, options?: {httpHeaderAccept?: 'application/json', context?: HttpContext, transferCache?: boolean}): Observable<any>;
    public deleteProficiencyLevel(id: string, observe?: 'response', reportProgress?: boolean, options?: {httpHeaderAccept?: 'application/json', context?: HttpContext, transferCache?: boolean}): Observable<HttpResponse<any>>;
    public deleteProficiencyLevel(id: string, observe?: 'events', reportProgress?: boolean, options?: {httpHeaderAccept?: 'application/json', context?: HttpContext, transferCache?: boolean}): Observable<HttpEvent<any>>;
    public deleteProficiencyLevel(id: string, observe: any = 'body', reportProgress: boolean = false, options?: {httpHeaderAccept?: 'application/json', context?: HttpContext, transferCache?: boolean}): Observable<any> {
        if (id === null || id === undefined) {
            throw new Error('Required parameter id was null or undefined when calling deleteProficiencyLevel.');
        }

        let localVarHeaders = this.defaultHeaders;
        localVarHeaders = this.configuration.addCredentialToHeaders('oauth2', 'Authorization', localVarHeaders, 'Bearer ');

        const localVarHttpHeaderAcceptSelected: string | undefined = options?.httpHeaderAccept ?? this.configuration.selectHeaderAccept(['application/json']);
        if (localVarHttpHeaderAcceptSelected !== undefined) {
            localVarHeaders = localVarHeaders.set('Accept', localVarHttpHeaderAcceptSelected);
        }

        const localVarHttpContext: HttpContext = options?.context ?? new HttpContext();
        const localVarTransferCache: boolean = options?.transferCache ?? true;

        let localVarPath = `/api/proficiencylevels/${this.configuration.encodeParam({name: "id", value: id, in: "path", style: "simple", explode: false, dataType: "string", dataFormat: "uuid"})}`;
        const { basePath, withCredentials } = this.configuration;
        return this.httpClient.request<any>('delete', `${basePath}${localVarPath}`,
            {
                context: localVarHttpContext,
                responseType: 'json',
                ...(withCredentials ? { withCredentials } : {}),
                headers: localVarHeaders,
                observe: observe,
                transferCache: localVarTransferCache,
                reportProgress: reportProgress
            }
        );
    }

}
