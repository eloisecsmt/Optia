// persistenceManager.js - Version modifiée avec export Excel par type de contrôle

import { Utils } from './utils.js';

export class PersistenceManager {
    constructor() {
        this.controles = [];
        this.suspendedControls = [];
        this.controlledDossiers = new Map();
        this.lastSaveTime = 0;
        this.companyColors = {
            primary: 'FF1A1A2E',      // Bleu foncé
            secondary: 'FFD4AF37',    // Or
            success: 'FF28A745',      // Vert
            warning: 'FFFFC107',      // Jaune
            danger: 'FFDC3545',       // Rouge
            light: 'FFF8F9FA',        // Gris clair
            info: 'FF17A2B8'          // Bleu info
        };
        this.init();
    }

    init() {
        Utils.debugLog('PersistenceManager initialisé');
        this.loadFromStorage();
        this.loadSuspendedFromStorage();
        this.loadControlledDossiersFromStorage();
    }

    // MODIFIÉ : Sauvegarder un contrôle avec typeActe et dateEnvoi
    saveControl(controlData) {
        try {
            const now = Date.now();
            if (now - this.lastSaveTime < 1000) {
                Utils.debugLog('Doublon détecté - sauvegarde ignorée');
                return null;
            }
            this.lastSaveTime = now;
            
            if (!controlData || !controlData.dossier) {
                Utils.debugLog('Données de contrôle invalides');
                return null;
            }

            const controle = {
                id: Date.now(),
                date: new Date(),
                type: controlData.control?.definition?.name || 'Type inconnu',
                client: controlData.dossier.client || 'Client inconnu',
                codeDossier: controlData.dossier.codeDossier || '',
                conseiller: controlData.dossier.conseiller || '',
                montant: controlData.dossier.montant || '',
                domaine: controlData.dossier.domaine || '',
                nouveauClient: controlData.dossier.nouveauClient || '',
                // NOUVEAU : Ajouter typeActe et dateEnvoi
                typeActe: controlData.dossier.typeActe || '',
                dateEnvoi: controlData.dossier.dateEnvoi || '',
                statut: 'Terminé',
                anomaliesMajeures: controlData.obligatoryIssuesCount || 0,
                documentsControles: controlData.documents ? 
                    `${Object.values(controlData.documents).filter(d => d.status === 'completed').length}/${Object.keys(controlData.documents).length}` : 
                    '0/0',
                conformiteGlobale: (controlData.obligatoryIssuesCount || 0) === 0 ? 'CONFORME' : 'NON CONFORME',
                details: controlData.responses ? this.extractDetails(controlData) : [],
                rawControlData: {
                    dossier: controlData.dossier,
                    control: controlData.control,
                    documents: controlData.documents,
                    responses: controlData.responses,
                    obligatoryIssuesCount: controlData.obligatoryIssuesCount,
                    completedAt: controlData.completedAt
                }
            };

            this.controles.push(controle);
            this.saveToStorage();
            
            const dossierKey = this.generateDossierKey(controlData.dossier);
            this.markDossierAsControlled(dossierKey, controle.type);
            this.removeSuspendedControl(dossierKey, controle.type);
            
            Utils.debugLog(`Contrôle sauvegardé avec typeActe et dateEnvoi: ${controle.client}`);
            return controle;

        } catch (error) {
            Utils.debugLog('Erreur sauvegarde contrôle: ' + error.message);
            console.error('Erreur sauvegarde:', error);
            return null;
        }
    }

    // NOUVELLE MÉTHODE : Export Excel par type de contrôle
    saveToExcel(fileName = null) {
        if (!fileName) {
            fileName = `Historique_Controles_Par_Type_${new Date().toISOString().split('T')[0]}.xlsx`;
        }

        if (this.controles.length === 0) {
            Utils.showNotification('Aucun contrôle à exporter', 'warning');
            return false;
        }

        try {
            const wb = XLSX.utils.book_new();
            
            // 1. Onglet Vue d'ensemble (inchangé)
            this.createOverviewSheet(wb);
            
            // 2. Onglet Questions-Réponses globales (inchangé)
            this.createAllQuestionsSheet(wb);
            
            // 3. Onglet Statistiques (inchangé)
            this.createStatsSheet(wb);
            
            // 4. NOUVEAU : Onglets par type de contrôle
            this.createControlTypeSheets(wb);
            
            XLSX.writeFile(wb, fileName);
            
            Utils.showNotification(`Export par type généré: ${fileName}`, 'success');
            return true;

        } catch (error) {
            console.error('Erreur export Excel par type:', error);
            Utils.showNotification('Erreur lors de l\'export par type: ' + error.message, 'error');
            return false;
        }
    }

    // NOUVELLE MÉTHODE : Créer les onglets par type de contrôle
    createControlTypeSheets(wb) {
        // Grouper les contrôles par type
        const controlesByType = this.groupControlsByType();
        
        // Trier les types par ordre alphabétique
        const sortedTypes = Object.keys(controlesByType).sort();
        
        Utils.debugLog(`Création de ${sortedTypes.length} onglets par type: ${sortedTypes.join(', ')}`);
        
        sortedTypes.forEach(type => {
            const controles = controlesByType[type];
            this.createSingleTypeSheet(wb, type, controles);
        });
    }

