// ExcelFormatter amélioré - Format tableau professionnel sans colonnes inutiles

class ExcelFormatter {
    constructor() {
        this.companyColors = {
            primary: 'FF1A1A2E',      // Bleu foncé
            secondary: 'FFD4AF37',    // Or
            success: 'FF28A745',      // Vert
            warning: 'FFFFC107',      // Jaune
            danger: 'FFDC3545',       // Rouge
            light: 'FFF8F9FA',        // Gris clair
            dark: 'FF343A40'          // Gris foncé
        };
    }

    // Export formaté pour un contrôle individuel - FORMAT TABLEAU
    exportFormattedControl(controlData, fileName) {
        const wb = XLSX.utils.book_new();
        
        // Préparer les données en format tableau classique
        const exportData = this.prepareControlDataTable(controlData);
        
        // Créer la feuille
        const ws = XLSX.utils.json_to_sheet(exportData);
        
        // Appliquer le formatage tableau professionnel
        this.formatControlWorksheetTable(ws, exportData, controlData);
        
        // Ajouter au classeur
        XLSX.utils.book_append_sheet(wb, ws, "Controle_Documentaire");
        
        // Télécharger
        XLSX.writeFile(wb, fileName);
        
        return true;
    }

    // Préparer les données en format tableau classique (SANS colonne Type inutile)
    prepareControlDataTable(controlData) {
        const dossier = controlData.dossier;
        const control = controlData.control;
        const totalDocs = Object.keys(controlData.documents || {}).length;
        const completedDocs = Object.values(controlData.documents || {}).filter(d => d.status === 'completed').length;
        const obligatoryIssues = controlData.obligatoryIssuesCount || 0;

        // Format tableau simple et propre
        const exportData = [{
            'Date de contrôle': controlData.completedAt ? controlData.completedAt.toLocaleDateString('fr-FR') : new Date().toLocaleDateString('fr-FR'),
            'Type de contrôle': control.definition.name,
            'Client': dossier.client,
            'Code dossier': dossier.codeDossier || 'Non renseigné',
            'Conseiller': dossier.conseiller || 'Non renseigné',
            'Montant': dossier.montant || 'Non renseigné',
            'Domaine': dossier.domaine || 'Non renseigné',
            'Nouveau client': dossier.nouveauClient || 'Non renseigné',
            'Documents contrôlés': `${completedDocs}/${totalDocs}`,
            'Anomalies majeures': obligatoryIssues,
            'Statut global': obligatoryIssues === 0 ? 'CONFORME' : 'NON CONFORME'
        }];

        // Ajouter le détail par document
        Object.entries(controlData.documents || {}).forEach(([docId, docState]) => {
            const docName = this.getDocumentName(docId);
            const responses = controlData.responses[docId] || {};
            
            // Collecter les anomalies
            const anomalies = Object.values(responses)
                .filter(r => r.answer === 'Non' || r.quality === 'Non conforme')
                .map(r => r.question);
            
            // Collecter les justifications
            const justifications = Object.values(responses)
                .filter(r => r.justification)
                .map(r => r.justification);

            const totalQuestions = Object.keys(responses).length;
            const conformeQuestions = Object.values(responses).filter(r => 
                r.answer === 'Oui' && r.quality !== 'Non conforme'
            ).length;

            exportData.push({
                'Date de contrôle': '', // Vide pour les lignes de détail
                'Type de contrôle': '',
                'Client': '',
                'Code dossier': '',
                'Conseiller': '',
                'Montant': '',
                'Domaine': '',
                'Nouveau client': '',
                'Documents contrôlés': docName,
                'Anomalies majeures': docState.status === 'completed' ? 'Contrôlé' : 'Non contrôlé',
                'Statut global': anomalies.length === 0 ? 'Conforme' : `${anomalies.length} anomalie(s)`
            });

            // Ajouter les détails des anomalies si il y en a
            if (anomalies.length > 0) {
                anomalies.forEach(anomalie => {
                    exportData.push({
                        'Date de contrôle': '',
                        'Type de contrôle': '',
                        'Client': '',
                        'Code dossier': '',
                        'Conseiller': '',
                        'Montant': '',
                        'Domaine': '',
                        'Nouveau client': '',
                        'Documents contrôlés': `  → ${anomalie}`,
                        'Anomalies majeures': 'Détail',
                        'Statut global': 'Non conforme'
                    });
                });
            }
        });
        
        return exportData;
    }

