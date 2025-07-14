// controlHistory.js - Gestion de l'historique des contrôles avec export Excel formaté amélioré

import { Utils } from './utils.js';

// ExcelFormatter amélioré - Format tableau professionnel
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

export class ControlHistory {
    constructor() {
        this.historyData = [];
        this.currentSessionControls = [];
        this.historyFile = null;
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Écouter les contrôles terminés
        window.addEventListener('controlCompleted', (e) => {
            this.addControlToHistory(e.detail);
        });
        
        // Écouter les contrôles sauvegardés temporairement
        window.addEventListener('controlSaved', (e) => {
            this.updateControlInHistory(e.detail);
        });
    }

    // Initialiser avec un fichier historique optionnel
    loadHistoryFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = (e) => {
                try {
                    const data = new Uint8Array(e.target.result);
                    const workbook = XLSX.read(data, { type: 'array' });
                    
                    // Chercher l'onglet historique
                    const historySheetName = this.findHistorySheet(workbook);
                    
                    if (historySheetName) {
                        const worksheet = workbook.Sheets[historySheetName];
                        this.parseHistorySheet(worksheet);
                        this.historyFile = file;
                        
                        Utils.debugLog(`Historique chargé: ${this.historyData.length} contrôles trouvés`);
                        Utils.showNotification(`Historique chargé avec succès (${this.historyData.length} contrôles)`, 'success');
                        resolve(this.historyData);
                    } else {
                        // Aucun onglet historique trouvé, créer une structure vide
                        Utils.debugLog('Aucun onglet historique trouvé, nouveau fichier historique');
                        Utils.showNotification('Fichier historique initialisé', 'info');
                        resolve([]);
                    }
                } catch (error) {
                    Utils.debugLog('Erreur lecture historique: ' + error.message);
                    reject(error);
                }
            };
            