    // NOUVELLE MÉTHODE : Grouper les contrôles par type
    groupControlsByType() {
        const groups = {};
        
        this.controles.forEach(controle => {
            const type = controle.type || 'Non défini';
            if (!groups[type]) {
                groups[type] = [];
            }
            groups[type].push(controle);
        });
        
        return groups;
    }

    // NOUVELLE MÉTHODE : Créer un onglet pour un type spécifique
    createSingleTypeSheet(wb, type, controles) {
        Utils.debugLog(`Création onglet pour type: ${type} (${controles.length} contrôles)`);
        
        // Analyser les documents utilisés dans ce type de contrôle
        const documentsInfo = this.analyzeDocumentsForType(controles);
        
        // Créer les en-têtes de colonnes
        const headers = this.createTypeSheetHeaders(documentsInfo);
        
        // Créer les données
        const data = [headers];
        
        controles.forEach(controle => {
            const row = this.createTypeSheetRow(controle, documentsInfo);
            data.push(row);
        });
        
        // Créer la feuille Excel
        const ws = XLSX.utils.aoa_to_sheet(data);
        
        // Appliquer le formatage
        this.formatTypeSheet(ws, data.length, headers.length, documentsInfo);
        
        // Nom d'onglet sécurisé (max 31 caractères, pas de caractères spéciaux)
        const safeName = this.createSafeSheetName(type);
        
        XLSX.utils.book_append_sheet(wb, ws, safeName);
        
        Utils.debugLog(`Onglet créé: ${safeName}`);
    }

    // NOUVELLE MÉTHODE : Analyser les documents pour un type de contrôle
    analyzeDocumentsForType(controles) {
        const documentsMap = new Map();
        
        controles.forEach(controle => {
            if (controle.details && controle.details.length > 0) {
                // Grouper les détails par document
                const detailsByDoc = {};
                controle.details.forEach(detail => {
                    if (!detailsByDoc[detail.document]) {
                        detailsByDoc[detail.document] = [];
                    }
                    detailsByDoc[detail.document].push(detail);
                });
                
                // Analyser chaque document
                Object.entries(detailsByDoc).forEach(([docName, details]) => {
                    if (!documentsMap.has(docName)) {
                        documentsMap.set(docName, {
                            name: docName,
                            questions: new Set(),
                            maxQuestions: 0
                        });
                    }
                    
                    const docInfo = documentsMap.get(docName);
                    details.forEach(detail => {
                        docInfo.questions.add(detail.question);
                    });
                    docInfo.maxQuestions = Math.max(docInfo.maxQuestions, details.length);
                });
            }
        });
        
        // Convertir en tableau et trier
        const result = Array.from(documentsMap.entries()).map(([name, info]) => ({
            name,
            questionsArray: Array.from(info.questions),
            maxQuestions: info.maxQuestions
        })).sort((a, b) => a.name.localeCompare(b.name));
        
        Utils.debugLog(`Documents analysés pour ce type: ${result.map(d => `${d.name}(${d.maxQuestions}q)`).join(', ')}`);
        
        return result;
    }

    // NOUVELLE MÉTHODE : Créer les en-têtes pour un onglet de type
    createTypeSheetHeaders(documentsInfo) {
        const headers = [
            // Colonnes générales
            'Date',
            'Client', 
            'Code Dossier',
            'Conseiller',
            'Montant',
            'Domaine',
            'Nouveau Client',
            'Type d\'acte',
            'Date d\'envoi'
        ];
        
        // Ajouter les colonnes pour chaque document
        documentsInfo.forEach(docInfo => {
            // Colonne statut du document
            headers.push(`${docInfo.name} - Statut`);
            
            // Colonnes pour les questions du document
            docInfo.questionsArray.forEach((question, index) => {
                const shortQuestion = this.shortenQuestionText(question);
                headers.push(`${docInfo.name} - Q${index + 1}: ${shortQuestion}`);
            });
        });
        
        return headers;
    }

    // NOUVELLE MÉTHODE : Raccourcir le texte des questions
    shortenQuestionText(question) {
        if (!question) return 'Question';
        
        // Supprimer les mots communs et raccourcir
        let short = question
            .replace(/Est-ce que le document/gi, 'Document')
            .replace(/est-il présent/gi, 'présent?')
            .replace(/a été réalisé\(e\)/gi, 'réalisé?')
            .replace(/a été créé/gi, 'créé?')
            .replace(/Tous les documents sont-ils bien ajoutés dans Zeendoc/gi, 'Zeendoc?')
            .replace(/Le document/gi, 'Doc')
            .replace(/La pièce/gi, 'Pièce')
            .trim();
        
        // Limiter à 50 caractères
        if (short.length > 50) {
            short = short.substring(0, 47) + '...';
        }
        
        return short;
    }

