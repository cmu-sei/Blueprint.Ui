// Copyright 2022 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license, please see LICENSE.md in the project root for license information or contact permission@sei.cmu.edu for full terms.

import { Observable, config } from 'rxjs';
import { MatLegacyDialogRef as MatDialogRef, MatLegacyDialog as MatDialog, MAT_LEGACY_DIALOG_DATA as MAT_DIALOG_DATA } from '@angular/material/legacy-dialog';
import { Injectable } from '@angular/core';
import { ConfirmDialogComponent } from 'src/app/components/shared/confirm-dialog/confirm-dialog.component';


@Injectable()
export class DialogService {

    constructor(private dialog: MatDialog) { }

    public confirm(title: string, message: string, data?: any): Observable<boolean> {

        let dialogRef: MatDialogRef<ConfirmDialogComponent>;
        dialogRef = this.dialog.open(ConfirmDialogComponent, {data: data || {} });
        dialogRef.componentInstance.title = title;
        dialogRef.componentInstance.message = message;

        return dialogRef.afterClosed();
    }

}


