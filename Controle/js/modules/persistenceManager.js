// persistenceManager.js - Version enrichie avec export Excel détaillé

import { Utils } from './utils.js';

export class PersistenceManager {
    constructor() {
        this.controles = [];
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
            
            Utils.debugLog(`Contrôle sauvegardé: ${controle.client}`);
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
                        fill: { fgColor: { rgb: this.companyColors.primary.substr(2) } },
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
                        fill: { fgColor: { rgb: this.companyColors.secondary.substr(2) } }
                    };
                }
                // Conformité globale
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
                        fill: { fgColor: { rgb: this.companyColors.primary.substr(2) } },
                        alignment: { horizontal: 'center', vertical: 'center' }
                    };
                }
                // En-têtes de colonnes
                else if (R === 2) {
                    ws[cell_address].s = {
                        ...ws[cell_address].s,
                        font: { name: 'Calibri', sz: 11, bold: true, color: { rgb: 'FFFFFF' } },
                        fill: { fgColor: { rgb: this.companyColors.secondary.substr(2) } },
                        alignment: { horizontal: 'center', vertical: 'center' }
                    };
                }
                // Coloration des conformités
                else if (C === 4) { // Colonne Conformité
                    if (ws[cell_address].v === 'CONFORME') {
                        ws[cell_address].s.fill = { fgColor: { rgb: this.companyColors.success.substr(2) } };
                        ws[cell_address].s.font = { ...ws[cell_address].s.font, bold: true, color: { rgb: 'FFFFFF' } };
                    } else if (ws[cell_address].v === 'NON CONFORME') {
                        ws[cell_address].s.fill = { fgColor: { rgb: this.companyColors.danger.substr(2) } };
                        ws[cell_address].s.font = { ...ws[cell_address].s.font, bold: true, color: { rgb: 'FFFFFF' } };
                    }
                }
                // Coloration des réponses
                else if (C === 2) { // Colonne Réponse
                    if (ws[cell_address].v === 'Oui') {
                        ws[cell_address].s.font = { ...ws[cell_address].s.font, color: { rgb: this.companyColors.success.substr(2) }, bold: true };
                    } else if (ws[cell_address].v === 'Non') {
                        ws[cell_address].s.font = { ...ws[cell_address].s.font, color: { rgb: this.companyColors.danger.substr(2) }, bold: true };
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
                        fill: { fgColor: { rgb: this.companyColors.danger.substr(2) } },
                        alignment: { horizontal: 'center', vertical: 'center' }
                    };
                }
                // En-têtes
                else if (R === 2) {
                    ws[cell_address].s = {
                        ...ws[cell_address].s,
                        font: { name: 'Calibri', sz: 11, bold: true, color: { rgb: 'FFFFFF' } },
                        fill: { fgColor: { rgb: this.companyColors.warning.substr(2) } },
                        alignment: { horizontal: 'center', vertical: 'center' }
                    };
                }
                // Colonne obligatoire
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
                } else if (C === 4) { // Colonne Statut
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
            99: 'Zeendoc'
        };
        return documentNames[docId] || `Document ${docId}`;
    }

    // Export Excel global enrichi avec tous les contrôles
    saveToExcel(fileName = null) {
        if (!fileName) {
            fileName = `Historique_Controles_Complet_${new Date().toISOString().split('T')[0]}.xlsx`;
        }

        if (this.controles.length === 0) {
            Utils.showNotification('Aucun contrôle à exporter', 'warning');
            return false;
        }

        try {
            const wb = XLSX.utils.book_new();
            
            // 1. Onglet Vue d'ensemble (tableau résumé de tous les contrôles)
            this.createOverviewSheet(wb);
            
            // 2. Onglet Détail Questions-Réponses (toutes les Q&R de tous les contrôles)
            this.createAllQuestionsSheet(wb);
            
            // 3. Onglet Anomalies Globales (toutes les anomalies détectées)
            this.createGlobalAnomaliesSheet(wb);
            
            // 4. Onglet Statistiques par Type de Contrôle
            this.createStatsSheet(wb);
            
            // 5. Onglet Données Brutes (pour import/analyse)
            this.createRawDataSheet(wb);
            
            XLSX.writeFile(wb, fileName);
            
            Utils.showNotification(`Export global généré: ${fileName}`, 'success');
            return true;

        } catch (error) {
            console.error('Erreur export Excel global:', error);
            Utils.showNotification('Erreur lors de l\'export global: ' + error.message, 'error');
            return false;
        }
    }

    // ONGLET 1: VUE D'ENSEMBLE - Tableau récapitulatif de tous les contrôles
    createOverviewSheet(wb) {
        const overviewData = [
            ['HISTORIQUE COMPLET DES CONTRÔLES DOCUMENTAIRES', '', '', '', '', '', '', '', '', ''],
            ['', '', '', '', '', '', '', '', '', ''],
            ['Date', 'Type', 'Client', 'Code Dossier', 'Conseiller', 'Montant', 'Domaine', 'Documents', 'Anomalies', 'Conformité']
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
            { width: 12 },  // Documents
            { width: 10 },  // Anomalies
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
                        fill: { fgColor: { rgb: this.companyColors.primary.substr(2) } },
                        alignment: { horizontal: 'center', vertical: 'center' }
                    };
                }
                // En-têtes de colonnes
                else if (R === 2) {
                    ws[cell_address].s = {
                        ...ws[cell_address].s,
                        font: { name: 'Calibri', sz: 11, bold: true, color: { rgb: 'FFFFFF' } },
                        fill: { fgColor: { rgb: this.companyColors.secondary.substr(2) } },
                        alignment: { horizontal: 'center', vertical: 'center' }
                    };
                }
                // Données
                else if (R > 2) {
                    // Alternance de couleurs
                    const isEvenRow = (R - 3) % 2 === 0;
                    ws[cell_address].s.fill = { 
                        fgColor: { rgb: isEvenRow ? 'FFFFFF' : this.companyColors.light.substr(2) } 
                    };
                    
                    // Coloration spéciale pour la conformité (dernière colonne)
                    if (C === range.e.c) {
                        if (ws[cell_address].v === 'CONFORME') {
                            ws[cell_address].s.fill = { fgColor: { rgb: this.companyColors.success.substr(2) } };
                            ws[cell_address].s.font = { ...ws[cell_address].s.font, bold: true, color: { rgb: 'FFFFFF' } };
                        } else if (ws[cell_address].v === 'NON CONFORME') {
                            ws[cell_address].s.fill = { fgColor: { rgb: this.companyColors.danger.substr(2) } };
                            ws[cell_address].s.font = { ...ws[cell_address].s.font, bold: true, color: { rgb: 'FFFFFF' } };
                        }
                    }
                    
                    // Coloration pour les anomalies (avant-dernière colonne)
                    if (C === range.e.c - 1) {
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
                }
            }
        }

        // Fusionner le titre
        ws['!merges'] = [{ s: { c: 0, r: 0 }, e: { c: 9, r: 0 } }];
        
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
                    // Coloration des réponses
                    if (C === 5) { // Colonne Réponse
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
                        fill: { fgColor: { rgb: this.companyColors.danger.substr(2) } },
                        alignment: { horizontal: 'center', vertical: 'center' }
                    };
                } else if (R === 2) {
                    ws[cell_address].s = {
                        ...ws[cell_address].s,
                        font: { name: 'Calibri', sz: 11, bold: true, color: { rgb: 'FFFFFF' } },
                        fill: { fgColor: { rgb: this.companyColors.warning.substr(2) } },
                        alignment: { horizontal: 'center', vertical: 'center' }
                    };
                } else if (R > 2) {
                    // Coloration obligatoire
                    if (C === 6) { // Colonne Obligatoire
                        if (ws[cell_address].v === 'OUI') {
                            ws[cell_address].s.fill = { fgColor: { rgb: this.companyColors.danger.substr(2) } };
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

    formatRawDataSheet(ws) {
        if (!ws['!ref']) return;
        
        const range = XLSX.utils.decode_range(ws['!ref']);
        
        // En-têtes en bleu
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
                        fill: { fgColor: { rgb: this.companyColors.primary.substr(2) } },
                        alignment: { horizontal: 'center', vertical: 'center' }
                    };
                } else {
                    // Alternance de couleurs
                    const isEvenRow = R % 2 === 0;
                    ws[cell_address].s.fill = { 
                        fgColor: { rgb: isEvenRow ? 'FFFFFF' : this.companyColors.light.substr(2) } 
                    };
                    
                    // Coloration conformité (dernière colonne)
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
        localStorage.removeItem('controles_historique');
        Utils.showNotification('Historique effacé', 'info');
    }

    getControlsCount() {
        return this.controles.length;
    }

    // NOUVELLE MÉTHODE : Export de sauvegarde JSON pour backup
    exportBackupJSON() {
        const backupData = {
            version: "1.0",
            exportDate: new Date().toISOString(),
            totalControles: this.controles.length,
            controles: this.controles.map(c => ({
                ...c,
                date: c.date.toISOString() // Sérialiser les dates
            }))
        };

        try {
            const dataStr = JSON.stringify(backupData, null, 2);
            const blob = new Blob([dataStr], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            
            const a = document.createElement('a');
            a.href = url;
            a.download = `Backup_Historique_${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            Utils.showNotification('Sauvegarde JSON créée avec succès', 'success');
            return true;
            
        } catch (error) {
            console.error('Erreur export JSON:', error);
            Utils.showNotification('Erreur lors de la création de la sauvegarde JSON', 'error');
            return false;
        }
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
                
                // Confirmation avant import
                const confirmed = confirm(
                    `Importer ${backupData.controles.length} contrôle(s) ?\n` +
                    `Date de sauvegarde: ${new Date(backupData.exportDate).toLocaleDateString('fr-FR')}\n\n` +
                    `Attention: Cela remplacera complètement l'historique actuel (${this.controles.length} contrôle(s))`
                );
                
                if (!confirmed) {
                    Utils.showNotification('Import annulé', 'info');
                    return;
                }
                
                // Restaurer les dates
                this.controles = backupData.controles.map(c => ({
                    ...c,
                    date: new Date(c.date)
                }));
                
                this.saveToStorage();
                
                Utils.showNotification(
                    `Historique importé avec succès: ${this.controles.length} contrôle(s)`, 
                    'success'
                );
                
                // Rafraîchir l'interface historique si visible
                if (window.historyInterface && window.historyInterface.isHistorySectionActive()) {
                    window.historyInterface.refresh();
                }
                
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