    // NOUVELLE MÉTHODE : Créer une ligne de données pour un contrôle
    createTypeSheetRow(controle, documentsInfo) {
        const row = [
            // Colonnes générales
            controle.date.toLocaleDateString('fr-FR'),
            controle.client,
            controle.codeDossier || '',
            controle.conseiller || '',
            controle.montant || '',
            controle.domaine || '',
            controle.nouveauClient || '',
            controle.typeActe || '',
            controle.dateEnvoi || ''
        ];
        
        // Grouper les détails par document pour ce contrôle
        const detailsByDoc = {};
        if (controle.details && controle.details.length > 0) {
            controle.details.forEach(detail => {
                if (!detailsByDoc[detail.document]) {
                    detailsByDoc[detail.document] = [];
                }
                detailsByDoc[detail.document].push(detail);
            });
        }
        
        // Ajouter les données pour chaque document
        documentsInfo.forEach(docInfo => {
            const docDetails = detailsByDoc[docInfo.name] || [];
            
            // Déterminer le statut du document
            const docStatus = this.getDocumentStatus(docDetails);
            row.push(docStatus);
            
            // Ajouter les réponses aux questions
            docInfo.questionsArray.forEach(question => {
                const detail = docDetails.find(d => d.question === question);
                if (detail) {
                    // Si document absent, mettre "-"
                    if (docStatus === 'ABSENT') {
                        row.push('-');
                    } else {
                        // Mettre la justification si présente, sinon la réponse
                        const cellValue = detail.justification && detail.justification.trim() !== '' 
                            ? detail.justification 
                            : detail.reponse;
                        row.push(cellValue || '-');
                    }
                } else {
                    row.push('-');
                }
            });
        });
        
        return row;
    }

    // NOUVELLE MÉTHODE : Déterminer le statut d'un document
    getDocumentStatus(docDetails) {
        if (!docDetails || docDetails.length === 0) {
            return 'NON CONTRÔLÉ';
        }
        
        // Vérifier si le document est absent (première question avec réponse "Non")
        const firstDetail = docDetails[0];
        if (firstDetail && this.isDocumentPresenceQuestion(firstDetail.question) && firstDetail.reponse === 'Non') {
            return 'ABSENT';
        }
        
        // Vérifier les anomalies
        const anomalies = docDetails.filter(d => !d.conforme);
        const anomaliesObligatoires = anomalies.filter(d => d.obligatoire);
        
        if (anomaliesObligatoires.length > 0) {
            return 'NON CONFORME';
        } else if (anomalies.length > 0) {
            return 'AVEC RÉSERVES';
        } else {
            return 'CONFORME';
        }
    }

    // NOUVELLE MÉTHODE : Détecter si c'est une question de présence de document
    isDocumentPresenceQuestion(question) {
        if (!question) return false;
        
        const lowerQuestion = question.toLowerCase();
        return lowerQuestion.includes('est-ce que le document est présent') ||
               lowerQuestion.includes('a été réalisé') ||
               lowerQuestion.includes('a été créé') ||
               lowerQuestion.includes('tous les documents sont-ils bien ajoutés dans zeendoc');
    }