    // Formatage tableau professionnel avec couleurs et bordures
    formatControlWorksheetTable(ws, data, controlData) {
        if (!ws['!ref']) return;
        
        const range = XLSX.utils.decode_range(ws['!ref']);
        
        // Largeurs de colonnes optimisées
        ws['!cols'] = [
            { width: 12 },  // Date
            { width: 16 },  // Type
            { width: 25 },  // Client
            { width: 15 },  // Code
            { width: 20 },  // Conseiller
            { width: 15 },  // Montant
            { width: 12 },  // Domaine
            { width: 12 },  // Nouveau
            { width: 18 },  // Documents
            { width: 12 },  // Anomalies
            { width: 15 }   // Statut
        ];

        // Appliquer les styles cellule par cellule
        for (let R = range.s.r; R <= range.e.r; ++R) {
            for (let C = range.s.c; C <= range.e.c; ++C) {
                const cell_address = XLSX.utils.encode_cell({ c: C, r: R });
                if (!ws[cell_address]) continue;

                // Style de base avec bordures
                ws[cell_address].s = {
                    alignment: { vertical: 'center', horizontal: 'left', wrapText: true },
                    font: { name: 'Calibri', sz: 10 },
                    border: {
                        top: { style: 'thin', color: { rgb: '000000' } },
                        bottom: { style: 'thin', color: { rgb: '000000' } },
                        left: { style: 'thin', color: { rgb: '000000' } },
                        right: { style: 'thin', color: { rgb: '000000' } }
                    }
                };

                // En-têtes (première ligne) - Style bleu foncé
                if (R === 0) {
                    ws[cell_address].s = {
                        ...ws[cell_address].s,
                        font: { name: 'Calibri', sz: 11, bold: true, color: { rgb: 'FFFFFF' } },
                        fill: { fgColor: { rgb: this.companyColors.primary.substr(2) } },
                        alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
                        border: {
                            top: { style: 'medium', color: { rgb: '000000' } },
                            bottom: { style: 'medium', color: { rgb: '000000' } },
                            left: { style: 'medium', color: { rgb: '000000' } },
                            right: { style: 'medium', color: { rgb: '000000' } }
                        }
                    };
                }
                // Ligne principale de contrôle (ligne 1) - Style doré
                else if (R === 1) {
                    ws[cell_address].s = {
                        ...ws[cell_address].s,
                        font: { name: 'Calibri', sz: 10, bold: true },
                        fill: { fgColor: { rgb: this.companyColors.secondary.substr(2) } },
                        border: {
                            top: { style: 'medium', color: { rgb: '000000' } },
                            bottom: { style: 'medium', color: { rgb: '000000' } },
                            left: { style: 'medium', color: { rgb: '000000' } },
                            right: { style: 'medium', color: { rgb: '000000' } }
                        }
                    };

                    // Coloration conditionnelle pour le statut global (colonne 10)
                    if (C === 10) {
                        const cellValue = ws[cell_address].v;
                        if (cellValue === 'CONFORME') {
                            ws[cell_address].s.fill = { fgColor: { rgb: this.companyColors.success.substr(2) } };
                            ws[cell_address].s.font.color = { rgb: 'FFFFFF' };
                        } else if (cellValue === 'NON CONFORME') {
                            ws[cell_address].s.fill = { fgColor: { rgb: this.companyColors.danger.substr(2) } };
                            ws[cell_address].s.font.color = { rgb: 'FFFFFF' };
                        }
                    }
                }
                // Lignes de détail documents
                else {
                    const isEvenRow = R % 2 === 0;
                    ws[cell_address].s.fill = { 
                        fgColor: { rgb: isEvenRow ? 'FFFFFF' : this.companyColors.light.substr(2) } 
                    };

                    // Identifier les lignes de détail d'anomalies (commencent par "  →")
                    const documentsCell = ws[XLSX.utils.encode_cell({ c: 8, r: R })];
                    if (documentsCell && documentsCell.v && documentsCell.v.toString().startsWith('  →')) {
                        // Style spécial pour les détails d'anomalies
                        ws[cell_address].s.fill = { fgColor: { rgb: 'FFEEEE' } }; // Rouge très clair
                        ws[cell_address].s.font = { ...ws[cell_address].s.font, italic: true };
                    }

                    // Coloration conditionnelle pour le statut des documents (colonne 10)
                    if (C === 10) {
                        const cellValue = ws[cell_address].v;
                        if (cellValue === 'Conforme') {
                            ws[cell_address].s.font.color = { rgb: this.companyColors.success.substr(2) };
                            ws[cell_address].s.font.bold = true;
                        } else if (cellValue === 'Non conforme' || (cellValue && cellValue.toString().includes('anomalie'))) {
                            ws[cell_address].s.font.color = { rgb: this.companyColors.danger.substr(2) };
                            ws[cell_address].s.font.bold = true;
                        }
                    }

                    // Coloration pour les anomalies (colonne 9)
                    if (C === 9) {
                        const cellValue = ws[cell_address].v;
                        if (cellValue === 'Contrôlé') {
                            ws[cell_address].s.font.color = { rgb: this.companyColors.success.substr(2) };
                        } else if (cellValue === 'Non contrôlé') {
                            ws[cell_address].s.font.color = { rgb: this.companyColors.warning.substr(2) };
                        }
                    }
                }
            }
        }

        // Figer les en-têtes
        ws['!freeze'] = { xSplit: 0, ySplit: 1 };

        // Filtres automatiques
        ws['!autofilter'] = { ref: `A1:${XLSX.utils.encode_col(range.e.c)}1` };
    }