            reader.onerror = () => reject(new Error('Erreur lecture fichier historique'));
            reader.readAsArrayBuffer(file);
        });
    }

    findHistorySheet(workbook) {
        // Chercher l'onglet historique avec différents noms possibles
        const possibleNames = [
            'Historique_Controles', 
            'Historique', 
            'History', 
            'Controles',
            'HistoriqueControles'
        ];
        
        for (const name of possibleNames) {
            if (workbook.Sheets[name]) {
                return name;
            }
        }
        
        return null;
    }

    parseHistorySheet(worksheet) {
        try {
            // Convertir la feuille en JSON
            const jsonData = XLSX.utils.sheet_to_json(worksheet, {
                header: 1,
                defval: '',
                raw: false
            });
            
            if (jsonData.length < 2) {
                this.historyData = [];
                return;
            }
            
            // La première ligne contient les en-têtes
            const headers = jsonData[0];
            const dataRows = jsonData.slice(1);
            
            this.historyData = dataRows
                .filter(row => row && row.length > 0 && row[0]) // Filtrer les lignes vides
                .map((row, index) => {
                    return {
                        id: Date.now() + index, // ID unique
                        date: this.parseDate(row[0]) || new Date(),
                        type: row[1] || '',
                        client: row[2] || '',
                        codeDossier: row[3] || '',
                        conseiller: row[4] || '',
                        statut: row[5] || 'Terminé',
                        obligatoryIssues: parseInt(row[6]) || 0,
                        totalDocuments: parseInt(row[7]) || 0,
                        completedDocuments: parseInt(row[8]) || 0,
                        montant: row[9] || '',
                        domaine: row[10] || '',
                        resultats: row[11] || '',
                        originalRowIndex: index + 2 // +2 car ligne 1 = headers, index 0-based
                    };
                });
                
        } catch (error) {
            Utils.debugLog('Erreur parsing historique: ' + error.message);
            this.historyData = [];
        }
    }

    parseDate(dateValue) {
        if (!dateValue) return null;
        
        // Si c'est un nombre Excel (date)
        if (typeof dateValue === 'number') {
            try {
                const date = XLSX.SSF.parse_date_code(dateValue);
                return new Date(date.y, date.m - 1, date.d);
            } catch (e) {
                return null;
            }
        }
        
        // Si c'est une chaîne
        if (typeof dateValue === 'string') {
            const date = new Date(dateValue);
            return isNaN(date.getTime()) ? null : date;
        }
        
        return null;
    }

    // Ajouter un contrôle à l'historique
    addControlToHistory(controlData) {
        const historyEntry = {
            id: Date.now(),
            date: new Date(),
            type: controlData.control.definition.name,
            client: controlData.dossier.client,
            codeDossier: controlData.dossier.codeDossier || '',
            conseiller: controlData.dossier.conseiller || '',
            statut: 'Terminé',
            obligatoryIssues: controlData.obligatoryIssuesCount || 0,
            totalDocuments: Object.keys(controlData.documents).length,
            completedDocuments: Object.values(controlData.documents).filter(d => d.status === 'completed').length,
            montant: controlData.dossier.montant || '',
            domaine: controlData.dossier.domaine || '',
            resultats: this.generateResultsSummary(controlData)
        };
        
        // Ajouter à l'historique
        this.historyData.push(historyEntry);
        this.currentSessionControls.push(historyEntry);
        
        Utils.debugLog(`Contrôle ajouté à l'historique: ${historyEntry.client}`);
        
        // Mettre à jour l'interface si elle est visible
        this.updateHistoryInterface();
    }

    generateResultsSummary(controlData) {
        const issues = [];
        
        Object.values(controlData.responses || {}).forEach(docResponses => {
            Object.values(docResponses).forEach(response => {
                if (response.answer === 'Non' && response.obligation === 'Obligatoire') {
                    issues.push('Élément obligatoire manquant');
                } else if (response.answer === 'Oui' && response.quality === 'Incorrect') {
                    issues.push('Qualité incorrecte');
                }
            });
        });
        
        if (issues.length === 0) {
            return 'Conforme';
        } else {
            return `${issues.length} anomalie(s) détectée(s)`;
        }
    }

    // Mettre à jour un contrôle dans l'historique
    updateControlInHistory(controlData) {
        const existingIndex = this.historyData.findIndex(h => 
            h.client === controlData.dossier.client && 
            h.codeDossier === controlData.dossier.codeDossier &&
            h.type === controlData.control.definition.name
        );
        
        if (existingIndex !== -1) {
            this.historyData[existingIndex].statut = 'En cours';
            this.historyData[existingIndex].date = new Date();
        }
        
        this.updateHistoryInterface();
    }

    // Vérifier si un dossier a déjà été contrôlé récemment
    isDossierRecentlyControlled(dossier, controlType, daysThreshold = 90) {
        const threshold = new Date();
        threshold.setDate(threshold.getDate() - daysThreshold);
        
        return this.historyData.some(h => 
            h.codeDossier === dossier.codeDossier &&
            h.type === controlType &&
            h.statut === 'Terminé' &&
            new Date(h.date) > threshold
        );
    }

    // Filtrer les dossiers pour éviter les doublons
    filterEligibleDossiers(dossiers, controlType) {
        return dossiers.filter(dossier => 
            !this.isDossierRecentlyControlled(dossier, controlType)
        );
    }

    // Obtenir l'historique pour l'interface
    getHistoryData() {
        return this.historyData.sort((a, b) => new Date(b.date) - new Date(a.date));
    }

    // Obtenir les contrôles de la session courante
    getCurrentSessionControls() {
        return this.currentSessionControls;
    }

    // Mettre à jour l'interface historique
    updateHistoryInterface() {
        const historySection = document.getElementById('history-section');
        if (!historySection || !historySection.classList.contains('active')) return;
        
        this.showHistoryInterface();
    }

    // Afficher l'interface historique
    showHistoryInterface() {
        Utils.showSection('history-section');
        
        const section = document.getElementById('history-section');
        if (!section) return;
        
        // Mettre à jour le contenu
        this.generateHistoryContent(section);
    }

    generateHistoryContent(section) {
        const historyData = this.getHistoryData();
        const sessionControls = this.getCurrentSessionControls();
        
        section.innerHTML = `
            <h2 class="section-title">Historique des contrôles</h2>
            
            <div class="history-summary">
                <div class="summary-cards">
                    <div class="summary-card">
                        <div class="card-value">${historyData.length}</div>
                        <div class="card-label">Total contrôles</div>
                    </div>
                    <div class="summary-card session">
                        <div class="card-value">${sessionControls.length}</div>
                        <div class="card-label">Cette session</div>
                    </div>
                    <div class="summary-card">
                        <div class="card-value">${historyData.filter(h => h.statut === 'Terminé').length}</div>
                        <div class="card-label">Terminés</div>
                    </div>
                </div>
            </div>
            
            <div class="history-actions">
                <button class="btn btn-success" onclick="window.controlHistory?.exportAllControls()" 
                        ${sessionControls.length === 0 ? 'disabled' : ''}>
                    Exporter cette session (${sessionControls.length})
                </button>
                <button class="btn btn-primary" onclick="window.controlHistory?.exportHistoryFile()">
                    Télécharger historique complet
                </button>
                <button class="btn btn-secondary" onclick="showAutomaticControls()">
                    Retour aux contrôles
                </button>
            </div>
            
            <div class="history-table-container">
                <table class="history-table">
                    <thead>
                        <tr>
                            <th>Date</th>
                            <th>Type</th>
                            <th>Client</th>
                            <th>Code Dossier</th>
                            <th>Conseiller</th>
                            <th>Statut</th>
                            <th>Résultats</th>
                            <th>Session</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${this.generateHistoryRows(historyData, sessionControls)}
                    </tbody>
                </table>
            </div>
        `;
    }

    generateHistoryRows(historyData, sessionControls) {
        if (historyData.length === 0) {
            return `
                <tr>
                    <td colspan="8" style="text-align: center; padding: 40px; color: #6c757d;">
                        Aucun contrôle dans l'historique
                    </td>
                </tr>
            `;
        }
        
        return historyData.map(control => {
            const isSessionControl = sessionControls.some(sc => sc.id === control.id);
            const rowClass = isSessionControl ? 'session-row' : '';
            const sessionBadge = isSessionControl ? '<span class="badge session">Nouvelle</span>' : '';
            
            return `
                <tr class="${rowClass}">
                    <td>${new Date(control.date).toLocaleDateString('fr-FR')}</td>
                    <td>${control.type}</td>
                    <td>${control.client}</td>
                    <td>${control.codeDossier}</td>
                    <td>${control.conseiller}</td>
                    <td><span class="badge ${control.statut.toLowerCase()}">${control.statut}</span></td>
                    <td>${control.resultats}</td>
                    <td>${sessionBadge}</td>
                </tr>
            `;
        }).join('');
    }

    // MÉTHODE MISE À JOUR : Exporter tous les contrôles de la session avec formatage
    exportAllControls() {
        if (this.currentSessionControls.length === 0) {
            Utils.showNotification('Aucun contrôle à exporter dans cette session', 'warning');
            return;
        }
        
        const formatter = new ExcelFormatter();
        const fileName = Utils.generateFileName('Export_Session_Controles');
        
        try {
            formatter.exportFormattedHistory(this.currentSessionControls, fileName);
            Utils.showNotification(`Session exportée avec formatage: ${this.currentSessionControls.length} contrôle(s)`, 'success');
        } catch (error) {
            // Fallback vers l'ancienne méthode
            console.error('Erreur formatage Excel:', error);
            Utils.showNotification('Export de session réalisé en mode simple', 'warning');
            
            const exportData = this.currentSessionControls.map(control => ({
                'Date': new Date(control.date).toLocaleDateString('fr-FR'),
                'Type de contrôle': control.type,
                'Client': control.client,
                'Code dossier': control.codeDossier,
                'Conseiller': control.conseiller,
                'Montant': control.montant,
                'Domaine': control.domaine,
                'Statut': control.statut,
                'Éléments obligatoires manquants': control.obligatoryIssues,
                'Documents contrôlés': `${control.completedDocuments}/${control.totalDocuments}`,
                'Résultats': control.resultats
            }));
            
            if (window.fileHandler) {
                window.fileHandler.exportToExcel(exportData, fileName);
            }
        }
    }

    // MÉTHODE MISE À JOUR : Exporter le fichier historique avec formatage
    exportHistoryFile() {
        const formatter = new ExcelFormatter();
        const fileName = Utils.generateFileName('Historique_Controles');
        
        try {
            formatter.exportFormattedHistory(this.historyData, fileName);
            Utils.showNotification('Historique exporté avec mise en forme professionnelle !', 'success');
        } catch (error) {
            // Fallback vers l'ancienne méthode
            console.error('Erreur formatage Excel:', error);
            Utils.showNotification('Export historique réalisé en mode simple', 'warning');
            
            const exportData = this.historyData.map(control => ({
                'Date': control.date instanceof Date ? control.date.toLocaleDateString('fr-FR') : control.date,
                'Type': control.type,
                'Client': control.client,
                'Code_Dossier': control.codeDossier,
                'Conseiller': control.conseiller,
                'Statut': control.statut,
                'Elements_Obligatoires_Manquants': control.obligatoryIssues,
                'Total_Documents': control.totalDocuments,
                'Documents_Completes': control.completedDocuments,
                'Montant': control.montant,
                'Domaine': control.domaine,
                'Resultats': control.resultats
            }));
            
            if (window.fileHandler) {
                window.fileHandler.exportToExcel(exportData, fileName);
            }
        }
    }

    // Réinitialiser l'historique de session
    clearSessionHistory() {
        this.currentSessionControls = [];
        this.updateHistoryInterface();
    }

    // Obtenir les statistiques
    getStatistics() {
        const total = this.historyData.length;
        const completed = this.historyData.filter(h => h.statut === 'Terminé').length;
        const session = this.currentSessionControls.length;
        const avgIssues = total > 0 ? 
            this.historyData.reduce((sum, h) => sum + h.obligatoryIssues, 0) / total : 0;
        
        return {
            total,
            completed,
            session,
            avgIssues: Math.round(avgIssues * 100) / 100
        };
    }
}