// persistenceManager.js - Version enrichie avec export Excel détaillé

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
        this.loadSuspendedFromStorage(); // Charger les suspendus
        this.loadControlledDossiersFromStorage(); // Charger les dossiers contrôlés
    }

    // Sauvegarder un contrôle (inchangé)
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
                typeActe: controlData.dossier.typeActe || '',
                dateEnvoi: controlData.dossier.dateEnvoi || '',
                nouveauClient: controlData.dossier.nouveauClient || '',
                statut: 'Terminé',
                anomaliesMajeures: controlData.obligatoryIssuesCount || 0,
                documentsControles: controlData.documents ? 
                    `${Object.values(controlData.documents).filter(d => d.status === 'completed').length}/${Object.keys(controlData.documents).length}` : 
                    '0/0',
                conformiteGlobale: (controlData.obligatoryIssuesCount || 0) === 0 ? 'CONFORME' : 'NON CONFORME',
                details: controlData.responses ? this.extractDetails(controlData) : [],
                // NOUVEAU : Sauvegarder les données brutes pour export détaillé
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
            
            // NOUVEAU : Marquer le dossier comme contrôlé
            const dossierKey = this.generateDossierKey(controlData.dossier);
            this.markDossierAsControlled(dossierKey, controle.type);
            
            // NOUVEAU : Supprimer le contrôle suspendu s'il existait
            this.removeSuspendedControl(dossierKey, controle.type);
            
            Utils.debugLog(`Contrôle sauvegardé et dossier marqué: ${controle.client}`);
            return controle;

        } catch (error) {
            Utils.debugLog('Erreur sauvegarde contrôle: ' + error.message);
            console.error('Erreur sauvegarde:', error);
            return null;
        }
    }


    // NOUVELLE MÉTHODE : Export Excel détaillé d'un contrôle spécifique
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
            
            // 1. Onglet Résumé
            this.createSummarySheet(wb, controle);
            
            // 2. Onglet Questions/Réponses détaillées
            this.createQuestionsSheet(wb, controle);
            
            // 3. Onglet Anomalies
            this.createAnomaliesSheet(wb, controle);
            
            // 4. Onglet Documents
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

    // ONGLET 1: RÉSUMÉ EXÉCUTIF
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

        // Ajouter les statistiques par document si disponible
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
        
        // Formatage du résumé
        this.formatSummarySheet(ws, controle);
        
        XLSX.utils.book_append_sheet(wb, ws, "Résumé");
    }

    // ONGLET 2: QUESTIONS ET RÉPONSES DÉTAILLÉES
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
        
        // Formatage des questions
        this.formatQuestionsSheet(ws, questionsData.length);
        
        XLSX.utils.book_append_sheet(wb, ws, "Questions-Réponses");
    }

    // ONGLET 3: ANOMALIES DÉTECTÉES
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
        
        // Formatage des anomalies
        this.formatAnomaliesSheet(ws, anomaliesData.length);
        
        XLSX.utils.book_append_sheet(wb, ws, "Anomalies");
    }

    // ONGLET 4: STATUT PAR DOCUMENT
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
        
        // Formatage des documents
        this.formatDocumentsSheet(ws, documentsData.length);
        
        XLSX.utils.book_append_sheet(wb, ws, "Documents");
    }

    // Calculer les statistiques par document
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

    // FORMATAGE DES FEUILLES

    formatSummarySheet(ws, controle) {
        if (!ws['!ref']) return;
        
        const range = XLSX.utils.decode_range(ws['!ref']);
        
        // Largeurs de colonnes
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

                // Style de base
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

                // Titre principal
                if (R === 0) {
                    ws[cell_address].s = {
                        ...ws[cell_address].s,
                        font: { name: 'Calibri', sz: 16, bold: true, color: { rgb: 'FFFFFF' } },
                        fill: { fgColor: { rgb: this.companyColors.primary.substring(2) } },
                        alignment: { horizontal: 'center', vertical: 'center' }
                    };
                }
                // Titres de sections
                else if (ws[cell_address].v && typeof ws[cell_address].v === 'string' && 
                        (ws[cell_address].v.includes('INFORMATIONS') || 
                         ws[cell_address].v.includes('RÉSULTATS') || 
                         ws[cell_address].v.includes('STATISTIQUES'))) {
                    ws[cell_address].s = {
                        ...ws[cell_address].s,
                        font: { name: 'Calibri', sz: 12, bold: true, color: { rgb: 'FFFFFF' } },
                        fill: { fgColor: { rgb: this.companyColors.secondary.substring(2) } }
                    };
                }
                // Conformité globale
                else if (ws[cell_address].v === 'CONFORME') {
                    ws[cell_address].s.fill = { fgColor: { rgb: this.companyColors.success.substring(2) } };
                    ws[cell_address].s.font = { ...ws[cell_address].s.font, bold: true, color: { rgb: 'FFFFFF' } };
                }
                else if (ws[cell_address].v === 'NON CONFORME') {
                    ws[cell_address].s.fill = { fgColor: { rgb: this.companyColors.danger.substring(2) } };
                    ws[cell_address].s.font = { ...ws[cell_address].s.font, bold: true, color: { rgb: 'FFFFFF' } };
                }
            }
        }

        // Fusionner les cellules du titre
        ws['!merges'] = [{ s: { c: 0, r: 0 }, e: { c: 3, r: 0 } }];
    }

    formatQuestionsSheet(ws, rowCount) {
        if (!ws['!ref']) return;
        
        // Largeurs de colonnes
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

                // Titre principal
                if (R === 0) {
                    ws[cell_address].s = {
                        ...ws[cell_address].s,
                        font: { name: 'Calibri', sz: 16, bold: true, color: { rgb: 'FFFFFF' } },
                        fill: { fgColor: { rgb: this.companyColors.primary.substring(2) } },
                        alignment: { horizontal: 'center', vertical: 'center' }
                    };
                }
                // En-têtes de colonnes
                else if (R === 2) {
                    ws[cell_address].s = {
                        ...ws[cell_address].s,
                        font: { name: 'Calibri', sz: 11, bold: true, color: { rgb: 'FFFFFF' } },
                        fill: { fgColor: { rgb: this.companyColors.secondary.substring(2) } },
                        alignment: { horizontal: 'center', vertical: 'center' }
                    };
                }
                // Coloration des conformités
                else if (C === 4) { // Colonne Conformité
                    if (ws[cell_address].v === 'CONFORME') {
                        ws[cell_address].s.fill = { fgColor: { rgb: this.companyColors.success.substring(2) } };
                        ws[cell_address].s.font = { ...ws[cell_address].s.font, bold: true, color: { rgb: 'FFFFFF' } };
                    } else if (ws[cell_address].v === 'NON CONFORME') {
                        ws[cell_address].s.fill = { fgColor: { rgb: this.companyColors.danger.substring(2) } };
                        ws[cell_address].s.font = { ...ws[cell_address].s.font, bold: true, color: { rgb: 'FFFFFF' } };
                    }
                }
                // Coloration des réponses
                else if (C === 2) { // Colonne Réponse
                    if (ws[cell_address].v === 'Oui') {
                        ws[cell_address].s.font = { ...ws[cell_address].s.font, color: { rgb: this.companyColors.success.substring(2) }, bold: true };
                    } else if (ws[cell_address].v === 'Non') {
                        ws[cell_address].s.font = { ...ws[cell_address].s.font, color: { rgb: this.companyColors.danger.substring(2) }, bold: true };
                    }
                }
            }
        }

        // Fusionner le titre
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

                // Titre
                if (R === 0) {
                    ws[cell_address].s = {
                        ...ws[cell_address].s,
                        font: { name: 'Calibri', sz: 16, bold: true, color: { rgb: 'FFFFFF' } },
                        fill: { fgColor: { rgb: this.companyColors.danger.substring(2) } },
                        alignment: { horizontal: 'center', vertical: 'center' }
                    };
                }
                // En-têtes
                else if (R === 2) {
                    ws[cell_address].s = {
                        ...ws[cell_address].s,
                        font: { name: 'Calibri', sz: 11, bold: true, color: { rgb: 'FFFFFF' } },
                        fill: { fgColor: { rgb: this.companyColors.warning.substring(2) } },
                        alignment: { horizontal: 'center', vertical: 'center' }
                    };
                }
                // Colonne obligatoire
                else if (C === 3) {
                    if (ws[cell_address].v === 'OUI') {
                        ws[cell_address].s.fill = { fgColor: { rgb: this.companyColors.danger.substring(2) } };
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
                        fill: { fgColor: { rgb: this.companyColors.info.substring(2) } },
                        alignment: { horizontal: 'center', vertical: 'center' }
                    };
                } else if (R === 2) {
                    ws[cell_address].s = {
                        ...ws[cell_address].s,
                        font: { name: 'Calibri', sz: 11, bold: true, color: { rgb: 'FFFFFF' } },
                        fill: { fgColor: { rgb: this.companyColors.secondary.substring(2) } },
                        alignment: { horizontal: 'center', vertical: 'center' }
                    };
                } else if (C === 4) { // Colonne Statut
                    if (ws[cell_address].v === 'CONFORME') {
                        ws[cell_address].s.fill = { fgColor: { rgb: this.companyColors.success.substring(2) } };
                        ws[cell_address].s.font = { ...ws[cell_address].s.font, bold: true, color: { rgb: 'FFFFFF' } };
                    } else if (ws[cell_address].v === 'NON CONFORME') {
                        ws[cell_address].s.fill = { fgColor: { rgb: this.companyColors.danger.substring(2) } };
                        ws[cell_address].s.font = { ...ws[cell_address].s.font, bold: true, color: { rgb: 'FFFFFF' } };
                    } else if (ws[cell_address].v === 'AVEC RÉSERVES') {
                        ws[cell_address].s.fill = { fgColor: { rgb: this.companyColors.warning.substring(2) } };
                        ws[cell_address].s.font = { ...ws[cell_address].s.font, bold: true };
                    }
                }
            }
        }

        ws['!merges'] = [{ s: { c: 0, r: 0 }, e: { c: 4, r: 0 } }];
    }

    // Extraire les détails du contrôle (inchangé)
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

    // Obtenir le nom du document (inchangé)
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

    // Export Excel global enrichi avec tous les contrôles
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

    // ONGLET 1: VUE D'ENSEMBLE - Tableau récapitulatif de tous les contrôles
    createOverviewSheet(wb) {
        const overviewData = [
            ['HISTORIQUE COMPLET DES CONTRÔLES DOCUMENTAIRES', '', '', '', '', '', '', '', '', ''],
            ['', '', '', '', '', '', '', '', '', ''],
            ['Date', 'Type', 'Client', 'Code Dossier', 'Conseiller', 'Montant', 'Domaine', 'Type d\'acte', 'Date d\'envoi', 'Documents', 'Conformité']
        ];

        // Ajouter tous les contrôles
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
                controle.anomaliesMajeures,
                controle.conformiteGlobale
            ]);
        });

        const ws = XLSX.utils.aoa_to_sheet(overviewData);
        this.formatOverviewSheet(ws, overviewData.length);
        XLSX.utils.book_append_sheet(wb, ws, "Vue d'ensemble");
    }

    // ONGLET 2: TOUTES LES QUESTIONS-RÉPONSES
    createAllQuestionsSheet(wb) {
        const questionsData = [
            ['DÉTAIL DE TOUTES LES QUESTIONS ET RÉPONSES', '', '', '', '', '', '', ''],
            ['', '', '', '', '', '', '', ''],
            ['Date', 'Client', 'Type Contrôle', 'Document', 'Question', 'Réponse', 'Qualité', 'Justification']
        ];

        // Parcourir tous les contrôles
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
                // Ajouter une ligne même si pas de détails
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

    // ONGLET 3: TOUTES LES ANOMALIES
    createGlobalAnomaliesSheet(wb) {
        const anomaliesData = [
            ['TOUTES LES ANOMALIES DÉTECTÉES', '', '', '', '', '', '', ''],
            ['', '', '', '', '', '', '', ''],
            ['Date', 'Client', 'Type Contrôle', 'Document', 'Question', 'Type Anomalie', 'Obligatoire', 'Justification']
        ];

        let totalAnomalies = 0;

        // Collecter toutes les anomalies
        this.controles.forEach(controle => {
            if (controle.details && controle.details.length > 0) {
                const anomalies = controle.details.filter(d => !d.conforme);
                
                anomalies.forEach(anomalie => {
                    totalAnomalies++;
                    anomaliesData.push([
                        controle.date.toLocaleDateString('fr-FR'),
                        controle.client,
                        controle.type,
                        anomalie.document,
                        anomalie.question,
                        anomalie.reponse === 'Non' ? 'Document manquant' : 'Qualité insuffisante',
                        anomalie.obligatoire ? 'OUI' : 'NON',
                        anomalie.justification || '-'
                    ]);
                });
            }
        });

        if (totalAnomalies === 0) {
            anomaliesData.push(['AUCUNE ANOMALIE DÉTECTÉE', '', '', '', '', '', '', '']);
            anomaliesData.push(['Félicitations ! Tous les contrôles sont conformes.', '', '', '', '', '', '', '']);
        }

        const ws = XLSX.utils.aoa_to_sheet(anomaliesData);
        this.formatAnomaliesGlobalSheet(ws, anomaliesData.length);
        XLSX.utils.book_append_sheet(wb, ws, "Anomalies");
    }

    // ONGLET 4: STATISTIQUES PAR TYPE
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

        // Calculer les stats par type
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

    // ONGLET 5: DONNÉES BRUTES (pour analyse)
    createRawDataSheet(wb) {
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

    // FORMATAGE DES FEUILLES

    formatOverviewSheet(ws, rowCount) {
        if (!ws['!ref']) return;
        
        // Largeurs de colonnes optimisées
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

                // Titre principal
                if (R === 0) {
                    ws[cell_address].s = {
                        ...ws[cell_address].s,
                        font: { name: 'Calibri', sz: 14, bold: true, color: { rgb: 'FFFFFF' } },
                        fill: { fgColor: { rgb: this.companyColors.primary.substring(2) } },
                        alignment: { horizontal: 'center', vertical: 'center' }
                    };
                }
                // En-têtes de colonnes
                else if (R === 2) {
                    ws[cell_address].s = {
                        ...ws[cell_address].s,
                        font: { name: 'Calibri', sz: 11, bold: true, color: { rgb: 'FFFFFF' } },
                        fill: { fgColor: { rgb: this.companyColors.secondary.substring(2) } },
                        alignment: { horizontal: 'center', vertical: 'center' }
                    };
                }
                // Données
                else if (R > 2) {
                    // Alternance de couleurs
                    const isEvenRow = (R - 3) % 2 === 0;
                    ws[cell_address].s.fill = { 
                        fgColor: { rgb: isEvenRow ? 'FFFFFF' : this.companyColors.light.substring(2) } 
                    };
                    
                    // Coloration spéciale pour la conformité (dernière colonne)
                    if (C === range.e.c) {
                        if (ws[cell_address].v === 'CONFORME') {
                            ws[cell_address].s.fill = { fgColor: { rgb: this.companyColors.success.substring(2) } };
                            ws[cell_address].s.font = { ...ws[cell_address].s.font, bold: true, color: { rgb: 'FFFFFF' } };
                        } else if (ws[cell_address].v === 'NON CONFORME') {
                            ws[cell_address].s.fill = { fgColor: { rgb: this.companyColors.danger.substring(2) } };
                            ws[cell_address].s.font = { ...ws[cell_address].s.font, bold: true, color: { rgb: 'FFFFFF' } };
                        }
                    }
                    
                    // Coloration pour les anomalies (avant-dernière colonne)
                    if (C === range.e.c - 1) {
                        const anomalies = parseInt(ws[cell_address].v) || 0;
                        if (anomalies > 0) {
                            ws[cell_address].s.font = { 
                                ...ws[cell_address].s.font, 
                                color: { rgb: this.companyColors.danger.substring(2) }, 
                                bold: true 
                            };
                        } else {
                            ws[cell_address].s.font = { 
                                ...ws[cell_address].s.font, 
                                color: { rgb: this.companyColors.success.substring(2) },
                                bold: true
                            };
                        }
                    }
                }
            }
        }

        // Fusionner le titre
        ws['!merges'] = [{ s: { c: 0, r: 0 }, e: { c: 10, r: 0 } }];
        
        // Filtres automatiques
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
                        fill: { fgColor: { rgb: this.companyColors.primary.substring(2) } },
                        alignment: { horizontal: 'center', vertical: 'center' }
                    };
                } else if (R === 2) {
                    ws[cell_address].s = {
                        ...ws[cell_address].s,
                        font: { name: 'Calibri', sz: 11, bold: true, color: { rgb: 'FFFFFF' } },
                        fill: { fgColor: { rgb: this.companyColors.secondary.substring(2) } },
                        alignment: { horizontal: 'center', vertical: 'center' }
                    };
                } else if (R > 2) {
                    // Coloration des réponses
                    if (C === 5) { // Colonne Réponse
                        if (ws[cell_address].v === 'Oui') {
                            ws[cell_address].s.font = { ...ws[cell_address].s.font, color: { rgb: this.companyColors.success.substring(2) }, bold: true };
                        } else if (ws[cell_address].v === 'Non') {
                            ws[cell_address].s.font = { ...ws[cell_address].s.font, color: { rgb: this.companyColors.danger.substring(2) }, bold: true };
                        }
                    }
                }
            }
        }

        ws['!merges'] = [{ s: { c: 0, r: 0 }, e: { c: 7, r: 0 } }];
        ws['!autofilter'] = { ref: `A3:H3` };
    }

    formatAnomaliesGlobalSheet(ws, rowCount) {
        if (!ws['!ref']) return;
        
        ws['!cols'] = [
            { width: 12 },  // Date
            { width: 25 },  // Client
            { width: 16 },  // Type
            { width: 15 },  // Document
            { width: 40 },  // Question
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
                        font: { name: 'Calibri', sz: 14, bold: true, color: { rgb: 'FFFFFF' } },
                        fill: { fgColor: { rgb: this.companyColors.danger.substring(2) } },
                        alignment: { horizontal: 'center', vertical: 'center' }
                    };
                } else if (R === 2) {
                    ws[cell_address].s = {
                        ...ws[cell_address].s,
                        font: { name: 'Calibri', sz: 11, bold: true, color: { rgb: 'FFFFFF' } },
                        fill: { fgColor: { rgb: this.companyColors.warning.substring(2) } },
                        alignment: { horizontal: 'center', vertical: 'center' }
                    };
                } else if (R > 2) {
                    // Coloration obligatoire
                    if (C === 6) { // Colonne Obligatoire
                        if (ws[cell_address].v === 'OUI') {
                            ws[cell_address].s.fill = { fgColor: { rgb: this.companyColors.danger.substring(2) } };
                            ws[cell_address].s.font = { ...ws[cell_address].s.font, bold: true, color: { rgb: 'FFFFFF' } };
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

                // Formatage spécial selon le contenu
                if (ws[cell_address].v && typeof ws[cell_address].v === 'string') {
                    if (ws[cell_address].v.includes('STATISTIQUES') || ws[cell_address].v.includes('RÉSUMÉ') || ws[cell_address].v.includes('RÉPARTITION')) {
                        ws[cell_address].s = {
                            ...ws[cell_address].s,
                            font: { name: 'Calibri', sz: 12, bold: true, color: { rgb: 'FFFFFF' } },
                            fill: { fgColor: { rgb: this.companyColors.secondary.substring(2) } },
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

    formatRawDataSheet(ws) {
        if (!ws['!ref']) return;
        
        const range = XLSX.utils.decode_range(ws['!ref']);
        
        // En-têtes en bleu
        for (let C = range.s.c; C <= range.e.c; ++C) {
            const cell_address = XLSX.utils.encode_cell({ c: C, r: 0 });
            if (ws[cell_address]) {
                ws[cell_address].s = {
                    font: { name: 'Calibri', sz: 11, bold: true, color: { rgb: 'FFFFFF' } },
                    fill: { fgColor: { rgb: this.companyColors.primary.substring(2) } },
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

    formatHistorySheet(ws) {
        if (!ws['!ref']) return;
        
        ws['!cols'] = [
            { width: 12 }, { width: 16 }, { width: 25 }, { width: 15 }, { width: 20 },
            { width: 15 }, { width: 12 }, { width: 12 }, { width: 18 }, { width: 12 }, { width: 15 }
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
                
                // En-têtes
                if (R === 0) {
                    ws[cell_address].s = {
                        ...ws[cell_address].s,
                        font: { name: 'Calibri', sz: 11, bold: true, color: { rgb: 'FFFFFF' } },
                        fill: { fgColor: { rgb: this.companyColors.primary.substring(2) } },
                        alignment: { horizontal: 'center', vertical: 'center' }
                    };
                } else {
                    // Alternance de couleurs
                    const isEvenRow = R % 2 === 0;
                    ws[cell_address].s.fill = { 
                        fgColor: { rgb: isEvenRow ? 'FFFFFF' : this.companyColors.light.substring(2) } 
                    };
                    
                    // Coloration conformité (dernière colonne)
                    if (C === range.e.c) {
                        if (ws[cell_address].v === 'CONFORME') {
                            ws[cell_address].s.fill = { fgColor: { rgb: this.companyColors.success.substring(2) } };
                            ws[cell_address].s.font = { ...ws[cell_address].s.font, bold: true, color: { rgb: 'FFFFFF' } };
                        } else if (ws[cell_address].v === 'NON CONFORME') {
                            ws[cell_address].s.fill = { fgColor: { rgb: this.companyColors.danger.substring(2) } };
                            ws[cell_address].s.font = { ...ws[cell_address].s.font, bold: true, color: { rgb: 'FFFFFF' } };
                        }
                    }
                }
            }
        }
    }

    // Méthodes existantes (inchangées)
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

    // NOUVELLE MÉTHODE : Export de sauvegarde JSON pour backup
    exportBackupJSON() {
        const backupData = {
        version: "1.1", // Augmenter la version pour inclure les suspendus
        exportDate: new Date().toISOString(),
        totalControles: this.controles.length,
        totalSuspended: this.suspendedControls.length, // NOUVEAU
        controles: this.controles.map(c => ({
            ...c,
            date: c.date.toISOString() // Sérialiser les dates
        })),
        // NOUVEAU : Inclure les contrôles suspendus
        suspendedControles: this.suspendedControls.map(sc => ({
            ...sc,
            suspendedAt: sc.suspendedAt.toISOString() // Sérialiser les dates
        })),
        // NOUVEAU : Inclure les dossiers contrôlés
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

    // NOUVEAU : Sauvegarder un contrôle suspendu
    saveSuspendedControl(suspendedControl) {
        try {
            // Vérifier si un contrôle suspendu existe déjà pour ce dossier/type
            const existingIndex = this.suspendedControls.findIndex(sc => 
                sc.dossierKey === suspendedControl.dossierKey && 
                sc.type === suspendedControl.type
            );

            if (existingIndex !== -1) {
                // Remplacer le contrôle existant
                this.suspendedControls[existingIndex] = suspendedControl;
                Utils.debugLog(`Contrôle suspendu mis à jour: ${suspendedControl.dossier.client}`);
            } else {
                // Ajouter un nouveau contrôle suspendu
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

    // NOUVEAU : Obtenir un contrôle suspendu
    getSuspendedControl(dossierKey, controlType) {
        return this.suspendedControls.find(sc => 
            sc.dossierKey === dossierKey && 
            sc.type === controlType
        );
    }

    // NOUVEAU : Obtenir un contrôle suspendu par ID
    getSuspendedControlById(controlId) {
        return this.suspendedControls.find(sc => sc.id === controlId);
    }

    // NOUVEAU : Supprimer un contrôle suspendu
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

    // NOUVEAU : Obtenir tous les contrôles suspendus
    getSuspendedControls() {
        return this.suspendedControls.sort((a, b) => new Date(b.suspendedAt) - new Date(a.suspendedAt));
    }

    // NOUVEAU : Marquer un dossier comme contrôlé
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

    // NOUVEAU : Vérifier si un dossier est contrôlé
    isDossierControlled(dossierKey, controlType) {
        const key = `${dossierKey}_${controlType}`;
        return this.controlledDossiers.has(key);
    }

    // NOUVEAU : Obtenir le statut d'un dossier
    getDossierStatus(dossierKey, controlType) {
        // Vérifier d'abord les contrôles suspendus
        const suspended = this.getSuspendedControl(dossierKey, controlType);
        if (suspended) {
            return {
                status: 'suspended',
                suspendedAt: suspended.suspendedAt,
                suspendReason: suspended.suspendReason
            };
        }

        // Vérifier les contrôles terminés
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

    // NOUVEAU : Générer une clé unique pour un dossier
    generateDossierKey(dossier) {
        return `${dossier.codeDossier || 'NO_CODE'}_${dossier.reference || 'NO_REF'}_${dossier.montant || 'NO_AMOUNT'}`;
    }

    // NOUVEAU : Recherche avec filtres incluant les suspendus
    searchControls(criteria) {
        let results = this.controles.filter(controle => {
            if (criteria.dateDebut && controle.date < criteria.dateDebut) return false;
            if (criteria.dateFin && controle.date > criteria.dateFin) return false;
            if (criteria.type && controle.type !== criteria.type) return false;
            if (criteria.conseiller && !controle.conseiller.toLowerCase().includes(criteria.conseiller.toLowerCase())) return false;
            if (criteria.client && !controle.client.toLowerCase().includes(criteria.client.toLowerCase())) return false;
            if (criteria.conformite && controle.conformiteGlobale !== criteria.conformite) return false;
            
            return true;
        });

        // NOUVEAU : Ajouter les contrôles suspendus si demandé
        if (criteria.includeSuspended) {
            const suspendedResults = this.suspendedControls
                .filter(suspended => {
                    if (criteria.dateDebut && new Date(suspended.suspendedAt) < criteria.dateDebut) return false;
                    if (criteria.dateFin && new Date(suspended.suspendedAt) > criteria.dateFin) return false;
                    if (criteria.type && suspended.type !== criteria.type) return false;
                    if (criteria.conseiller && !suspended.dossier.conseiller?.toLowerCase().includes(criteria.conseiller.toLowerCase())) return false;
                    if (criteria.client && !suspended.dossier.client?.toLowerCase().includes(criteria.client.toLowerCase())) return false;
                    
                    return true;
                })
                .map(suspended => ({
                    id: suspended.id,
                    date: new Date(suspended.suspendedAt),
                    type: suspended.type,
                    client: suspended.dossier.client,
                    codeDossier: suspended.dossier.codeDossier,
                    conseiller: suspended.dossier.conseiller,
                    montant: suspended.dossier.montant,
                    domaine: suspended.dossier.domaine,
                    nouveauClient: suspended.dossier.nouveauClient,
                    statut: 'Suspendu',
                    anomaliesMajeures: 0,
                    documentsControles: `${Object.keys(suspended.responses || {}).length} questions`,
                    conformiteGlobale: 'EN ATTENTE',
                    suspendReason: suspended.suspendReason,
                    isSuspended: true
                }));
                
            results = [...results, ...suspendedResults];
        }

        return results;
    }

    // NOUVEAU : Statistiques incluant les contrôles suspendus
    getStatistics() {
        const totalControles = this.controles.length;
        const totalSuspended = this.suspendedControls.length;
        const conformes = this.controles.filter(c => c.conformiteGlobale === 'CONFORME').length;
        
        const thisMonth = new Date();
        thisMonth.setDate(1);
        const controlesMoisActuel = this.controles.filter(c => c.date >= thisMonth).length;
        const suspendedMoisActuel = this.suspendedControls.filter(c => new Date(c.suspendedAt) >= thisMonth).length;
        
        const repartitionTypes = {};
        this.controles.forEach(c => {
            repartitionTypes[c.type] = (repartitionTypes[c.type] || 0) + 1;
        });
        
        // Ajouter les suspendus dans les statistiques
        this.suspendedControls.forEach(c => {
            const key = `${c.type} (Suspendus)`;
            repartitionTypes[key] = (repartitionTypes[key] || 0) + 1;
        });
        
        const typePlusFrequent = Object.entries(repartitionTypes)
            .sort(([,a], [,b]) => b - a)[0]?.[0] || 'Aucun';

        const anomaliesMajeures = this.controles.reduce((sum, c) => sum + c.anomaliesMajeures, 0);
        
        // Alertes pour les contrôles suspendus depuis longtemps
        const oldSuspended = this.suspendedControls.filter(c => {
            const daysSuspended = Math.floor((new Date() - new Date(c.suspendedAt)) / (1000 * 60 * 60 * 24));
            return daysSuspended >= 14;
        }).length;
        
        return {
            totalControles,
            totalSuspended,
            oldSuspended,
            tauxConformite: totalControles > 0 ? Math.round((conformes / totalControles) * 100) : 0,
            totalAnomaliesMajeures: anomaliesMajeures,
            controlesMoisActuel,
            suspendedMoisActuel,
            typePlusFrequent,
            repartitionTypes
        };
    }

    // NOUVEAU : Sauvegarder les contrôles suspendus dans localStorage
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

    // NOUVEAU : Charger les contrôles suspendus depuis localStorage
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

    // NOUVEAU : Sauvegarder les dossiers contrôlés
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

    // NOUVEAU : Charger les dossiers contrôlés
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

    // NOUVEAU : Export des contrôles suspendus
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
            
            // Formatage spécial pour les suspendus
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

    // NOUVEAU : Formatage de la feuille des contrôles suspendus
    formatSuspendedSheet(ws, rowCount) {
        if (!ws['!ref']) return;
        
        const range = XLSX.utils.decode_range(ws['!ref']);
        
        // Largeurs de colonnes
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
                
                // En-têtes
                if (R === 0) {
                    ws[cell_address].s = {
                        ...ws[cell_address].s,
                        font: { name: 'Calibri', sz: 11, bold: true, color: { rgb: 'FFFFFF' } },
                        fill: { fgColor: { rgb: this.companyColors.warning.substring(2) } },
                        alignment: { horizontal: 'center', vertical: 'center' }
                    };
                } else {
                    // Alternance de couleurs avec fond d'alerte
                    const isEvenRow = R % 2 === 0;
                    ws[cell_address].s.fill = { 
                        fgColor: { rgb: isEvenRow ? 'FFF8DC' : 'FFFACD' } // Tons jaunes pour les suspendus
                    };
                    
                    // Coloration spéciale pour les jours suspendus (avant-dernière colonne)
                    if (C === range.e.c - 1) {
                        const days = parseInt(ws[cell_address].v) || 0;
                        if (days >= 30) {
                            ws[cell_address].s.fill = { fgColor: { rgb: this.companyColors.danger.substring(2) } };
                            ws[cell_address].s.font = { ...ws[cell_address].s.font, bold: true, color: { rgb: 'FFFFFF' } };
                        } else if (days >= 14) {
                            ws[cell_address].s.fill = { fgColor: { rgb: this.companyColors.warning.substring(2) } };
                            ws[cell_address].s.font = { ...ws[cell_address].s.font, bold: true };
                        }
                    }
                    
                    // Statut suspendu (dernière colonne)
                    if (C === range.e.c) {
                        ws[cell_address].s.fill = { fgColor: { rgb: this.companyColors.warning.substring(2) } };
                        ws[cell_address].s.font = { ...ws[cell_address].s.font, bold: true };
                    }
                }
            }
        }
        
        ws['!autofilter'] = { ref: ws['!ref'] };
    }

    // NOUVEAU : Nettoyage des contrôles suspendus anciens (optionnel)
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

    // MODIFICATION 5: Nouvelle méthode pour obtenir un résumé complet
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
    
    // MODIFICATION 6: Export Excel enrichi avec onglet des suspendus
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
            
            // 1. Onglet Vue d'ensemble (comme avant)
            this.createOverviewSheet(wb);
            
            // 2. NOUVEAU : Onglet Contrôles suspendus
            if (this.suspendedControls.length > 0) {
                this.createSuspendedOverviewSheet(wb);
            }
            
            // 3. Onglet Détail Questions-Réponses (comme avant)
            this.createAllQuestionsSheet(wb);
            
            // 4. Onglet Anomalies Globales (comme avant)
            this.createGlobalAnomaliesSheet(wb);
            
            // 5. Onglet Statistiques enrichies
            this.createEnhancedStatsSheet(wb);
            
            // 6. Onglet Données Brutes enrichies
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

    // NOUVELLE MÉTHODE : Créer l'onglet des contrôles suspendus dans l'export complet
    createSuspendedOverviewSheet(wb) {
        const suspendedData = [
            ['CONTRÔLES SUSPENDUS', '', '', '', '', '', '', '', '', ''],
            ['', '', '', '', '', '', '', '', '', ''],
            ['Date Suspension', 'Type', 'Client', 'Code Dossier', 'Conseiller', 'Questions', 'Dernier Doc', 'Jours', 'Raison', 'Statut']
        ];

        // Ajouter tous les contrôles suspendus
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

    // NOUVELLE MÉTHODE : Formatage de l'onglet suspendus dans l'export complet
    formatSuspendedOverviewSheet(ws, rowCount) {
        if (!ws['!ref']) return;
        
        // Largeurs de colonnes optimisées
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

                // Titre principal
                if (R === 0) {
                    ws[cell_address].s = {
                        ...ws[cell_address].s,
                        font: { name: 'Calibri', sz: 14, bold: true, color: { rgb: 'FFFFFF' } },
                        fill: { fgColor: { rgb: this.companyColors.warning.substring(2) } },
                        alignment: { horizontal: 'center', vertical: 'center' }
                    };
                }
                // En-têtes de colonnes
                else if (R === 2) {
                    ws[cell_address].s = {
                        ...ws[cell_address].s,
                        font: { name: 'Calibri', sz: 11, bold: true, color: { rgb: 'FFFFFF' } },
                        fill: { fgColor: { rgb: this.companyColors.secondary.substring(2) } },
                        alignment: { horizontal: 'center', vertical: 'center' }
                    };
                }
                // Données
                else if (R > 2) {
                    // Fond d'alerte pour les suspendus
                    ws[cell_address].s.fill = { fgColor: { rgb: 'FFFACD' } }; // Jaune clair
                    
                    // Coloration spéciale pour les jours suspendus
                    if (C === 7) { // Colonne Jours
                        const days = parseInt(ws[cell_address].v) || 0;
                        if (days >= 30) {
                            ws[cell_address].s.fill = { fgColor: { rgb: this.companyColors.danger.substring(2) } };
                            ws[cell_address].s.font = { ...ws[cell_address].s.font, bold: true, color: { rgb: 'FFFFFF' } };
                        } else if (days >= 14) {
                            ws[cell_address].s.fill = { fgColor: { rgb: this.companyColors.warning.substring(2) } };
                            ws[cell_address].s.font = { ...ws[cell_address].s.font, bold: true };
                        }
                    }
                    
                    // Statut suspendu (dernière colonne)
                    if (C === range.e.c) {
                        ws[cell_address].s.fill = { fgColor: { rgb: this.companyColors.warning.substring(2) } };
                        ws[cell_address].s.font = { ...ws[cell_address].s.font, bold: true };
                    }
                }
            }
        }

        // Fusionner le titre
        ws['!merges'] = [{ s: { c: 0, r: 0 }, e: { c: 9, r: 0 } }];
        
        // Filtres automatiques
        ws['!autofilter'] = { ref: `A3:${XLSX.utils.encode_col(range.e.c)}3` };
    }
    // NOUVELLE MÉTHODE : Créer les onglets par type de contrôle
    createControlTypeSheets(wb) {
        const controlesByType = this.groupControlsByType();
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
        
        const documentsInfo = this.analyzeDocumentsForType(controles);
        const headers = this.createTypeSheetHeaders(documentsInfo);
        const data = [headers];
        
        controles.forEach(controle => {
            const row = this.createTypeSheetRow(controle, documentsInfo);
            data.push(row);
        });
        
        const ws = XLSX.utils.aoa_to_sheet(data);
        this.formatTypeSheet(ws, data.length, headers.length, documentsInfo);
        
        const safeName = this.createSafeSheetName(type);
        XLSX.utils.book_append_sheet(wb, ws, safeName);
        
        Utils.debugLog(`Onglet créé: ${safeName}`);
    }

    // NOUVELLE MÉTHODE : Analyser les documents pour un type de contrôle
    analyzeDocumentsForType(controles) {
        const documentsMap = new Map();
        
        controles.forEach(controle => {
            if (controle.details && controle.details.length > 0) {
                const detailsByDoc = {};
                controle.details.forEach(detail => {
                    if (!detailsByDoc[detail.document]) {
                        detailsByDoc[detail.document] = [];
                    }
                    detailsByDoc[detail.document].push(detail);
                });
                
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
            'Date', 'Client', 'Code Dossier', 'Conseiller', 'Montant', 
            'Domaine', 'Nouveau Client', 'Type d\'acte', 'Date d\'envoi'
        ];
        
        documentsInfo.forEach(docInfo => {
            headers.push(`${docInfo.name} - Statut`);
            
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
        
        let short = question
            .replace(/Est-ce que le document/gi, 'Document')
            .replace(/est-il présent/gi, 'présent?')
            .replace(/a été réalisé\(e\)/gi, 'réalisé?')
            .replace(/a été créé/gi, 'créé?')
            .replace(/Tous les documents sont-ils bien ajoutés dans Zeendoc/gi, 'Zeendoc?')
            .replace(/Le document/gi, 'Doc')
            .replace(/La pièce/gi, 'Pièce')
            .trim();
        
        //if (short.length > 50) {
        //   short = short.substring(0, 47) + '...';
        //}
        
        return short;
    }
    
    // NOUVELLE MÉTHODE : Créer une ligne de données pour un contrôle
    createTypeSheetRow(controle, documentsInfo) {
        const row = [
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
        
        const detailsByDoc = {};
        if (controle.details && controle.details.length > 0) {
            controle.details.forEach(detail => {
                if (!detailsByDoc[detail.document]) {
                    detailsByDoc[detail.document] = [];
                }
                detailsByDoc[detail.document].push(detail);
            });
        }
        
        documentsInfo.forEach(docInfo => {
            const docDetails = detailsByDoc[docInfo.name] || [];
            const docStatus = this.getDocumentStatus(docDetails);
            row.push(docStatus);
            
            docInfo.questionsArray.forEach(question => {
                const detail = docDetails.find(d => d.question === question);
                if (detail) {
                    if (docStatus === 'ABSENT') {
                        row.push('-');
                    } else {
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
        
        const firstDetail = docDetails[0];
        if (firstDetail && this.isDocumentPresenceQuestion(firstDetail.question) && firstDetail.reponse === 'Non') {
            return 'ABSENT';
        }
        
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
    
    // NOUVELLE MÉTHODE : Créer un nom d'onglet sécurisé
    createSafeSheetName(typeName) {
        let safeName = typeName
            .replace(/[:\\/?*\[\]]/g, '_')
            .substring(0, 31);
            
        if (!safeName.trim()) {
            safeName = 'Controle';
        }
        
        return safeName;
    }

    // NOUVELLE MÉTHODE : Formater un onglet de type
    formatTypeSheet(ws, rowCount, colCount, documentsInfo) {
        if (!ws['!ref']) return;
        
        const range = XLSX.utils.decode_range(ws['!ref']);
        const colWidths = this.calculateColumnWidths(documentsInfo);
        ws['!cols'] = colWidths;
        
        for (let R = range.s.r; R <= range.e.r; ++R) {
            for (let C = range.s.c; C <= range.e.c; ++C) {
                const cell_address = XLSX.utils.encode_cell({ c: C, r: R });
                if (!ws[cell_address]) continue;
                
                ws[cell_address].s = {
                    alignment: { 
                        vertical: 'top', 
                        wrapText: true,
                        horizontal: C < 9 ? 'left'
                    },
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
                        font: { name: 'Calibri', sz: 10, bold: true, color: { rgb: 'FFFFFF' } },
                        fill: { fgColor: { rgb: this.companyColors.primary.substring(2) } },
                        alignment: { horizontal: 'center', vertical: 'center', wrapText: true }
                    };
                } else if (R > 0) {
                    const isEvenRow = R % 2 === 0;
                    ws[cell_address].s.fill = { 
                        fgColor: { rgb: isEvenRow ? 'FFFFFF' : this.companyColors.light.substring(2) } 
                    };
                    
                    if (this.isDocumentStatusColumn(C, documentsInfo)) {
                        const cellValue = ws[cell_address].v;
                        if (cellValue === 'CONFORME') {
                            ws[cell_address].s.fill = { fgColor: { rgb: this.companyColors.success.substring(2) } };
                            ws[cell_address].s.font = { ...ws[cell_address].s.font, bold: true, color: { rgb: 'FFFFFF' } };
                        } else if (cellValue === 'AVEC RÉSERVES') {
                            ws[cell_address].s.fill = { fgColor: { rgb: this.companyColors.warning.substring(2) } };
                            ws[cell_address].s.font = { ...ws[cell_address].s.font, bold: true };
                        } else if (cellValue === 'NON CONFORME' || cellValue === 'ABSENT') {
                            ws[cell_address].s.fill = { fgColor: { rgb: this.companyColors.danger.substring(2) } };
                            ws[cell_address].s.font = { ...ws[cell_address].s.font, bold: true, color: { rgb: 'FFFFFF' } };
                        }
                    } else if (this.isDocumentQuestionColumn(C, R, ws, documentsInfo)) {
                        const statusCol = this.getDocumentStatusColumnIndex(C, documentsInfo);
                        if (statusCol !== -1) {
                            const statusCell = ws[XLSX.utils.encode_cell({ c: statusCol, r: R })];
                            if (statusCell && statusCell.v === 'ABSENT' && ws[cell_address].v === '-') {
                                ws[cell_address].s.fill = { fgColor: { rgb: 'E9ECEF' } };
                                ws[cell_address].s.font = { ...ws[cell_address].s.font, color: { rgb: '6C757D' } };
                            }
                        }
                    }
                }
            }
        }
        
        ws['!rows'] = [{ hpt: 40 }];
        ws['!autofilter'] = { ref: `A1:${XLSX.utils.encode_col(range.e.c)}1` };
    }

    // NOUVELLE MÉTHODE : Calculer les largeurs de colonnes
    calculateColumnWidths(documentsInfo) {
        const widths = [
            { width: 12 }, { width: 25 }, { width: 15 }, { width: 20 }, { width: 15 },
            { width: 15 }, { width: 15 }, { width: 15 }, { width: 12 }
        ];
        
        documentsInfo.forEach(docInfo => {
            widths.push({ width: 15 });
            docInfo.questionsArray.forEach(() => {
                widths.push({ width: 40 });
            });
        });
        
        return widths;
    }
    
    // NOUVELLE MÉTHODE : Vérifier si c'est une colonne de statut de document
    isDocumentStatusColumn(colIndex, documentsInfo) {
        let currentCol = 9;
        
        for (const docInfo of documentsInfo) {
            if (colIndex === currentCol) {
                return true;
            }
            currentCol += 1 + docInfo.questionsArray.length;
        }
        
        return false;
    }
    
    // NOUVELLE MÉTHODE : Vérifier si c'est une colonne de question de document
    isDocumentQuestionColumn(colIndex, rowIndex, ws, documentsInfo) {
        let currentCol = 9;
        
        for (const docInfo of documentsInfo) {
            const questionsStart = currentCol + 1;
            const questionsEnd = questionsStart + docInfo.questionsArray.length - 1;
            
            if (colIndex >= questionsStart && colIndex <= questionsEnd) {
                return true;
            }
            
            currentCol += 1 + docInfo.questionsArray.length;
        }
        
        return false;
    }
    
    // NOUVELLE MÉTHODE : Obtenir l'index de la colonne statut pour une colonne de question
    getDocumentStatusColumnIndex(questionColIndex, documentsInfo) {
        let currentCol = 9;
        
        for (const docInfo of documentsInfo) {
            const statusCol = currentCol;
            const questionsStart = currentCol + 1;
            const questionsEnd = questionsStart + docInfo.questionsArray.length - 1;
            
            if (questionColIndex >= questionsStart && questionColIndex <= questionsEnd) {
                return statusCol;
            }
            
            currentCol += 1 + docInfo.questionsArray.length;
        }
        
        return -1;
    }
    
    // NOUVELLE MÉTHODE : Import de sauvegarde JSON
    importBackupJSON(file) {
        if (!file) return;

        const reader = new FileReader();
        
        reader.onload = (e) => {
            try {
                const backupData = JSON.parse(e.target.result);
                
                if (!backupData.controles || !Array.isArray(backupData.controles)) {
                    throw new Error('Format de sauvegarde invalide');
                }
                
                // Détecter la version de la sauvegarde
                const hasExtendedData = backupData.version >= "1.1" || backupData.suspendedControles;
                const suspendedCount = backupData.suspendedControles ? backupData.suspendedControles.length : 0;
                const controlledCount = backupData.controlledDossiers ? backupData.controlledDossiers.length : 0;
                
                // Message de confirmation enrichi
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
                
                // Restaurer les contrôles terminés (dates)
                this.controles = backupData.controles.map(c => ({
                    ...c,
                    date: new Date(c.date)
                }));
                
                // NOUVEAU : Restaurer les contrôles suspendus
                if (backupData.suspendedControles && Array.isArray(backupData.suspendedControles)) {
                    this.suspendedControls = backupData.suspendedControles.map(sc => ({
                        ...sc,
                        suspendedAt: new Date(sc.suspendedAt)
                    }));
                } else {
                    // Si pas de données suspendues dans la sauvegarde, vider la liste
                    this.suspendedControls = [];
                }
                
                // NOUVEAU : Restaurer les dossiers contrôlés
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
                    // Si pas de données de dossiers contrôlés, vider la Map
                    this.controlledDossiers = new Map();
                }
                
                // Sauvegarder tout dans localStorage
                this.saveToStorage();
                this.saveSuspendedToStorage();
                this.saveControlledDossiersToStorage();
                
                // Message de succès détaillé
                let successMessage = `Historique importé avec succès:`;
                successMessage += `\n• ${this.controles.length} contrôle(s) terminé(s)`;
                successMessage += `\n• ${this.suspendedControls.length} contrôle(s) suspendu(s)`;
                successMessage += `\n• ${this.controlledDossiers.size} dossier(s) marqué(s)`;
                
                Utils.showNotification(successMessage, 'success');
                
                // Rafraîchir l'interface historique si visible
                if (window.historyInterface && window.historyInterface.isHistorySectionActive()) {
                    window.historyInterface.refresh();
                }
                
                // Log détaillé
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
}