    // Export formaté pour l'historique (format tableau simple)
    exportFormattedHistory(historyData, fileName) {
        const wb = XLSX.utils.book_new();
        
        // Préparer les données
        const exportData = this.prepareHistoryDataTable(historyData);
        
        // Créer la feuille
        const ws = XLSX.utils.json_to_sheet(exportData);
        
        // Appliquer le formatage
        this.formatHistoryWorksheetTable(ws, exportData);
        
        // Ajouter au classeur
        XLSX.utils.book_append_sheet(wb, ws, "Historique_Controles");
        
        // Télécharger
        XLSX.writeFile(wb, fileName);
        
        return true;
    }

    // Préparer les données d'historique en format tableau
    prepareHistoryDataTable(historyData) {
        return historyData.map(control => ({
            'Date': new Date(control.date).toLocaleDateString('fr-FR'),
            'Type de contrôle': control.type,
            'Client': control.client,
            'Code dossier': control.codeDossier,
            'Conseiller': control.conseiller,
            'Montant': control.montant,
            'Domaine': control.domaine,
            'Statut': control.statut || 'Terminé',
            'Anomalies': control.obligatoryIssues || 0,
            'Résultats': control.resultats
        }));
    }

    // Formatage historique avec tableau professionnel
    formatHistoryWorksheetTable(ws, data) {
        if (!ws['!ref']) return;
        
        const range = XLSX.utils.decode_range(ws['!ref']);
        
        // Largeurs de colonnes optimisées
        ws['!cols'] = [
            { width: 12 },  // Date
            { width: 16 },  // Type
            { width: 25 },  // Client
            { width: 15 },  // Code
            { width: 20 },  // Conseiller
            { width: 15 },  // Montant
            { width: 12 },  // Domaine
            { width: 12 },  // Statut
            { width: 10 },  // Anomalies
            { width: 25 }   // Résultats
        ];
        
        for (let R = range.s.r; R <= range.e.r; ++R) {
            for (let C = range.s.c; C <= range.e.c; ++C) {
                const cell_address = XLSX.utils.encode_cell({ c: C, r: R });
                if (!ws[cell_address]) continue;
                
                // Style par défaut avec bordures
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
                
                // En-têtes (première ligne)
                if (R === 0) {
                    ws[cell_address].s = {
                        ...ws[cell_address].s,
                        font: { name: 'Calibri', sz: 11, bold: true, color: { rgb: 'FFFFFF' } },
                        fill: { fgColor: { rgb: this.companyColors.primary.substr(2) } },
                        alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
                        border: {
                            top: { style: 'medium', color: { rgb: '000000' } },
                            bottom: { style: 'medium', color: { rgb: '000000' } },
                            left: { style: 'medium', color: { rgb: '000000' } },
                            right: { style: 'medium', color: { rgb: '000000' } }
                        }
                    };
                } else {
                    // Alternance de couleurs pour les lignes
                    const isEvenRow = R % 2 === 0;
                    ws[cell_address].s.fill = { 
                        fgColor: { rgb: isEvenRow ? 'FFFFFF' : this.companyColors.light.substr(2) } 
                    };
                    
                    // Coloration conditionnelle pour les anomalies (colonne 8)
                    if (C === 8 && ws[cell_address].v !== undefined) {
                        const anomalies = parseInt(ws[cell_address].v) || 0;
                        if (anomalies > 0) {
                            ws[cell_address].s.font = { 
                                ...ws[cell_address].s.font, 
                                color: { rgb: this.companyColors.danger.substr(2) }, 
                                bold: true 
                            };
                        } else {
                            ws[cell_address].s.font = { 
                                ...ws[cell_address].s.font, 
                                color: { rgb: this.companyColors.success.substr(2) },
                                bold: true
                            };
                        }
                    }
                    
                    // Coloration pour le statut (colonne 7)
                    if (C === 7 && ws[cell_address].v) {
                        const status = ws[cell_address].v.toString().toLowerCase();
                        if (status.includes('conforme') && !status.includes('non')) {
                            ws[cell_address].s.font = { 
                                ...ws[cell_address].s.font, 
                                color: { rgb: this.companyColors.success.substr(2) },
                                bold: true
                            };
                        } else if (status.includes('non conforme')) {
                            ws[cell_address].s.font = { 
                                ...ws[cell_address].s.font, 
                                color: { rgb: this.companyColors.danger.substr(2) },
                                bold: true
                            };
                        }
                    }
                }
            }
        }
        
        // Figer la première ligne
        ws['!freeze'] = { xSplit: 0, ySplit: 1 };
        
        // Filtres automatiques
        ws['!autofilter'] = { ref: ws['!ref'] };
    }

    // Utilitaire pour obtenir le nom du document
    getDocumentName(docId) {
        const documentNames = {
            1: 'FR',
            2: 'Profil Risques',
            3: 'Profil ESG',
            4: 'Carto Client',
            7: 'CNI',
            8: 'Justificatif Domicile',
            10: 'RIB'
        };
        return documentNames[docId] || `Document ${docId}`;
    }
}