    // NOUVELLE MÉTHODE : Formater un onglet de type
    formatTypeSheet(ws, rowCount, colCount, documentsInfo) {
        if (!ws['!ref']) return;
        
        const range = XLSX.utils.decode_range(ws['!ref']);
        
        // Calcul des largeurs de colonnes
        const colWidths = this.calculateColumnWidths(documentsInfo);
        ws['!cols'] = colWidths;
        
        // Application du formatage cellule par cellule
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

    // NOUVELLE MÉTHODE : Calculer les largeurs de colonnes
    calculateColumnWidths(documentsInfo) {
        const widths = [
            { width: 12 },  // Date
            { width: 25 },  // Client
            { width: 15 },  // Code Dossier
            { width: 20 },  // Conseiller
            { width: 15 },  // Montant
            { width: 15 },  // Domaine
            { width: 15 },  // Nouveau Client
            { width: 15 },  // Type d'acte
            { width: 12 }   // Date d'envoi
        ];
        
        // Largeurs pour les colonnes de documents
        documentsInfo.forEach(docInfo => {
            // Colonne statut
            widths.push({ width: 15 });
            
            // Colonnes questions
            docInfo.questionsArray.forEach(() => {
                widths.push({ width: 25 }); // Largeur pour questions avec justifications
            });
        });
        
        return widths;
    }

    // NOUVELLE MÉTHODE : Vérifier si c'est une colonne de statut de document
    isDocumentStatusColumn(colIndex, documentsInfo) {
        let currentCol = 9; // Première colonne après les colonnes générales
        
        for (const docInfo of documentsInfo) {
            if (colIndex === currentCol) {
                return true; // C'est une colonne statut
            }
            currentCol += 1 + docInfo.questionsArray.length; // +1 pour le statut, +N pour les questions
        }
        
        return false;
    }

    // NOUVELLE MÉTHODE : Vérifier si c'est une colonne de question de document
    isDocumentQuestionColumn(colIndex, rowIndex, ws, documentsInfo) {
        let currentCol = 9; // Première colonne après les colonnes générales
        
        for (const docInfo of documentsInfo) {
            const statusCol = currentCol;
            const questionsStart = currentCol + 1;
            const questionsEnd = questionsStart + docInfo.questionsArray.length - 1;
            
            if (colIndex >= questionsStart && colIndex <= questionsEnd) {
                return true; // C'est une colonne de question
            }
            
            currentCol += 1 + docInfo.questionsArray.length;
        }
        
        return false;
    }

    // NOUVELLE MÉTHODE : Obtenir l'index de la colonne statut pour une colonne de question
    getDocumentStatusColumnIndex(questionColIndex, documentsInfo) {
        let currentCol = 9; // Première colonne après les colonnes générales
        
        for (const docInfo of documentsInfo) {
            const statusCol = currentCol;
            const questionsStart = currentCol + 1;
            const questionsEnd = questionsStart + docInfo.questionsArray.length - 1;
            
            if (questionColIndex >= questionsStart && questionColIndex <= questionsEnd) {
                return statusCol; // Retourner l'index de la colonne statut correspondante
            }
            
            currentCol += 1 + docInfo.questionsArray.length;
        }
        
        return -1;
    }

    // NOUVELLE MÉTHODE : Créer un nom d'onglet sécurisé
    createSafeSheetName(typeName) {
        // Supprimer les caractères interdits et limiter à 31 caractères
        let safeName = typeName
            .replace(/[:\\/?*\[\]]/g, '_')
            .substring(0, 31);
            
        // S'assurer qu'il n'est pas vide
        if (!safeName.trim()) {
            safeName = 'Controle';
        }
        
        return safeName;
    }

    // ====== MÉTHODES EXISTANTES (inchangées) ======

    exportDetailedControl(controleId, fileName = null) {
        const controle = this.controles.find(c => c.id == controleId);
        if (!controle) {
            Utils.showNotification('Contrôle non trouvé', 'error');
            return false;
        }

        if (!fileName) {
            fileName = `Controle_Detaille_${controle.client.replace(/[^a-zA-Z0-9]/g, '_')}_${controle.date.toISOString().split('T')[0]}.xlsx`;
        }

        try {
            const wb = XLSX.utils.book_new();
            
            this.createSummarySheet(wb, controle);
            this.createQuestionsSheet(wb, controle);
            this.createAnomaliesSheet(wb, controle);
            this.createDocumentsSheet(wb, controle);
            
            XLSX.writeFile(wb, fileName);
            Utils.showNotification(`Export détaillé généré: ${fileName}`, 'success');
            return true;
            
        } catch (error) {
            console.error('Erreur export détaillé:', error);
            Utils.showNotification('Erreur lors de l\'export détaillé: ' + error.message, 'error');
            return false;
        }
    }

    createSummarySheet(wb, controle) {
        const summaryData = [
            ['CONTRÔLE DOCUMENTAIRE - RÉSUMÉ EXÉCUTIF', '', '', ''],
            ['', '', '', ''],
            ['INFORMATIONS GÉNÉRALES', '', '', ''],
            ['Date du contrôle', controle.date.toLocaleDateString('fr-FR'), '', ''],
            ['Type de contrôle', controle.type, '', ''],
            ['Client', controle.client, '', ''],
            ['Code dossier', controle.codeDossier, '', ''],
            ['Conseiller', controle.conseiller, '', ''],
            ['Montant', controle.montant, '', ''],
            ['Domaine', controle.domaine, '', ''],
            ['Nouveau client', controle.nouveauClient, '', ''],
            ['', '', '', ''],
            ['RÉSULTATS DU CONTRÔLE', '', '', ''],
            ['Documents contrôlés', controle.documentsControles, '', ''],
            ['Anomalies majeures', controle.anomaliesMajeures, '', ''],
            ['Conformité globale', controle.conformiteGlobale, '', ''],
            ['', '', '', ''],
            ['STATISTIQUES DÉTAILLÉES', '', '', '']
        ];

        if (controle.details && controle.details.length > 0) {
            const docStats = this.calculateDocumentStats(controle.details);
            Object.entries(docStats).forEach(([docName, stats]) => {
                summaryData.push([
                    `${docName}`,
                    `${stats.conformeCount}/${stats.totalCount} conformes`,
                    `${stats.anomaliesCount} anomalies`,
                    stats.status
                ]);
            });
        }

        const ws = XLSX.utils.aoa_to_sheet(summaryData);
        this.formatSummarySheet(ws, controle);
        XLSX.utils.book_append_sheet(wb, ws, "Résumé");
    }

    createQuestionsSheet(wb, controle) {
        const questionsData = [
            ['DÉTAIL DES QUESTIONS ET RÉPONSES', '', '', '', '', ''],
            ['', '', '', '', '', ''],
            ['Document', 'Question', 'Réponse', 'Qualité', 'Conformité', 'Justification']
        ];

        if (controle.details && controle.details.length > 0) {
            controle.details.forEach(detail => {
                questionsData.push([
                    detail.document,
                    detail.question,
                    detail.reponse,
                    detail.qualite || '-',
                    detail.conforme ? 'CONFORME' : 'NON CONFORME',
                    detail.justification || '-'
                ]);
            });
        } else {
            questionsData.push(['Aucun détail disponible', '', '', '', '', '']);
        }

        const ws = XLSX.utils.aoa_to_sheet(questionsData);
        this.formatQuestionsSheet(ws, questionsData.length);
        XLSX.utils.book_append_sheet(wb, ws, "Questions-Réponses");
    }

    createAnomaliesSheet(wb, controle) {
        const anomaliesData = [
            ['ANOMALIES DÉTECTÉES', '', '', '', ''],
            ['', '', '', '', ''],
            ['Document', 'Question', 'Type d\'anomalie', 'Obligatoire', 'Justification']
        ];

        if (controle.details && controle.details.length > 0) {
            const anomalies = controle.details.filter(d => !d.conforme);
            
            if (anomalies.length > 0) {
                anomalies.forEach(anomalie => {
                    anomaliesData.push([
                        anomalie.document,
                        anomalie.question,
                        anomalie.reponse === 'Non' ? 'Document manquant' : 'Qualité insuffisante',
                        anomalie.obligatoire ? 'OUI' : 'NON',
                        anomalie.justification || '-'
                    ]);
                });
            } else {
                anomaliesData.push(['AUCUNE ANOMALIE DÉTECTÉE', '', '', '', '']);
                anomaliesData.push(['Contrôle parfaitement conforme', '', '', '', '']);
            }
        } else {
            anomaliesData.push(['Pas de données d\'anomalies disponibles', '', '', '', '']);
        }

        const ws = XLSX.utils.aoa_to_sheet(anomaliesData);
        this.formatAnomaliesSheet(ws, anomaliesData.length);
        XLSX.utils.book_append_sheet(wb, ws, "Anomalies");
    }

    createDocumentsSheet(wb, controle) {
        const documentsData = [
            ['STATUT PAR DOCUMENT', '', '', '', ''],
            ['', '', '', '', ''],
            ['Document', 'Questions totales', 'Questions conformes', 'Anomalies', 'Statut global']
        ];

        if (controle.details && controle.details.length > 0) {
            const docStats = this.calculateDocumentStats(controle.details);
            
            Object.entries(docStats).forEach(([docName, stats]) => {
                documentsData.push([
                    docName,
                    stats.totalCount,
                    stats.conformeCount,
                    stats.anomaliesCount,
                    stats.status
                ]);
            });
        } else {
            documentsData.push(['Aucune donnée de document disponible', '', '', '', '']);
        }

        const ws = XLSX.utils.aoa_to_sheet(documentsData);
        this.formatDocumentsSheet(ws, documentsData.length);
        XLSX.utils.book_append_sheet(wb, ws, "Documents");
    }

    calculateDocumentStats(details) {
        const stats = {};
        
        details.forEach(detail => {
            if (!stats[detail.document]) {
                stats[detail.document] = {
                    totalCount: 0,
                    conformeCount: 0,
                    anomaliesCount: 0,
                    status: 'CONFORME'
                };
            }
            
            stats[detail.document].totalCount++;
            if (detail.conforme) {
                stats[detail.document].conformeCount++;
            } else {
                stats[detail.document].anomaliesCount++;
                if (detail.obligatoire) {
                    stats[detail.document].status = 'NON CONFORME';
                } else if (stats[detail.document].status === 'CONFORME') {
                    stats[detail.document].status = 'AVEC RÉSERVES';
                }
            }
        });
        
        return stats;
    }

    formatSummarySheet(ws, controle) {
        if (!ws['!ref']) return;
        
        const range = XLSX.utils.decode_range(ws['!ref']);
        
        ws['!cols'] = [
            { width: 30 },  // Libellé
            { width: 25 },  // Valeur
            { width: 15 },  // Extra
            { width: 15 }   // Extra
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
                        font: { name: 'Calibri', sz: 16, bold: true, color: { rgb: 'FFFFFF' } },
                        fill: { fgColor: { rgb: this.companyColors.primary.substr(2) } },
                        alignment: { horizontal: 'center', vertical: 'center' }
                    };
                }
                else if (ws[cell_address].v && typeof ws[cell_address].v === 'string' && 
                        (ws[cell_address].v.includes('INFORMATIONS') || 
                         ws[cell_address].v.includes('RÉSULTATS') || 
                         ws[cell_address].v.includes('STATISTIQUES'))) {
                    ws[cell_address].s = {
                        ...ws[cell_address].s,
                        font: { name: 'Calibri', sz: 12, bold: true, color: { rgb: 'FFFFFF' } },
                        fill: { fgColor: { rgb: this.companyColors.secondary.substr(2) } }
                    };
                }
                else if (ws[cell_address].v === 'CONFORME') {
                    ws[cell_address].s.fill = { fgColor: { rgb: this.companyColors.success.substr(2) } };
                    ws[cell_address].s.font = { ...ws[cell_address].s.font, bold: true, color: { rgb: 'FFFFFF' } };
                }
                else if (ws[cell_address].v === 'NON CONFORME') {
                    ws[cell_address].s.fill = { fgColor: { rgb: this.companyColors.danger.substr(2) } };
                    ws[cell_address].s.font = { ...ws[cell_address].s.font, bold: true, color: { rgb: 'FFFFFF' } };
                }
            }
        }

        ws['!merges'] = [{ s: { c: 0, r: 0 }, e: { c: 3, r: 0 } }];
    }

    formatQuestionsSheet(ws, rowCount) {
        if (!ws['!ref']) return;
        
        ws['!cols'] = [
            { width: 15 },  // Document
            { width: 50 },  // Question
            { width: 10 },  // Réponse
            { width: 15 },  // Qualité
            { width: 15 },  // Conformité
            { width: 30 }   // Justification
        ];

        const range = XLSX.utils.decode_range(ws['!ref']);
        
        for (let R = range.s.r; R <= range.e.r; ++R) {
            for (let C = range.s.c; C <= range.e.c; ++C) {
                const cell_address = XLSX.utils.encode_cell({ c: C, r: R });
                if (!ws[cell_address]) continue;

                ws[cell_address].s = {
                    alignment: { vertical: 'top', wrapText: true },
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
                        font: { name: 'Calibri', sz: 16, bold: true, color: { rgb: 'FFFFFF' } },
                        fill: { fgColor: { rgb: this.companyColors.primary.substr(2) } },
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
                else if (C === 4) {
                    if (ws[cell_address].v === 'CONFORME') {
                        ws[cell_address].s.fill = { fgColor: { rgb: this.companyColors.success.substr(2) } };
                        ws[cell_address].s.font = { ...ws[cell_address].s.font, bold: true, color: { rgb: 'FFFFFF' } };
                    } else if (ws[cell_address].v === 'NON CONFORME') {
                        ws[cell_address].s.fill = { fgColor: { rgb: this.companyColors.danger.substr(2) } };
                        ws[cell_address].s.font = { ...ws[cell_address].s.font, bold: true, color: { rgb: 'FFFFFF' } };
                    }
                }
                else if (C === 2) {
                    if (ws[cell_address].v === 'Oui') {
                        ws[cell_address].s.font = { ...ws[cell_address].s.font, color: { rgb: this.companyColors.success.substr(2) }, bold: true };
                    } else if (ws[cell_address].v === 'Non') {
                        ws[cell_address].s.font = { ...ws[cell_address].s.font, color: { rgb: this.companyColors.danger.substr(2) }, bold: true };
                    }
                }
            }
        }

        ws['!merges'] = [{ s: { c: 0, r: 0 }, e: { c: 5, r: 0 } }];
    }

    formatAnomaliesSheet(ws, rowCount) {
        if (!ws['!ref']) return;
        
        ws['!cols'] = [
            { width: 15 },  // Document
            { width: 50 },  // Question
            { width: 20 },  // Type anomalie
            { width: 12 },  // Obligatoire
            { width: 30 }   // Justification
        ];

        const range = XLSX.utils.decode_range(ws['!ref']);
        
        for (let R = range.s.r; R <= range.e.r; ++R) {
            for (let C = range.s.c; C <= range.e.c; ++C) {
                const cell_address = XLSX.utils.encode_cell({ c: C, r: R });
                if (!ws[cell_address]) continue;

                ws[cell_address].s = {
                    alignment: { vertical: 'top', wrapText: true },
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
                        font: { name: 'Calibri', sz: 16, bold: true, color: { rgb: 'FFFFFF' } },
                        fill: { fgColor: { rgb: this.companyColors.danger.substr(2) } },
                        alignment: { horizontal: 'center', vertical: 'center' }
                    };
                }
                else if (R === 2) {
                    ws[cell_address].s = {
                        ...ws[cell_address].s,
                        font: { name: 'Calibri', sz: 11, bold: true, color: { rgb: 'FFFFFF' } },
                        fill: { fgColor: { rgb: this.companyColors.warning.substr(2) } },
                        alignment: { horizontal: 'center', vertical: 'center' }
                    };
                }
                else if (C === 3) {
                    if (ws[cell_address].v === 'OUI') {
                        ws[cell_address].s.fill = { fgColor: { rgb: this.companyColors.danger.substr(2) } };
                        ws[cell_address].s.font = { ...ws[cell_address].s.font, bold: true, color: { rgb: 'FFFFFF' } };
                    }
                }
            }
        }

        ws['!merges'] = [{ s: { c: 0, r: 0 }, e: { c: 4, r: 0 } }];
    }

    formatDocumentsSheet(ws, rowCount) {
        if (!ws['!ref']) return;
        
        ws['!cols'] = [
            { width: 20 },  // Document
            { width: 15 },  // Questions totales
            { width: 18 },  // Questions conformes
            { width: 12 },  // Anomalies
            { width: 15 }   // Statut
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
                        font: { name: 'Calibri', sz: 16, bold: true, color: { rgb: 'FFFFFF' } },
                        fill: { fgColor: { rgb: this.companyColors.info.substr(2) } },
                        alignment: { horizontal: 'center', vertical: 'center' }
                    };
                } else if (R === 2) {
                    ws[cell_address].s = {
                        ...ws[cell_address].s,
                        font: { name: 'Calibri', sz: 11, bold: true, color: { rgb: 'FFFFFF' } },
                        fill: { fgColor: { rgb: this.companyColors.secondary.substr(2) } },
                        alignment: { horizontal: 'center', vertical: 'center' }
                    };
                } else if (C === 4) {
                    if (ws[cell_address].v === 'CONFORME') {
                        ws[cell_address].s.fill = { fgColor: { rgb: this.companyColors.success.substr(2) } };
                        ws[cell_address].s.font = { ...ws[cell_address].s.font, bold: true, color: { rgb: 'FFFFFF' } };
                    } else if (ws[cell_address].v === 'NON CONFORME') {
                        ws[cell_address].s.fill = { fgColor: { rgb: this.companyColors.danger.substr(2) } };
                        ws[cell_address].s.font = { ...ws[cell_address].s.font, bold: true, color: { rgb: 'FFFFFF' } };
                    } else if (ws[cell_address].v === 'AVEC RÉSERVES') {
                        ws[cell_address].s.fill = { fgColor: { rgb: this.companyColors.warning.substr(2) } };
                        ws[cell_address].s.font = { ...ws[cell_address].s.font, bold: true };
                    }
                }
            }
        }

        ws['!merges'] = [{ s: { c: 0, r: 0 }, e: { c: 4, r: 0 } }];
    }

    extractDetails(controlData) {
        const details = [];
        
        Object.entries(controlData.documents || {}).forEach(([docId, docState]) => {
            const responses = controlData.responses[docId] || {};
            const docName = this.getDocumentName(docId);
            
            Object.values(responses).forEach(response => {
                details.push({
                    document: docName,
                    question: response.question,
                    reponse: response.answer,
                    qualite: response.quality || '',
                    conforme: response.answer === 'Oui' && response.quality !== 'Non conforme',
                    obligatoire: response.obligation === 'Obligatoire',
                    justification: response.justification || ''
                });
            });
        });
        
        return details;
    }

    getDocumentName(docId) {
        const documentNames = {
            1: 'FR',
            2: 'Profil Risques', 
            3: 'Profil ESG',
            4: 'Harvest',
            5: 'FIL',
            6: 'LM Entrée en Relation',
            7: 'CNI',
            8: 'Justificatif Domicile',
            9: 'Etude',
            10: 'RIB',
            11: 'Convention RTO',
            12: 'Origine des fonds',
            13: 'Carto Opération',
            14: 'Destination des fonds',
            99: 'Zeendoc'
        };
        return documentNames[docId] || `Document ${docId}`;
    }

    // ====== MÉTHODES POUR ONGLETS CONSERVÉS ======

    createOverviewSheet(wb) {
        const overviewData = [
            ['HISTORIQUE COMPLET DES CONTRÔLES DOCUMENTAIRES', '', '', '', '', '', '', '', '', '', ''],
            ['', '', '', '', '', '', '', '', '', '', ''],
            ['Date', 'Type', 'Client', 'Code Dossier', 'Conseiller', 'Montant', 'Domaine', 'Type d\'acte', 'Date d\'envoi', 'Documents', 'Conformité']
        ];

        this.controles.forEach(controle => {
            overviewData.push([
                controle.date.toLocaleDateString('fr-FR'),
                controle.type,
                controle.client,
                controle.codeDossier || 'N/A',
                controle.conseiller || 'N/A',
                controle.montant || 'N/A',
                controle.domaine || 'N/A',
                controle.typeActe || 'N/A',
                controle.dateEnvoi || 'N/A',
                controle.documentsControles,
                controle.conformiteGlobale
            ]);
        });

        const ws = XLSX.utils.aoa_to_sheet(overviewData);
        this.formatOverviewSheet(ws, overviewData.length);
        XLSX.utils.book_append_sheet(wb, ws, "Vue d'ensemble");
    }

    createAllQuestionsSheet(wb) {
        const questionsData = [
            ['DÉTAIL DE TOUTES LES QUESTIONS ET RÉPONSES', '', '', '', '', '', '', ''],
            ['', '', '', '', '', '', '', ''],
            ['Date', 'Client', 'Type Contrôle', 'Document', 'Question', 'Réponse', 'Qualité', 'Justification']
        ];

        this.controles.forEach(controle => {
            if (controle.details && controle.details.length > 0) {
                controle.details.forEach(detail => {
                    questionsData.push([
                        controle.date.toLocaleDateString('fr-FR'),
                        controle.client,
                        controle.type,
                        detail.document,
                        detail.question,
                        detail.reponse,
                        detail.qualite || '-',
                        detail.justification || '-'
                    ]);
                });
            } else {
                questionsData.push([
                    controle.date.toLocaleDateString('fr-FR'),
                    controle.client,
                    controle.type,
                    'Détails non disponibles',
                    '-',
                    '-',
                    '-',
                    '-'
                ]);
            }
        });

        const ws = XLSX.utils.aoa_to_sheet(questionsData);
        this.formatQuestionsGlobalSheet(ws, questionsData.length);
        XLSX.utils.book_append_sheet(wb, ws, "Questions-Réponses");
    }

    createStatsSheet(wb) {
        const stats = this.getStatistics();
        const repartitionTypes = stats.repartitionTypes;
        
        const statsData = [
            ['STATISTIQUES DÉTAILLÉES', '', '', '', ''],
            ['', '', '', '', ''],
            ['RÉSUMÉ GLOBAL', '', '', '', ''],
            ['Total contrôles', stats.totalControles, '', '', ''],
            ['Taux de conformité', `${stats.tauxConformite}%`, '', '', ''],
            ['Anomalies majeures totales', stats.totalAnomaliesMajeures, '', '', ''],
            ['Contrôles ce mois-ci', stats.controlesMoisActuel, '', '', ''],
            ['Type le plus fréquent', stats.typePlusFrequent, '', '', ''],
            ['', '', '', '', ''],
            ['RÉPARTITION PAR TYPE DE CONTRÔLE', '', '', '', ''],
            ['Type de contrôle', 'Nombre', 'Pourcentage', 'Conformes', 'Non conformes']
        ];

        Object.entries(repartitionTypes).forEach(([type, count]) => {
            const controlesType = this.controles.filter(c => c.type === type);
            const conformes = controlesType.filter(c => c.conformiteGlobale === 'CONFORME').length;
            const nonConformes = count - conformes;
            const pourcentage = stats.totalControles > 0 ? Math.round((count / stats.totalControles) * 100) : 0;
            
            statsData.push([
                type,
                count,
                `${pourcentage}%`,
                conformes,
                nonConformes
            ]);
        });

        const ws = XLSX.utils.aoa_to_sheet(statsData);
        this.formatStatsSheet(ws, statsData.length);
        XLSX.utils.book_append_sheet(wb, ws, "Statistiques");
    }

    formatOverviewSheet(ws, rowCount) {
        if (!ws['!ref']) return;
        
        ws['!cols'] = [
            { width: 12 },  // Date
            { width: 16 },  // Type
            { width: 25 },  // Client
            { width: 15 },  // Code
            { width: 20 },  // Conseiller
            { width: 15 },  // Montant
            { width: 12 },  // Domaine
            { width: 15 },  // Type d'acte
            { width: 12 },  // Date d'envoi
            { width: 12 },  // Documents
            { width: 15 }   // Conformité
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
                        fill: { fgColor: { rgb: this.companyColors.primary.substr(2) } },
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
                    const isEvenRow = (R - 3) % 2 === 0;
                    ws[cell_address].s.fill = { 
                        fgColor: { rgb: isEvenRow ? 'FFFFFF' : this.companyColors.light.substr(2) } 
                    };
                    
                    if (C === range.e.c) {
                        if (ws[cell_address].v === 'CONFORME') {
                            ws[cell_address].s.fill = { fgColor: { rgb: this.companyColors.success.substr(2) } };
                            ws[cell_address].s.font = { ...ws[cell_address].s.font, bold: true, color: { rgb: 'FFFFFF' } };
                        } else if (ws[cell_address].v === 'NON CONFORME') {
                            ws[cell_address].s.fill = { fgColor: { rgb: this.companyColors.danger.substr(2) } };
                            ws[cell_address].s.font = { ...ws[cell_address].s.font, bold: true, color: { rgb: 'FFFFFF' } };
                        }
                    }
                }
            }
        }

        ws['!merges'] = [{ s: { c: 0, r: 0 }, e: { c: 10, r: 0 } }];
        ws['!autofilter'] = { ref: `A3:${XLSX.utils.encode_col(range.e.c)}3` };
    }

    formatQuestionsGlobalSheet(ws, rowCount) {
        if (!ws['!ref']) return;
        
        ws['!cols'] = [
            { width: 12 },  // Date
            { width: 25 },  // Client
            { width: 16 },  // Type
            { width: 15 },  // Document
            { width: 50 },  // Question
            { width: 10 },  // Réponse
            { width: 15 },  // Qualité
            { width: 30 }   // Justification
        ];

        const range = XLSX.utils.decode_range(ws['!ref']);
        
        for (let R = range.s.r; R <= range.e.r; ++R) {
            for (let C = range.s.c; C <= range.e.c; ++C) {
                const cell_address = XLSX.utils.encode_cell({ c: C, r: R });
                if (!ws[cell_address]) continue;

                ws[cell_address].s = {
                    alignment: { vertical: 'top', wrapText: true },
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
                        fill: { fgColor: { rgb: this.companyColors.primary.substr(2) } },
                        alignment: { horizontal: 'center', vertical: 'center' }
                    };
                } else if (R === 2) {
                    ws[cell_address].s = {
                        ...ws[cell_address].s,
                        font: { name: 'Calibri', sz: 11, bold: true, color: { rgb: 'FFFFFF' } },
                        fill: { fgColor: { rgb: this.companyColors.secondary.substr(2) } },
                        alignment: { horizontal: 'center', vertical: 'center' }
                    };
                } else if (R > 2) {
                    if (C === 5) {
                        if (ws[cell_address].v === 'Oui') {
                            ws[cell_address].s.font = { ...ws[cell_address].s.font, color: { rgb: this.companyColors.success.substr(2) }, bold: true };
                        } else if (ws[cell_address].v === 'Non') {
                            ws[cell_address].s.font = { ...ws[cell_address].s.font, color: { rgb: this.companyColors.danger.substr(2) }, bold: true };
                        }
                    }
                }
            }
        }

        ws['!merges'] = [{ s: { c: 0, r: 0 }, e: { c: 7, r: 0 } }];
        ws['!autofilter'] = { ref: `A3:H3` };
    }

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

