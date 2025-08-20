formatStatsSheet(ws, rowCount) {
        if (!ws['!ref']) return;
        
        ws['!cols'] = [
            { width: 25 },  // Libellé/Type
            { width: 15 },  // Valeur/Nombre
            { width: 15 },  // Pourcentage
            { width: 15 },  // Conformes
            { width: 15 }   // Non conformes
        ];

        const range = XLSX.utils.decode_range(ws['!ref']);
        
        for (let R = range.s.r; R <= range.e.r; ++R) {
            for (let C = range.s.c; C <= range.e.c; ++C) {
                const cell_address = XLSX.utils.encode_cell({ c: C, r: R });
                if (!ws[cell_address]) continue;

                ws[cell_address].s = {
                    alignment: { vertical: 'center', wrapText: true },
                    font: { name: 'Calibri', sz: 10 },
                    border: {
                        top: { style: 'thin', color: { rgb: '000000' } },
                        bottom: { style: 'thin', color: { rgb: '000000' } },
                        left: { style: 'thin', color: { rgb: '000000' } },
                        right: { style: 'thin', color: { rgb: '000000' } }
                    }
                };

                if (ws[cell_address].v && typeof ws[cell_address].v === 'string') {
                    if (ws[cell_address].v.includes('STATISTIQUES') || ws[cell_address].v.includes('RÉSUMÉ') || ws[cell_address].v.includes('RÉPARTITION')) {
                        ws[cell_address].s = {
                            ...ws[cell_address].s,
                            font: { name: 'Calibri', sz: 12, bold: true, color: { rgb: 'FFFFFF' } },
                            fill: { fgColor: { rgb: this.companyColors.secondary.substr(2) } },
                            alignment: { horizontal: 'center', vertical: 'center' }
                        };
                    }
                }
            }
        }

        ws['!merges'] = [
            { s: { c: 0, r: 0 }, e: { c: 4, r: 0 } },
            { s: { c: 0, r: 2 }, e: { c: 4, r: 2 } },
            { s: { c: 0, r: 9 }, e: { c: 4, r: 9 } }
        ];
    }

    // ====== MÉTHODES UTILITAIRES EXISTANTES ======

    getHistoryData() {
        return {
            controles: this.controles
        };
    }

    getStatistics() {
        const totalControles = this.controles.length;
        const conformes = this.controles.filter(c => c.conformiteGlobale === 'CONFORME').length;
        
        const thisMonth = new Date();
        thisMonth.setDate(1);
        const controlesMoisActuel = this.controles.filter(c => c.date >= thisMonth).length;
        
        const repartitionTypes = {};
        this.controles.forEach(c => {
            repartitionTypes[c.type] = (repartitionTypes[c.type] || 0) + 1;
        });
        
        const typePlusFrequent = Object.entries(repartitionTypes)
            .sort(([,a], [,b]) => b - a)[0]?.[0] || 'Aucun';

        const anomaliesMajeures = this.controles.reduce((sum, c) => sum + c.anomaliesMajeures, 0);
        
        return {
            totalControles,
            tauxConformite: totalControles > 0 ? Math.round((conformes / totalControles) * 100) : 0,
            totalAnomaliesMajeures: anomaliesMajeures,
            controlesMoisActuel,
            typePlusFrequent,
            repartitionTypes
        };
    }

    searchControls(criteria) {
        return this.controles.filter(controle => {
            if (criteria.dateDebut && controle.date < criteria.dateDebut) return false;
            if (criteria.dateFin && controle.date > criteria.dateFin) return false;
            if (criteria.type && controle.type !== criteria.type) return false;
            if (criteria.conseiller && !controle.conseiller.toLowerCase().includes(criteria.conseiller.toLowerCase())) return false;
            if (criteria.client && !controle.client.toLowerCase().includes(criteria.client.toLowerCase())) return false;
            if (criteria.conformite && controle.conformiteGlobale !== criteria.conformite) return false;
            
            return true;
        });
    }

    exportFiltered(criteria, fileName) {
        const filteredControles = this.searchControls(criteria);
        
        const originalControles = this.controles;
        this.controles = filteredControles;
        
        const result = this.saveToExcel(fileName);
        
        this.controles = originalControles;
        
        return result;
    }

    saveToStorage() {
        try {
            const dataToSave = this.controles.map(c => ({
                ...c,
                date: c.date.toISOString()
            }));
            localStorage.setItem('controles_historique', JSON.stringify(dataToSave));
            Utils.debugLog(`${this.controles.length} contrôles sauvegardés en localStorage`);
        } catch (error) {
            Utils.debugLog('Erreur sauvegarde localStorage: ' + error.message);
        }
    }

    loadFromStorage() {
        try {
            const saved = localStorage.getItem('controles_historique');
            if (saved) {
                const data = JSON.parse(saved);
                this.controles = data.map(c => ({
                    ...c,
                    date: new Date(c.date)
                }));
                Utils.debugLog(`${this.controles.length} contrôles chargés depuis localStorage`);
            }
        } catch (error) {
            Utils.debugLog('Erreur chargement localStorage: ' + error.message);
            this.controles = [];
        }
    }

    clearHistory() {
        this.controles = [];
        this.suspendedControls = [];
        this.controlledDossiers = new Map();
        
        localStorage.removeItem('controles_historique');
        localStorage.removeItem('controles_suspendus');
        localStorage.removeItem('dossiers_controles');
        
        Utils.showNotification('Historique complet effacé (terminés, suspendus et dossiers marqués)', 'info');
    }

    getControlsCount() {
        return this.controles.length;
    }

    exportBackupJSON() {
        const backupData = {
            version: "1.1",
            exportDate: new Date().toISOString(),
            totalControles: this.controles.length,
            totalSuspended: this.suspendedControls.length,
            controles: this.controles.map(c => ({
                ...c,
                date: c.date.toISOString()
            })),
            suspendedControles: this.suspendedControls.map(sc => ({
                ...sc,
                suspendedAt: sc.suspendedAt.toISOString()
            })),
            controlledDossiers: Array.from(this.controlledDossiers.entries()).map(([key, value]) => ({
                key,
                ...value,
                controlledAt: value.controlledAt.toISOString()
            }))
        };

        try {
            const dataStr = JSON.stringify(backupData, null, 2);
            const blob = new Blob([dataStr], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            
            const a = document.createElement('a');
            a.href = url;
            a.download = `Backup_Complet_${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            Utils.showNotification(
                `Sauvegarde complète créée: ${this.controles.length} terminés + ${this.suspendedControls.length} suspendus`, 
                'success'
            );
            return true;
            
        } catch (error) {
            console.error('Erreur export JSON:', error);
            Utils.showNotification('Erreur lors de la création de la sauvegarde JSON', 'error');
            return false;
        }
    }

    saveSuspendedControl(suspendedControl) {
        try {
            const existingIndex = this.suspendedControls.findIndex(sc => 
                sc.dossierKey === suspendedControl.dossierKey && 
                sc.type === suspendedControl.type
            );

            if (existingIndex !== -1) {
                this.suspendedControls[existingIndex] = suspendedControl;
                Utils.debugLog(`Contrôle suspendu mis à jour: ${suspendedControl.dossier.client}`);
            } else {
                this.suspendedControls.push(suspendedControl);
                Utils.debugLog(`Nouveau contrôle suspendu: ${suspendedControl.dossier.client}`);
            }

            this.saveSuspendedToStorage();
            return suspendedControl;

        } catch (error) {
            Utils.debugLog('Erreur sauvegarde contrôle suspendu: ' + error.message);
            console.error('Erreur sauvegarde suspendu:', error);
            return null;
        }
    }

    getSuspendedControl(dossierKey, controlType) {
        return this.suspendedControls.find(sc => 
            sc.dossierKey === dossierKey && 
            sc.type === controlType
        );
    }

    getSuspendedControlById(controlId) {
        return this.suspendedControls.find(sc => sc.id === controlId);
    }

    removeSuspendedControl(dossierKey, controlType) {
        const initialLength = this.suspendedControls.length;
        this.suspendedControls = this.suspendedControls.filter(sc => 
            !(sc.dossierKey === dossierKey && sc.type === controlType)
        );
        
        if (this.suspendedControls.length < initialLength) {
            this.saveSuspendedToStorage();
            Utils.debugLog(`Contrôle suspendu supprimé: ${dossierKey} (${controlType})`);
            return true;
        }
        return false;
    }

    getSuspendedControls() {
        return this.suspendedControls.sort((a, b) => new Date(b.suspendedAt) - new Date(a.suspendedAt));
    }

    markDossierAsControlled(dossierKey, controlType) {
        const key = `${dossierKey}_${controlType}`;
        this.controlledDossiers.set(key, {
            dossierKey,
            controlType,
            controlledAt: new Date(),
            status: 'controlled'
        });
        
        this.saveControlledDossiersToStorage();
        Utils.debugLog(`Dossier marqué comme contrôlé: ${dossierKey} (${controlType})`);
    }

    isDossierControlled(dossierKey, controlType) {
        const key = `${dossierKey}_${controlType}`;
        return this.controlledDossiers.has(key);
    }

    getDossierStatus(dossierKey, controlType) {
        const suspended = this.getSuspendedControl(dossierKey, controlType);
        if (suspended) {
            return {
                status: 'suspended',
                suspendedAt: suspended.suspendedAt,
                suspendReason: suspended.suspendReason
            };
        }

        if (this.isDossierControlled(dossierKey, controlType)) {
            const key = `${dossierKey}_${controlType}`;
            const controlled = this.controlledDossiers.get(key);
            return {
                status: 'controlled',
                controlledAt: controlled.controlledAt
            };
        }

        return { status: 'not_controlled' };
    }

    generateDossierKey(dossier) {
        return `${dossier.codeDossier || 'NO_CODE'}_${dossier.reference || 'NO_REF'}_${dossier.montant || 'NO_AMOUNT'}`;
    }

    exportSuspendedControls(fileName = null) {
        if (!fileName) {
            fileName = `Controles_Suspendus_${new Date().toISOString().split('T')[0]}.xlsx`;
        }

        if (this.suspendedControls.length === 0) {
            Utils.showNotification('Aucun contrôle suspendu à exporter', 'warning');
            return false;
        }

        try {
            const exportData = this.suspendedControls.map((suspended, index) => ({
                'N°': index + 1,
                'Date suspension': new Date(suspended.suspendedAt).toLocaleDateString('fr-FR'),
                'Type de contrôle': suspended.type,
                'Client': suspended.dossier.client,
                'Code dossier': suspended.dossier.codeDossier || 'N/A',
                'Conseiller': suspended.dossier.conseiller || 'N/A',
                'Montant': suspended.dossier.montant || 'N/A',
                'Domaine': suspended.dossier.domaine || 'N/A',
                'Questions répondues': Object.keys(suspended.responses || {}).length,
                'Dernier document': this.getDocumentName(suspended.lastDocument) || 'N/A',
                'Raison suspension': suspended.suspendReason || 'Non spécifiée',
                'Jours suspendus': Math.floor((new Date() - new Date(suspended.suspendedAt)) / (1000 * 60 * 60 * 24)),
                'Statut': 'SUSPENDU'
            }));

            const ws = XLSX.utils.json_to_sheet(exportData);
            const wb = XLSX.utils.book_new();
            
            this.formatSuspendedSheet(ws, exportData.length);
            
            XLSX.utils.book_append_sheet(wb, ws, "Controles_Suspendus");
            XLSX.writeFile(wb, fileName);
            
            Utils.showNotification(`Contrôles suspendus exportés: ${fileName}`, 'success');
            return true;

        } catch (error) {
            console.error('Erreur export suspendus:', error);
            Utils.showNotification('Erreur lors de l\'export des contrôles suspendus', 'error');
            return false;
        }
    }

    formatSuspendedSheet(ws, rowCount) {
        if (!ws['!ref']) return;
        
        const range = XLSX.utils.decode_range(ws['!ref']);
        
        ws['!cols'] = [
            { width: 8 },   // N°
            { width: 12 },  // Date
            { width: 16 },  // Type
            { width: 25 },  // Client
            { width: 15 },  // Code
            { width: 20 },  // Conseiller
            { width: 15 },  // Montant
            { width: 12 },  // Domaine
            { width: 12 },  // Questions
            { width: 15 },  // Dernier doc
            { width: 30 },  // Raison
            { width: 10 },  // Jours
            { width: 12 }   // Statut
        ];
        
        for (let R = range.s.r; R <= range.e.r; ++R) {
            for (let C = range.s.c; C <= range.e.c; ++C) {
                const cell_address = XLSX.utils.encode_cell({ c: C, r: R });
                if (!ws[cell_address]) continue;
                
                ws[cell_address].s = {
                    alignment: { vertical: 'center', wrapText: true },
                    font: { name: 'Calibri', sz: 10 },
                    border: {
                        top: { style: 'thin', color: { rgb: '000000' } },
                        bottom: { style: 'thin', color: { rgb: '000000' } },
                        left: { style: 'thin', color: { rgb: '000000' } },
                        right: { style: 'thin', color: { rgb: '000000' } }
                    }
                };
                
                if (R === 0) {
                    ws[cell_address].s = {
                        ...ws[cell_address].s,
                        font: { name: 'Calibri', sz: 11, bold: true, color: { rgb: 'FFFFFF' } },
                        fill: { fgColor: { rgb: this.companyColors.warning.substr(2) } },
                        alignment: { horizontal: 'center', vertical: 'center' }
                    };
                } else {
                    const isEvenRow = R % 2 === 0;
                    ws[cell_address].s.fill = { 
                        fgColor: { rgb: isEvenRow ? 'FFF8DC' : 'FFFACD' }
                    };
                    
                    if (C === range.e.c - 1) {
                        const days = parseInt(ws[cell_address].v) || 0;
                        if (days >= 30) {
                            ws[cell_address].s.fill = { fgColor: { rgb: this.companyColors.danger.substr(2) } };
                            ws[cell_address].s.font = { ...ws[cell_address].s.font, bold: true, color: { rgb: 'FFFFFF' } };
                        } else if (days >= 14) {
                            ws[cell_address].s.fill = { fgColor: { rgb: this.companyColors.warning.substr(2) } };
                            ws[cell_address].s.font = { ...ws[cell_address].s.font, bold: true };
                        }
                    }
                    
                    if (C === range.e.c) {
                        ws[cell_address].s.fill = { fgColor: { rgb: this.companyColors.warning.substr(2) } };
                        ws[cell_address].s.font = { ...ws[cell_address].s.font, bold: true };
                    }
                }
            }
        }
        
        ws['!autofilter'] = { ref: ws['!ref'] };
    }

    cleanOldSuspendedControls(daysThreshold = 90) {
        const threshold = new Date();
        threshold.setDate(threshold.getDate() - daysThreshold);
        
        const initialCount = this.suspendedControls.length;
        this.suspendedControls = this.suspendedControls.filter(sc => 
            new Date(sc.suspendedAt) > threshold
        );
        
        const cleanedCount = initialCount - this.suspendedControls.length;
        if (cleanedCount > 0) {
            this.saveSuspendedToStorage();
            Utils.debugLog(`${cleanedCount} contrôles suspendus anciens supprimés`);
        }
        
        return cleanedCount;
    }

    getFullSummary() {
        return {
            totalTermines: this.controles.length,
            totalSuspendus: this.suspendedControls.length,
            totalDossiersMarques: this.controlledDossiers.size,
            conformes: this.controles.filter(c => c.conformiteGlobale === 'CONFORME').length,
            nonConformes: this.controles.filter(c => c.conformiteGlobale === 'NON CONFORME').length,
            suspendusAnciens: this.suspendedControls.filter(sc => {
                const days = Math.floor((new Date() - new Date(sc.suspendedAt)) / (1000 * 60 * 60 * 24));
                return days >= 14;
            }).length,
            dernierControle: this.controles.length > 0 ? 
                this.controles[this.controles.length - 1].date : null,
            derniereSuspension: this.suspendedControls.length > 0 ? 
                new Date(Math.max(...this.suspendedControls.map(sc => new Date(sc.suspendedAt)))) : null
        };
    }

    exportFullExcel(fileName = null) {
        if (!fileName) {
            fileName = `Export_Complet_${new Date().toISOString().split('T')[0]}.xlsx`;
        }

        if (this.controles.length === 0 && this.suspendedControls.length === 0) {
            Utils.showNotification('Aucune donnée à exporter', 'warning');
            return false;
        }

        try {
            const wb = XLSX.utils.book_new();
            
            this.createOverviewSheet(wb);
            
            if (this.suspendedControls.length > 0) {
                this.createSuspendedOverviewSheet(wb);
            }
            
            this.createAllQuestionsSheet(wb);
            this.createEnhancedStatsSheet(wb);
            this.createEnhancedRawDataSheet(wb);
            
            XLSX.writeFile(wb, fileName);
            
            const summary = this.getFullSummary();
            Utils.showNotification(
                `Export complet généré: ${summary.totalTermines} terminés + ${summary.totalSuspendus} suspendus`, 
                'success'
            );
            return true;

        } catch (error) {
            console.error('Erreur export Excel complet:', error);
            Utils.showNotification('Erreur lors de l\'export complet: ' + error.message, 'error');
            return false;
        }
    }

    createSuspendedOverviewSheet(wb) {
        const suspendedData = [
            ['CONTRÔLES SUSPENDUS', '', '', '', '', '', '', '', '', ''],
            ['', '', '', '', '', '', '', '', '', ''],
            ['Date Suspension', 'Type', 'Client', 'Code Dossier', 'Conseiller', 'Questions', 'Dernier Doc', 'Jours', 'Raison', 'Statut']
        ];

        this.suspendedControls.forEach(suspended => {
            const daysSuspended = Math.floor((new Date() - new Date(suspended.suspendedAt)) / (1000 * 60 * 60 * 24));
            
            suspendedData.push([
                new Date(suspended.suspendedAt).toLocaleDateString('fr-FR'),
                suspended.type,
                suspended.dossier.client,
                suspended.dossier.codeDossier || 'N/A',
                suspended.dossier.conseiller || 'N/A',
                Object.keys(suspended.responses || {}).length,
                this.getDocumentName(suspended.lastDocument) || 'N/A',
                daysSuspended,
                suspended.suspendReason || 'Non spécifiée',
                'SUSPENDU'
            ]);
        });

        const ws = XLSX.utils.aoa_to_sheet(suspendedData);
        this.formatSuspendedOverviewSheet(ws, suspendedData.length);
        XLSX.utils.book_append_sheet(wb, ws, "Contrôles Suspendus");
    }

    formatSuspendedOverviewSheet(ws, rowCount) {
        if (!ws['!ref']) return;
        
        ws['!cols'] = [
            { width: 12 },  // Date
            { width: 16 },  // Type
            { width: 25 },  // Client
            { width: 15 },  // Code
            { width: 20 },  // Conseiller
            { width: 10 },  // Questions
            { width: 15 },  // Dernier Doc
            { width: 8 },   // Jours
            { width: 30 },  // Raison
            { width: 12 }   // Statut
        ];

        const range = XLSX.utils.decode_range(ws['!ref']);
        
        for (let R = range.s.r; R <= range.e.r; ++R) {
            for (let C = range.s.c; C <= range.e.c; ++C) {
                const cell_address = XLSX.utils.encode_cell({ c: C, r: R });
                if (!ws[cell_address]) continue;

                ws[cell_address].s = {
                    alignment: { vertical: 'center', wrapText: true },
                    font: { name: 'Calibri', sz: 10 },
                    border: {
                        top: { style: 'thin', color: { rgb: '000000' } },
                        bottom: { style: 'thin', color: { rgb: '000000' } },
                        left: { style: 'thin', color: { rgb: '000000' } },
                        right: { style: 'thin', color: { rgb: '000000' } }
                    }
                };

                if (R === 0) {
                    ws[cell_address].s = {
                        ...ws[cell_address].s,
                        font: { name: 'Calibri', sz: 14, bold: true, color: { rgb: 'FFFFFF' } },
                        fill: { fgColor: { rgb: this.companyColors.warning.substr(2) } },
                        alignment: { horizontal: 'center', vertical: 'center' }
                    };
                }
                else if (R === 2) {
                    ws[cell_address].s = {
                        ...ws[cell_address].s,
                        font: { name: 'Calibri', sz: 11, bold: true, color: { rgb: 'FFFFFF' } },
                        fill: { fgColor: { rgb: this.companyColors.secondary.substr(2) } },
                        alignment: { horizontal: 'center', vertical: 'center' }
                    };
                }
                else if (R > 2) {
                    ws[cell_address].s.fill = { fgColor: { rgb: 'FFFACD' } };
                    
                    if (C === 7) {
                        const days = parseInt(ws[cell_address].v) || 0;
                        if (days >= 30) {
                            ws[cell_address].s.fill = { fgColor: { rgb: this.companyColors.danger.substr(2) } };
                            ws[cell_address].s.font = { ...ws[cell_address].s.font, bold: true, color: { rgb: 'FFFFFF' } };
                        } else if (days >= 14) {
                            ws[cell_address].s.fill = { fgColor: { rgb: this.companyColors.warning.substr(2) } };
                            ws[cell_address].s.font = { ...ws[cell_address].s.font, bold: true };
                        }
                    }
                    
                    if (C === range.e.c) {
                        ws[cell_address].s.fill = { fgColor: { rgb: this.companyColors.warning.substr(2) } };
                        ws[cell_address].s.font = { ...ws[cell_address].s.font, bold: true };
                    }
                }
            }
        }

        ws['!merges'] = [{ s: { c: 0, r: 0 }, e: { c: 9, r: 0 } }];
        ws['!autofilter'] = { ref: `A3:${XLSX.utils.encode_col(range.e.c)}3` };
    }

    createEnhancedStatsSheet(wb) {
        this.createStatsSheet(wb);
    }

    createEnhancedRawDataSheet(wb) {
        const rawData = this.controles.map(c => ({
            'ID': c.id,
            'Date': c.date.toISOString().split('T')[0],
            'Type_Controle': c.type,
            'Client': c.client,
            'Code_Dossier': c.codeDossier,
            'Conseiller': c.conseiller,
            'Montant_Brut': c.montant,
            'Domaine': c.domaine,
            'Nouveau_Client': c.nouveauClient,
            'Type_Acte': c.typeActe,
            'Date_Envoi': c.dateEnvoi,
            'Statut': c.statut,
            'Anomalies_Majeures': c.anomaliesMajeures,
            'Documents_Controles': c.documentsControles,
            'Conformite_Globale': c.conformiteGlobale,
            'Nb_Details': c.details ? c.details.length : 0
        }));

        const ws = XLSX.utils.json_to_sheet(rawData);
        this.formatRawDataSheet(ws);
        XLSX.utils.book_append_sheet(wb, ws, "Données Brutes");
    }

    formatRawDataSheet(ws) {
        if (!ws['!ref']) return;
        
        const range = XLSX.utils.decode_range(ws['!ref']);
        
        for (let C = range.s.c; C <= range.e.c; ++C) {
            const cell_address = XLSX.utils.encode_cell({ c: C, r: 0 });
            if (ws[cell_address]) {
                ws[cell_address].s = {
                    font: { name: 'Calibri', sz: 11, bold: true, color: { rgb: 'FFFFFF' } },
                    fill: { fgColor: { rgb: this.companyColors.primary.substr(2) } },
                    alignment: { horizontal: 'center', vertical: 'center' },
                    border: {
                        top: { style: 'thin', color: { rgb: '000000' } },
                        bottom: { style: 'thin', color: { rgb: '000000' } },
                        left: { style: 'thin', color: { rgb: '000000' } },
                        right: { style: 'thin', color: { rgb: '000000' } }
                    }
                };
            }
        }

        ws['!autofilter'] = { ref: ws['!ref'] };
    }

    importBackupJSON(file) {
        if (!file) return;

        const reader = new FileReader();
        
    importBackupJSON(file) {
        if (!file) return;

        const reader = new FileReader();
        
        reader.onload = (e) => {
            try {
                const backupData = JSON.parse(e.target.result);
                
                if (!backupData.controles || !Array.isArray(backupData.controles)) {
                    throw new Error('Format de sauvegarde invalide');
                }
                
                const hasExtendedData = backupData.version >= "1.1" || backupData.suspendedControles;
                const suspendedCount = backupData.suspendedControles ? backupData.suspendedControles.length : 0;
                const controlledCount = backupData.controlledDossiers ? backupData.controlledDossiers.length : 0;
                
                let confirmMessage = `Importer ${backupData.controles.length} contrôle(s) terminé(s)`;
                if (hasExtendedData) {
                    confirmMessage += `\n+ ${suspendedCount} contrôle(s) suspendu(s)`;
                    confirmMessage += `\n+ ${controlledCount} dossier(s) marqué(s) comme contrôlé(s)`;
                }
                confirmMessage += `\n\nDate de sauvegarde: ${new Date(backupData.exportDate).toLocaleDateString('fr-FR')}`;
                confirmMessage += `\n\nACTUEL:`;
                confirmMessage += `\n- ${this.controles.length} contrôle(s) terminé(s)`;
                confirmMessage += `\n- ${this.suspendedControls.length} contrôle(s) suspendu(s)`;
                confirmMessage += `\n\nAttention: Cela remplacera complètement toutes les données actuelles`;
                
                const confirmed = confirm(confirmMessage);
                
                if (!confirmed) {
                    Utils.showNotification('Import annulé', 'info');
                    return;
                }
                
                this.controles = backupData.controles.map(c => ({
                    ...c,
                    date: new Date(c.date)
                }));
                
                if (backupData.suspendedControles && Array.isArray(backupData.suspendedControles)) {
                    this.suspendedControls = backupData.suspendedControles.map(sc => ({
                        ...sc,
                        suspendedAt: new Date(sc.suspendedAt)
                    }));
                } else {
                    this.suspendedControls = [];
                }
                
                if (backupData.controlledDossiers && Array.isArray(backupData.controlledDossiers)) {
                    this.controlledDossiers = new Map();
                    backupData.controlledDossiers.forEach(item => {
                        this.controlledDossiers.set(item.key, {
                            dossierKey: item.dossierKey,
                            controlType: item.controlType,
                            controlledAt: new Date(item.controlledAt),
                            status: item.status
                        });
                    });
                } else {
                    this.controlledDossiers = new Map();
                }
                
                this.saveToStorage();
                this.saveSuspendedToStorage();
                this.saveControlledDossiersToStorage();
                
                let successMessage = `Historique importé avec succès:`;
                successMessage += `\n• ${this.controles.length} contrôle(s) terminé(s)`;
                successMessage += `\n• ${this.suspendedControls.length} contrôle(s) suspendu(s)`;
                successMessage += `\n• ${this.controlledDossiers.size} dossier(s) marqué(s)`;
                
                Utils.showNotification(successMessage, 'success');
                
                if (window.historyInterface && window.historyInterface.isHistorySectionActive()) {
                    window.historyInterface.refresh();
                }
                
                Utils.debugLog(`Import réussi: ${this.controles.length} terminés, ${this.suspendedControls.length} suspendus, ${this.controlledDossiers.size} dossiers`);
                
            } catch (error) {
                console.error('Erreur import JSON:', error);
                Utils.showNotification('Erreur lors de l\'import: ' + error.message, 'error');
            }
        };
        
        reader.onerror = () => {
            Utils.showNotification('Erreur de lecture du fichier', 'error');
        };
        
        reader.readAsText(file);
    }

    saveSuspendedToStorage() {
        try {
            const dataToSave = this.suspendedControls.map(sc => ({
                ...sc,
                suspendedAt: sc.suspendedAt.toISOString()
            }));
            localStorage.setItem('controles_suspendus', JSON.stringify(dataToSave));
            Utils.debugLog(`${this.suspendedControls.length} contrôles suspendus sauvegardés`);
        } catch (error) {
            Utils.debugLog('Erreur sauvegarde contrôles suspendus: ' + error.message);
        }
    }

    loadSuspendedFromStorage() {
        try {
            const saved = localStorage.getItem('controles_suspendus');
            if (saved) {
                const data = JSON.parse(saved);
                this.suspendedControls = data.map(sc => ({
                    ...sc,
                    suspendedAt: new Date(sc.suspendedAt)
                }));
                Utils.debugLog(`${this.suspendedControls.length} contrôles suspendus chargés`);
            }
        } catch (error) {
            Utils.debugLog('Erreur chargement contrôles suspendus: ' + error.message);
            this.suspendedControls = [];
        }
    }

    saveControlledDossiersToStorage() {
        try {
            const dataToSave = Array.from(this.controlledDossiers.entries()).map(([key, value]) => ({
                key,
                ...value,
                controlledAt: value.controlledAt.toISOString()
            }));
            localStorage.setItem('dossiers_controles', JSON.stringify(dataToSave));
            Utils.debugLog(`${this.controlledDossiers.size} dossiers contrôlés sauvegardés`);
        } catch (error) {
            Utils.debugLog('Erreur sauvegarde dossiers contrôlés: ' + error.message);
        }
    }

    loadControlledDossiersFromStorage() {
        try {
            const saved = localStorage.getItem('dossiers_controles');
            if (saved) {
                const data = JSON.parse(saved);
                this.controlledDossiers = new Map();
                data.forEach(item => {
                    this.controlledDossiers.set(item.key, {
                        dossierKey: item.dossierKey,
                        controlType: item.controlType,
                        controlledAt: new Date(item.controlledAt),
                        status: item.status
                    });
                });
                Utils.debugLog(`${this.controlledDossiers.size} dossiers contrôlés chargés`);
            }
        } catch (error) {
            Utils.debugLog('Erreur chargement dossiers contrôlés: ' + error.message);
            this.controlledDossiers = new Map();
        }
    }
}
