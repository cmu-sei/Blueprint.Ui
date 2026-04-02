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
import { CompetencyElement } from '../model/competencyElement';
// @ts-ignore
import { ProblemDetails } from '../model/problemDetails';

// @ts-ignore
import { BASE_PATH, COLLECTION_FORMATS }                     from '../variables';
import { Configuration }                                     from '../configuration';
import { BaseService } from '../api.base.service';



@Injectable({
  providedIn: 'root'
})
export class CompetencyElementService extends BaseService {

    constructor(protected httpClient: HttpClient, @Optional() @Inject(BASE_PATH) basePath: string|string[], @Optional() configuration?: Configuration) {
        super(basePath, configuration);
    }

    public getCompetencyElementsByFramework(frameworkId: string, observe?: 'body', reportProgress?: boolean, options?: {httpHeaderAccept?: 'text/plain' | 'application/json' | 'text/json', context?: HttpContext, transferCache?: boolean}): Observable<Array<CompetencyElement>>;
    public getCompetencyElementsByFramework(frameworkId: string, observe?: 'response', reportProgress?: boolean, options?: {httpHeaderAccept?: 'text/plain' | 'application/json' | 'text/json', context?: HttpContext, transferCache?: boolean}): Observable<HttpResponse<Array<CompetencyElement>>>;
    public getCompetencyElementsByFramework(frameworkId: string, observe?: 'events', reportProgress?: boolean, options?: {httpHeaderAccept?: 'text/plain' | 'application/json' | 'text/json', context?: HttpContext, transferCache?: boolean}): Observable<HttpEvent<Array<CompetencyElement>>>;
    public getCompetencyElementsByFramework(frameworkId: string, observe: any = 'body', reportProgress: boolean = false, options?: {httpHeaderAccept?: 'text/plain' | 'application/json' | 'text/json', context?: HttpContext, transferCache?: boolean}): Observable<any> {
        if (frameworkId === null || frameworkId === undefined) {
            throw new Error('Required parameter frameworkId was null or undefined when calling getCompetencyElementsByFramework.');
        }

        let localVarHeaders = this.defaultHeaders;
        localVarHeaders = this.configuration.addCredentialToHeaders('oauth2', 'Authorization', localVarHeaders, 'Bearer ');

        const localVarHttpHeaderAcceptSelected: string | undefined = options?.httpHeaderAccept ?? this.configuration.selectHeaderAccept(['text/plain', 'application/json', 'text/json']);
        if (localVarHttpHeaderAcceptSelected !== undefined) {
            localVarHeaders = localVarHeaders.set('Accept', localVarHttpHeaderAcceptSelected);
        }

        const localVarHttpContext: HttpContext = options?.context ?? new HttpContext();
        const localVarTransferCache: boolean = options?.transferCache ?? true;

        let localVarPath = `/api/competencyframeworks/${this.configuration.encodeParam({name: "frameworkId", value: frameworkId, in: "path", style: "simple", explode: false, dataType: "string", dataFormat: "uuid"})}/competencyelements`;
        const { basePath, withCredentials } = this.configuration;
        return this.httpClient.request<Array<CompetencyElement>>('get', `${basePath}${localVarPath}`,
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

    public createCompetencyElement(competencyElement?: CompetencyElement, observe?: 'body', reportProgress?: boolean, options?: {httpHeaderAccept?: 'text/plain' | 'application/json' | 'text/json', context?: HttpContext, transferCache?: boolean}): Observable<CompetencyElement>;
    public createCompetencyElement(competencyElement?: CompetencyElement, observe?: 'response', reportProgress?: boolean, options?: {httpHeaderAccept?: 'text/plain' | 'application/json' | 'text/json', context?: HttpContext, transferCache?: boolean}): Observable<HttpResponse<CompetencyElement>>;
    public createCompetencyElement(competencyElement?: CompetencyElement, observe?: 'events', reportProgress?: boolean, options?: {httpHeaderAccept?: 'text/plain' | 'application/json' | 'text/json', context?: HttpContext, transferCache?: boolean}): Observable<HttpEvent<CompetencyElement>>;
    public createCompetencyElement(competencyElement?: CompetencyElement, observe: any = 'body', reportProgress: boolean = false, options?: {httpHeaderAccept?: 'text/plain' | 'application/json' | 'text/json', context?: HttpContext, transferCache?: boolean}): Observable<any> {

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

        let localVarPath = `/api/competencyelements`;
        const { basePath, withCredentials } = this.configuration;
        return this.httpClient.request<CompetencyElement>('post', `${basePath}${localVarPath}`,
            {
                context: localVarHttpContext,
                body: competencyElement,
                responseType: 'json',
                ...(withCredentials ? { withCredentials } : {}),
                headers: localVarHeaders,
                observe: observe,
                transferCache: localVarTransferCache,
                reportProgress: reportProgress
            }
        );
    }

    public updateCompetencyElement(id: string, competencyElement?: CompetencyElement, observe?: 'body', reportProgress?: boolean, options?: {httpHeaderAccept?: 'text/plain' | 'application/json' | 'text/json', context?: HttpContext, transferCache?: boolean}): Observable<CompetencyElement>;
    public updateCompetencyElement(id: string, competencyElement?: CompetencyElement, observe?: 'response', reportProgress?: boolean, options?: {httpHeaderAccept?: 'text/plain' | 'application/json' | 'text/json', context?: HttpContext, transferCache?: boolean}): Observable<HttpResponse<CompetencyElement>>;
    public updateCompetencyElement(id: string, competencyElement?: CompetencyElement, observe?: 'events', reportProgress?: boolean, options?: {httpHeaderAccept?: 'text/plain' | 'application/json' | 'text/json', context?: HttpContext, transferCache?: boolean}): Observable<HttpEvent<CompetencyElement>>;
    public updateCompetencyElement(id: string, competencyElement?: CompetencyElement, observe: any = 'body', reportProgress: boolean = false, options?: {httpHeaderAccept?: 'text/plain' | 'application/json' | 'text/json', context?: HttpContext, transferCache?: boolean}): Observable<any> {
        if (id === null || id === undefined) {
            throw new Error('Required parameter id was null or undefined when calling updateCompetencyElement.');
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

        let localVarPath = `/api/competencyelements/${this.configuration.encodeParam({name: "id", value: id, in: "path", style: "simple", explode: false, dataType: "string", dataFormat: "uuid"})}`;
        const { basePath, withCredentials } = this.configuration;
        return this.httpClient.request<CompetencyElement>('put', `${basePath}${localVarPath}`,
            {
                context: localVarHttpContext,
                body: competencyElement,
                responseType: 'json',
                ...(withCredentials ? { withCredentials } : {}),
                headers: localVarHeaders,
                observe: observe,
                transferCache: localVarTransferCache,
                reportProgress: reportProgress
            }
        );
    }

    public deleteCompetencyElement(id: string, observe?: 'body', reportProgress?: boolean, options?: {httpHeaderAccept?: 'application/json', context?: HttpContext, transferCache?: boolean}): Observable<any>;
    public deleteCompetencyElement(id: string, observe?: 'response', reportProgress?: boolean, options?: {httpHeaderAccept?: 'application/json', context?: HttpContext, transferCache?: boolean}): Observable<HttpResponse<any>>;
    public deleteCompetencyElement(id: string, observe?: 'events', reportProgress?: boolean, options?: {httpHeaderAccept?: 'application/json', context?: HttpContext, transferCache?: boolean}): Observable<HttpEvent<any>>;
    public deleteCompetencyElement(id: string, observe: any = 'body', reportProgress: boolean = false, options?: {httpHeaderAccept?: 'application/json', context?: HttpContext, transferCache?: boolean}): Observable<any> {
        if (id === null || id === undefined) {
            throw new Error('Required parameter id was null or undefined when calling deleteCompetencyElement.');
        }

        let localVarHeaders = this.defaultHeaders;
        localVarHeaders = this.configuration.addCredentialToHeaders('oauth2', 'Authorization', localVarHeaders, 'Bearer ');

        const localVarHttpHeaderAcceptSelected: string | undefined = options?.httpHeaderAccept ?? this.configuration.selectHeaderAccept(['application/json']);
        if (localVarHttpHeaderAcceptSelected !== undefined) {
            localVarHeaders = localVarHeaders.set('Accept', localVarHttpHeaderAcceptSelected);
        }

        const localVarHttpContext: HttpContext = options?.context ?? new HttpContext();
        const localVarTransferCache: boolean = options?.transferCache ?? true;

        let localVarPath = `/api/competencyelements/${this.configuration.encodeParam({name: "id", value: id, in: "path", style: "simple", explode: false, dataType: "string", dataFormat: "uuid"})}`;
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
