// persistenceManager.js - Version enrichie avec export Excel détaillé

import { Utils } from './utils.js';

export class PersistenceManager {
    constructor() {
        this.controles = [];
        this.suspendedControls = [];
        this.controlledDossiers = new Map();
        this.lastSaveTime = 0;
        this.companyColors = {
            primary: '1A1A2E',      // Bleu foncé
            secondary: 'D4AF37',    // Or
            success: '28A745',      // Vert
            warning: 'FFC107',      // Jaune
            danger: 'DC3545',       // Rouge
            light: 'F8F9FA',        // Gris clair
            info: '17A2B8'          // Bleu info
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
            
            // Protection contre les doublons
            if (now - this.lastSaveTime < 1000) {
                Utils.debugLog('Doublon détecté - sauvegarde ignorée');
                return null;
            }
            this.lastSaveTime = now;
            
            // Validation des données essentielles
            if (!controlData || !controlData.dossier) {
                Utils.debugLog('Données de contrôle invalides - dossier manquant');
                return null;
            }

            if (!controlData.control || !controlData.control.definition) {
                Utils.debugLog('Données de contrôle invalides - définition de contrôle manquante');
                return null;
            }

            // Calcul des statistiques de documents
            const documentsStats = this.calculateDocumentsStatistics(controlData);
            
            // Calcul des détails de vérification
            const verificationDetails = this.extractVerificationDetails(controlData);
            
            // Calcul de la conformité globale
            const conformityAncalculateDocumentsStatisticsalysis = this.analyzeGlobalConformity(controlData, verificationDetails);
            
            // Construction de l'objet contrôle enrichi
            const controle = {
                // Identifiants et métadonnées
                id: now, // Utiliser timestamp comme ID unique
                date: new Date(),
                dateTimestamp: now,
                
                // Informations du contrôle
                type: controlData.control.definition.name || 'Type inconnu',
                typeId: controlData.control.definition.id || null,
                
                // Informations du dossier
                client: controlData.dossier.client || 'Client inconnu',
                codeDossier: controlData.dossier.codeDossier || '',
                reference: controlData.dossier.reference || '',
                conseiller: controlData.dossier.conseiller || '',
                montant: controlData.dossier.montant || '',
                domaine: controlData.dossier.domaine || '',
                nouveauClient: controlData.dossier.nouveauClient || '',
                
                // Statut et résultats
                statut: 'Terminé',
                
                // Statistiques des documents
                totalDocuments: documentsStats.totalDocuments,
                documentsVerifies: documentsStats.documentsVerifies,
                documentsPresents: documentsStats.documentsPresents,
                documentsConformes: documentsStats.documentsConformes,
                documentsControles: `${documentsStats.documentsVerifies}/${documentsStats.totalDocuments}`,
                
                // Statistiques des questions
                totalQuestions: documentsStats.totalQuestions,
                questionsRepondues: documentsStats.questionsRepondues,
                questionsConformes: documentsStats.questionsConformes,
                questionsNonConformes: documentsStats.questionsNonConformes,
                
                // Anomalies et conformité
                anomaliesMajeures: conformityAnalysis.obligatoryIssuesCount,
                anomaliesMineurs: conformityAnalysis.optionalIssuesCount,
                totalAnomalies: conformityAnalysis.totalIssuesCount,
                conformiteGlobale: conformityAnalysis.globalConformity,
                tauxConformite: conformityAnalysis.conformityRate,
                
                // Détails structurés
                details: verificationDetails,
                documentsStatus: documentsStats.documentsDetails,
                
                // Données brutes complètes pour exports avancés
                rawControlData: {
                    dossier: { ...controlData.dossier },
                    control: {
                        definition: { ...controlData.control.definition },
                        metadata: controlData.control.metadata || {}
                    },
                    documents: controlData.documents ? { ...controlData.documents } : {},
                    responses: controlData.responses ? this.deepCloneResponses(controlData.responses) : {},
                    obligatoryIssuesCount: controlData.obligatoryIssuesCount || 0,
                    completedAt: controlData.completedAt || new Date().toISOString(),
                    
                    // Métadonnées enrichies
                    statistics: {
                        ...documentsStats,
                        ...conformityAnalysis
                    },
                    
                    // Informations de contexte
                    controlContext: {
                        userAgent: navigator.userAgent,
                        timestamp: now,
                        version: '2.0' // Version de sauvegarde
                    }
                }
            };

            // Sauvegarde du contrôle
            this.controles.push(controle);
            this.saveToStorage();
            
            // Gestion du statut du dossier
            const dossierKey = this.generateDossierKey(controlData.dossier);
            this.markDossierAsControlled(dossierKey, controle.type);
            
            // Suppression du contrôle suspendu correspondant s'il existe
            this.removeSuspendedControl(dossierKey, controle.type);
            
            // Logging détaillé
            Utils.debugLog([
                `Contrôle sauvegardé avec succès:`,
                `- Client: ${controle.client}`,
                `- Type: ${controle.type}`,
                `- Documents: ${controle.documentsControles}`,
                `- Questions: ${controle.questionsRepondues}/${controle.totalQuestions}`,
                `- Conformité: ${controle.conformiteGlobale} (${controle.tauxConformite}%)`,
                `- Anomalies: ${controle.totalAnomalies} (${controle.anomaliesMajeures} majeures)`
            ].join('\n'));
            
            return controle;

        } catch (error) {
            Utils.debugLog('Erreur lors de la sauvegarde du contrôle: ' + error.message);
            console.error('Erreur sauvegarde détaillée:', error);
            console.error('Données reçues:', controlData);
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

   // NOUVELLE MÉTHODE : Calculer les statistiques complètes des documents
    calculateDocumentsStatistics(controlData) {
        const stats = {
            totalDocuments: 0,
            documentsVerifies: 0,
            documentsPresents: 0,
            documentsConformes: 0,
            totalQuestions: 0,
            questionsRepondues: 0,
            questionsConformes: 0,
            questionsNonConformes: 0,
            documentsDetails: {}
        };

        // Vérifier que nous avons des documents définis
        if (!controlData.control?.definition?.documents) {
            Utils.debugLog('Aucun document défini dans le contrôle');
            return stats;
        }

        // Parcourir tous les documents définis dans le contrôle
        controlData.control.definition.documents.forEach(docDefinition => {
            const docId = docDefinition.id;
            const docName = this.getDocumentName(docId);
            
            stats.totalDocuments++;
            
            // Récupérer les réponses pour ce document
            const documentResponses = controlData.responses?.[docId] || {};
            const responsesList = Object.values(documentResponses);
            
            // Calculer les statistiques pour ce document
            const docStats = this.analyzeDocumentResponses(docName, responsesList, docDefinition);
            
            // Mettre à jour les statistiques globales
            if (responsesList.length > 0) {
                stats.documentsVerifies++;
            }
            
            if (docStats.isPresent) {
                stats.documentsPresents++;
            }
            
            if (docStats.globalStatus === 'CONFORME') {
                stats.documentsConformes++;
            }
            
            stats.totalQuestions += docStats.totalQuestions;
            stats.questionsRepondues += docStats.questionsRepondues;
            stats.questionsConformes += docStats.questionsConformes;
            stats.questionsNonConformes += docStats.questionsNonConformes;
            
            // Stocker les détails du document
            stats.documentsDetails[docId] = docStats;
        });

        return stats;
    }

    // NOUVELLE MÉTHODE : Analyser les réponses d'un document spécifique
    analyzeDocumentResponses(documentName, responsesList, documentDefinition) {
        const docStats = {
            id: documentDefinition.id,
            name: documentName,
            fullName: documentDefinition.name || documentName,
            required: documentDefinition.required || false,
            
            // Statistiques des questions
            totalQuestions: responsesList.length,
            questionsRepondues: responsesList.filter(r => r.answer !== undefined && r.answer !== '').length,
            questionsConformes: responsesList.filter(r => r.conforme === true).length,
            questionsNonConformes: responsesList.filter(r => r.conforme === false).length,
            
            // Répartition des réponses
            reponseOui: responsesList.filter(r => r.answer === 'Oui').length,
            reponseNon: responsesList.filter(r => r.answer === 'Non').length,
            reponsePartiel: responsesList.filter(r => r.answer === 'Partiel').length,
            
            // Anomalies
            anomaliesObligatoires: responsesList.filter(r => 
                r.conforme === false && r.obligation === 'Obligatoire'
            ).length,
            anomaliesOptionnelles: responsesList.filter(r => 
                r.conforme === false && r.obligation !== 'Obligatoire'
            ).length,
            
            // Présence et statut
            isPresent: false,
            globalStatus: 'NON VÉRIFIÉ',
            conformityRate: 0,
            
            // Détails des réponses
            responses: responsesList.map(response => ({
                question: response.question || '',
                answer: response.answer || '',
                quality: response.quality || '',
                conforme: response.conforme || false,
                obligation: response.obligation || '',
                justification: response.justification || ''
            }))
        };
        
        // Calculer la présence du document
        if (docStats.totalQuestions > 0) {
            // Un document est présent s'il y a au moins une réponse "Oui" 
            // ET aucune réponse "Non" obligatoire
            const hasPositiveResponse = docStats.reponseOui > 0;
            const hasObligatoryNo = responsesList.some(r => 
                r.answer === 'Non' && r.obligation === 'Obligatoire'
            );
            
            docStats.isPresent = hasPositiveResponse && !hasObligatoryNo;
        }
        
        // Calculer le statut global
        if (docStats.totalQuestions === 0) {
            docStats.globalStatus = 'NON VÉRIFIÉ';
        } else if (docStats.anomaliesObligatoires > 0) {
            docStats.globalStatus = 'NON CONFORME';
        } else if (docStats.anomaliesOptionnelles > 0) {
            docStats.globalStatus = 'AVEC RÉSERVES';
        } else if (docStats.questionsConformes === docStats.totalQuestions) {
            docStats.globalStatus = 'CONFORME';
        } else {
            docStats.globalStatus = 'PARTIEL';
        }
        
        // Calculer le taux de conformité
        if (docStats.totalQuestions > 0) {
            docStats.conformityRate = Math.round((docStats.questionsConformes / docStats.totalQuestions) * 100);
        }
        
        return docStats;
    }

    // NOUVELLE MÉTHODE : Extraire les détails de vérification pour l'affichage
    extractVerificationDetails(controlData) {
        const details = [];
        
        if (!controlData.responses) {
            Utils.debugLog('Aucune réponse trouvée dans les données de contrôle');
            return details;
        }

        // Parcourir tous les documents avec des réponses
        Object.entries(controlData.responses).forEach(([docId, documentResponses]) => {
            const docName = this.getDocumentName(docId);
            
            // Parcourir toutes les réponses de ce document
            Object.values(documentResponses).forEach(response => {
                details.push({
                    document: docName,
                    documentId: docId,
                    question: response.question || 'Question non définie',
                    reponse: response.answer || 'Non répondu',
                    qualite: response.quality || '',
                    conforme: Boolean(response.conforme),
                    obligatoire: response.obligation === 'Obligatoire',
                    obligation: response.obligation || '',
                    justification: response.justification || '',
                    
                    // Métadonnées supplémentaires
                    questionId: response.questionId || null,
                    responseTimestamp: response.timestamp || null
                });
            });
        });
        
        // Trier les détails par document puis par question
        details.sort((a, b) => {
            if (a.document !== b.document) {
                return a.document.localeCompare(b.document);
            }
            return a.question.localeCompare(b.question);
        });
        
        Utils.debugLog(`${details.length} détails de vérification extraits`);
        return details;
    }

    // NOUVELLE MÉTHODE : Analyser la conformité globale
    analyzeGlobalConformity(controlData, verificationDetails) {
        const analysis = {
            obligatoryIssuesCount: 0,
            optionalIssuesCount: 0,
            totalIssuesCount: 0,
            totalVerifications: verificationDetails.length,
            conformeVerifications: 0,
            globalConformity: 'CONFORME',
            conformityRate: 0
        };
        
        // Analyser chaque détail
        verificationDetails.forEach(detail => {
            if (detail.conforme) {
                analysis.conformeVerifications++;
            } else {
                analysis.totalIssuesCount++;
                if (detail.obligatoire) {
                    analysis.obligatoryIssuesCount++;
                } else {
                    analysis.optionalIssuesCount++;
                }
            }
        });
        
        // Déterminer la conformité globale
        if (analysis.obligatoryIssuesCount > 0) {
            analysis.globalConformity = 'NON CONFORME';
        } else if (analysis.optionalIssuesCount > 0) {
            analysis.globalConformity = 'AVEC RÉSERVES';
        } else {
            analysis.globalConformity = 'CONFORME';
        }
        
        // Calculer le taux de conformité
        if (analysis.totalVerifications > 0) {
            analysis.conformityRate = Math.round((analysis.conformeVerifications / analysis.totalVerifications) * 100);
        }
        
        // Utiliser aussi les données du contrôle si disponibles
        if (controlData.obligatoryIssuesCount !== undefined) {
            analysis.obligatoryIssuesCount = Math.max(analysis.obligatoryIssuesCount, controlData.obligatoryIssuesCount);
        }
        
        Utils.debugLog([
            `Analyse de conformité:`,
            `- Vérifications: ${analysis.totalVerifications}`,
            `- Conformes: ${analysis.conformeVerifications}`,
            `- Anomalies obligatoires: ${analysis.obligatoryIssuesCount}`,
            `- Anomalies optionnelles: ${analysis.optionalIssuesCount}`,
            `- Conformité globale: ${analysis.globalConformity}`,
            `- Taux: ${analysis.conformityRate}%`
        ].join('\n'));
        
        return analysis;
    }

    // NOUVELLE MÉTHODE : Clonage profond des réponses pour éviter les références
    deepCloneResponses(responses) {
        try {
            return JSON.parse(JSON.stringify(responses));
        } catch (error) {
            Utils.debugLog('Erreur lors du clonage des réponses: ' + error.message);
            return {};
        }
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
                const cellAddress = XLSX.utils.encode_cell({ c: C, r: R });
                
                // Valeur de la cellule pour la logique conditionnelle
                const cellValue = ws[cellAddress]?.v;
                
                // Style par défaut
                let styleOptions = {
                    fontSize: 10,
                    alignment: { vertical: 'center', wrapText: true }
                };

                // Titre principal (ligne 0)
                if (R === 0) {
                    styleOptions = {
                        fillColor: this.companyColors.primary,
                        fontColor: 'FFFFFF',
                        bold: true,
                        fontSize: 16,
                        alignment: { horizontal: 'center', vertical: 'center' }
                    };
                }
                // Titres de sections
                else if (cellValue && typeof cellValue === 'string' && 
                        (cellValue.includes('INFORMATIONS') || 
                         cellValue.includes('RÉSULTATS') || 
                         cellValue.includes('STATISTIQUES'))) {
                    styleOptions = {
                        fillColor: this.companyColors.secondary,
                        fontColor: 'FFFFFF',
                        bold: true,
                        fontSize: 12
                    };
                }
                // Conformité globale
                else if (cellValue === 'CONFORME') {
                    styleOptions = {
                        fillColor: this.companyColors.success,
                        fontColor: 'FFFFFF',
                        bold: true
                    };
                }
                else if (cellValue === 'NON CONFORME') {
                    styleOptions = {
                        fillColor: this.companyColors.danger,
                        fontColor: 'FFFFFF',
                        bold: true
                    };
                }
                
                this.applyCellStyle(ws, cellAddress, styleOptions);
            }
        }

        // Fusionner les cellules du titre
        if (!ws['!merges']) ws['!merges'] = [];
        ws['!merges'].push({ s: { c: 0, r: 0 }, e: { c: 3, r: 0 } });
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
                const cellAddress = XLSX.utils.encode_cell({ c: C, r: R });
                const cellValue = ws[cellAddress]?.v;
                
                let styleOptions = {
                    fontSize: 10,
                    alignment: { vertical: 'top', wrapText: true }
                };

                // Titre principal
                if (R === 0) {
                    styleOptions = {
                        fillColor: this.companyColors.primary,
                        fontColor: 'FFFFFF',
                        bold: true,
                        fontSize: 16,
                        alignment: { horizontal: 'center', vertical: 'center' }
                    };
                }
                // En-têtes de colonnes
                else if (R === 2) {
                    styleOptions = {
                        fillColor: this.companyColors.secondary,
                        fontColor: 'FFFFFF',
                        bold: true,
                        fontSize: 11,
                        alignment: { horizontal: 'center', vertical: 'center' }
                    };
                }
                // Données
                else if (R > 2) {
                    // Colonne Conformité
                    if (C === 4) {
                        if (cellValue === 'CONFORME') {
                            styleOptions.fillColor = this.companyColors.success;
                            styleOptions.fontColor = 'FFFFFF';
                            styleOptions.bold = true;
                        } else if (cellValue === 'NON CONFORME') {
                            styleOptions.fillColor = this.companyColors.danger;
                            styleOptions.fontColor = 'FFFFFF';
                            styleOptions.bold = true;
                        }
                    }
                    // Colonne Réponse
                    else if (C === 2) {
                        if (cellValue === 'Oui') {
                            styleOptions.fontColor = this.companyColors.success;
                            styleOptions.bold = true;
                        } else if (cellValue === 'Non') {
                            styleOptions.fontColor = this.companyColors.danger;
                            styleOptions.bold = true;
                        }
                    }
                }
                
                this.applyCellStyle(ws, cellAddress, styleOptions);
            }
        }

        // Fusionner le titre
        if (!ws['!merges']) ws['!merges'] = [];
        ws['!merges'].push({ s: { c: 0, r: 0 }, e: { c: 5, r: 0 } });
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
                const cellAddress = XLSX.utils.encode_cell({ c: C, r: R });
                const cellValue = ws[cellAddress]?.v;
                
                let styleOptions = {
                    fontSize: 10,
                    alignment: { vertical: 'top', wrapText: true }
                };

                // Titre
                if (R === 0) {
                    styleOptions = {
                        fillColor: this.companyColors.danger,
                        fontColor: 'FFFFFF',
                        bold: true,
                        fontSize: 16,
                        alignment: { horizontal: 'center', vertical: 'center' }
                    };
                }
                // En-têtes
                else if (R === 2) {
                    styleOptions = {
                        fillColor: this.companyColors.warning,
                        fontColor: 'FFFFFF',
                        bold: true,
                        fontSize: 11,
                        alignment: { horizontal: 'center', vertical: 'center' }
                    };
                }
                // Colonne obligatoire
                else if (R > 2 && C === 3) {
                    if (cellValue === 'OUI') {
                        styleOptions.fillColor = this.companyColors.danger;
                        styleOptions.fontColor = 'FFFFFF';
                        styleOptions.bold = true;
                    }
                }
                
                this.applyCellStyle(ws, cellAddress, styleOptions);
            }
        }

        if (!ws['!merges']) ws['!merges'] = [];
        ws['!merges'].push({ s: { c: 0, r: 0 }, e: { c: 4, r: 0 } });
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

    // Extraire les détails du contrôle
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
                    conforme: response.conforme, // ✅ Utiliser la valeur déjà calculée
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
            fileName = `Historique_Controles_${new Date().toISOString().split('T')[0]}.xlsx`;
        }

        if (this.controles.length === 0) {
            Utils.showNotification('Aucun contrôle à exporter', 'warning');
            return false;
        }

        try {
            const wb = XLSX.utils.book_new();
            
            // 1. Onglet Vue d'ensemble (inchangé)
            this.createOverviewSheet(wb);
            
            // 2. NOUVEAU : Créer les onglets dynamiques par type de contrôle
            this.createControlTypeSheets(wb);
            
            // 3. Onglet Statistiques (gardé)
            this.createStatsSheet(wb);
            
            XLSX.writeFile(wb, fileName);
            
            Utils.showNotification(`Export généré: ${fileName}`, 'success');
            return true;

        } catch (error) {
            console.error('Erreur export Excel:', error);
            Utils.showNotification('Erreur lors de l\'export: ' + error.message, 'error');
            return false;
        }
    }

    // NOUVELLE MÉTHODE : Diagnostiquer les données d'export
    diagnoseExportData(controlType = null) {
        Utils.debugLog('=== DIAGNOSTIC DONNÉES EXPORT ===');
        
        let controles = this.controles;
        if (controlType) {
            controles = this.controles.filter(c => c.type === controlType);
            Utils.debugLog(`Analysant ${controles.length} contrôles de type ${controlType}`);
        } else {
            Utils.debugLog(`Analysant ${controles.length} contrôles au total`);
        }
        
        controles.forEach(controle => {
            Utils.debugLog(`\n--- ${controle.client} (${controle.type}) ---`);
            
            if (!controle.rawControlData?.responses) {
                Utils.debugLog('❌ Pas de rawControlData.responses');
                return;
            }
            
            Object.entries(controle.rawControlData.responses).forEach(([docId, responses]) => {
                const docName = this.getDocumentName(parseInt(docId));
                const responseCount = Object.keys(responses).length;
                Utils.debugLog(`📄 ${docName}: ${responseCount} questions`);
                
                Object.values(responses).forEach(response => {
                    const status = response.conforme ? '✅' : '❌';
                    Utils.debugLog(`  ${status} ${response.question}: ${response.answer}`);
                    if (response.justification) {
                        Utils.debugLog(`    💬 ${response.justification}`);
                    }
                });
            });
        });
        
        return {
            totalControles: controles.length,
            typesAnalyses: [...new Set(controles.map(c => c.type))],
            totalQuestions: controles.reduce((sum, c) => {
                if (!c.rawControlData?.responses) return sum;
                return sum + Object.values(c.rawControlData.responses)
                    .reduce((docSum, responses) => docSum + Object.keys(responses).length, 0);
            }, 0)
        };
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

    // NOUVELLE MÉTHODE : Créer les onglets par type de contrôle
    createControlTypeSheets(wb) {
        // Grouper les contrôles par type
        const controlesByType = {};
        this.controles.forEach(controle => {
            if (!controlesByType[controle.type]) {
                controlesByType[controle.type] = [];
            }
            controlesByType[controle.type].push(controle);
        });

        // Créer un onglet pour chaque type
        Object.entries(controlesByType).forEach(([type, controles]) => {
            this.createControlTypeSheet(wb, type, controles);
        });
    }

    // NOUVELLE MÉTHODE : Créer un onglet pour un type de contrôle spécifique
    createControlTypeSheet(wb, controlType, controles) {
        // Définir toutes les colonnes de base
        const baseColumns = [
            'Date', 'Client', 'Code Dossier', 'Conseiller', 'Montant', 
            'Domaine', 'Nouveau Client', 'Conformité Globale', 'Anomalies Majeures'
        ];

        // Définir les colonnes pour chaque document
        const documentColumns = [
            { id: 1, name: 'FR', fullName: 'Fiche de Renseignements' },
            { id: 2, name: 'Profil Risques', fullName: 'Profil de Risques' },
            { id: 3, name: 'Profil ESG', fullName: 'Profil ESG' },
            { id: 4, name: 'Harvest', fullName: 'Harvest' },
            { id: 5, name: 'FIL', fullName: 'FIL' },
            { id: 6, name: 'LM Entrée', fullName: 'LM Entrée en Relation' },
            { id: 7, name: 'CNI', fullName: 'Carte Nationale d\'Identité' },
            { id: 8, name: 'Justif Domicile', fullName: 'Justificatif de Domicile' },
            { id: 9, name: 'Etude', fullName: 'Etude' },
            { id: 10, name: 'RIB', fullName: 'Relevé d\'Identité Bancaire' },
            { id: 11, name: 'Convention RTO', fullName: 'Convention RTO' },
            { id: 12, name: 'Origine Fonds', fullName: 'Origine des Fonds' },
            { id: 13, name: 'Carto Opération', fullName: 'Cartographie Opération' },
            { id: 14, name: 'Destination Fonds', fullName: 'Destination des Fonds' },
            { id: 99, name: 'Zeendoc', fullName: 'Zeendoc' }
        ];

        // Construire l'en-tête
        const headers = [...baseColumns];
        documentColumns.forEach(doc => {
            headers.push(`${doc.name} Présent`);
            headers.push(`${doc.name} Justification`);
        });

        // Construire les données
        const sheetData = [headers];
        
        controles.forEach(controle => {
            const row = [
                controle.date.toLocaleDateString('fr-FR'),
                controle.client,
                controle.codeDossier || 'N/A',
                controle.conseiller || 'N/A',
                controle.montant || 'N/A',
                controle.domaine || 'N/A',
                controle.nouveauClient || 'N/A',
                controle.conformiteGlobale,
                controle.anomaliesMajeures
            ];

            // Ajouter les informations de chaque document
            documentColumns.forEach(doc => {
                const docInfo = this.getDocumentInfoFromControl(controle, doc.id);
                row.push(docInfo.present ? 'Oui' : 'Non');
                row.push(docInfo.justification || '');
            });

            sheetData.push(row);
        });

        // Créer la feuille
        const ws = XLSX.utils.aoa_to_sheet(sheetData);
        
        // Formater la feuille
        this.formatControlTypeSheet(ws, sheetData.length, baseColumns.length, documentColumns.length);
        
        // Nom d'onglet sécurisé (Excel limite à 31 caractères)
        const sheetName = this.sanitizeSheetName(controlType);
        XLSX.utils.book_append_sheet(wb, ws, sheetName);
    }

    // NOUVELLE MÉTHODE : Extraire les informations d'un document depuis un contrôle
    getDocumentInfoFromControl(controle, documentId) {
        // Priorité 1 : Utiliser les statistiques enrichies si disponibles
        if (controle.documentsStatus && controle.documentsStatus[documentId]) {
            const docStatus = controle.documentsStatus[documentId];
            return {
                present: docStatus.isPresent,
                justification: this.buildJustificationFromDocStatus(docStatus),
                totalQuestions: docStatus.totalQuestions,
                conformeAnswers: docStatus.questionsConformes,
                nonConformeAnswers: docStatus.questionsNonConformes,
                status: docStatus.globalStatus,
                conformityRate: docStatus.conformityRate,
                anomalies: docStatus.anomaliesObligatoires + docStatus.anomaliesOptionnelles
            };
        }
        
        // Priorité 2 : Analyser les détails comme fallback
        if (controle.details && controle.details.length > 0) {
            const documentName = this.getDocumentName(documentId);
            const documentDetails = controle.details.filter(detail => 
                detail.document === documentName || detail.documentId == documentId
            );
            
            if (documentDetails.length > 0) {
                return this.analyzeDocumentDetailsLegacy(documentDetails);
            }
        }
        
        // Priorité 3 : Fallback complet
        return { 
            present: false, 
            justification: 'Données non disponibles pour ce document',
            totalQuestions: 0,
            conformeAnswers: 0,
            nonConformeAnswers: 0,
            status: 'NON VÉRIFIÉ',
            conformityRate: 0,
            anomalies: 0
        };
    }

    // NOUVELLE MÉTHODE : Créer les onglets par type de contrôle avec colonnes dynamiques
    createControlTypeSheets(wb) {
        // Grouper les contrôles par type
        const controlesByType = {};
        this.controles.forEach(controle => {
            if (!controlesByType[controle.type]) {
                controlesByType[controle.type] = [];
            }
            controlesByType[controle.type].push(controle);
        });

        // Créer un onglet pour chaque type
        Object.entries(controlesByType).forEach(([type, controles]) => {
            this.createDynamicControlTypeSheet(wb, type, controles);
        });
    }

    // NOUVELLE MÉTHODE : Créer un onglet avec colonnes complètement dynamiques
    createDynamicControlTypeSheet(wb, controlType, controles) {
        // 1. Analyser toutes les questions de tous les contrôles de ce type
        const allQuestions = this.analyzeAllQuestionsForType(controles);
        
        // 2. Construire l'en-tête dynamique
        const baseColumns = [
            'Date', 'Client', 'Code Dossier', 'Conseiller', 'Montant', 
            'Domaine', 'Nouveau Client', 'Conformité Globale', 'Anomalies Majeures'
        ];
        
        const questionColumns = allQuestions.map(q => q.columnName);
        const headers = [...baseColumns, ...questionColumns];
        
        // 3. Construire les données
        const sheetData = [headers];
        
        controles.forEach(controle => {
            const row = [
                controle.date.toLocaleDateString('fr-FR'),
                controle.client,
                controle.codeDossier || 'N/A',
                controle.conseiller || 'N/A',
                controle.montant || 'N/A',
                controle.domaine || 'N/A',
                controle.nouveauClient || 'N/A',
                controle.conformiteGlobale,
                controle.anomaliesMajeures
            ];

            // Ajouter les réponses pour chaque question identifiée
            allQuestions.forEach(questionInfo => {
                const cellValue = this.getQuestionResponseForExport(controle, questionInfo);
                row.push(cellValue);
            });

            sheetData.push(row);
        });

        // 4. Créer la feuille
        const ws = XLSX.utils.aoa_to_sheet(sheetData);
        
        // 5. Formater la feuille
        this.formatDynamicControlTypeSheet(ws, sheetData.length, baseColumns.length, questionColumns.length, allQuestions);
        
        // 6. Nom d'onglet sécurisé
        const sheetName = this.sanitizeSheetName(controlType);
        XLSX.utils.book_append_sheet(wb, ws, sheetName);
        
        Utils.debugLog(`Onglet ${controlType} créé avec ${questionColumns.length} colonnes de questions`);
    }

    // NOUVELLE MÉTHODE : Analyser toutes les questions de tous les contrôles d'un type
    analyzeAllQuestionsForType(controles) {
        const questionsMap = new Map();
        
        controles.forEach(controle => {
            // Vérifier les données brutes
            if (!controle.rawControlData?.responses) {
                Utils.debugLog(`Pas de rawControlData.responses pour ${controle.client}`);
                return;
            }
            
            // Parcourir tous les documents et leurs réponses
            Object.entries(controle.rawControlData.responses).forEach(([docId, documentResponses]) => {
                const docName = this.getDocumentName(parseInt(docId));
                
                Object.values(documentResponses).forEach(response => {
                    if (!response.question) return;
                    
                    // Créer une clé unique pour la question
                    const questionKey = `${docId}_${response.question}`;
                    
                    if (!questionsMap.has(questionKey)) {
                        questionsMap.set(questionKey, {
                            docId: parseInt(docId),
                            docName: docName,
                            questionText: response.question,
                            columnName: this.generateColumnName(docName, response.question),
                            frequency: 0,
                            samples: []
                        });
                    }
                    
                    // Incrémenter la fréquence et ajouter un échantillon
                    const questionInfo = questionsMap.get(questionKey);
                    questionInfo.frequency++;
                    questionInfo.samples.push({
                        answer: response.answer,
                        conforme: response.conforme,
                        justification: response.justification
                    });
                });
            });
        });
        
        // Convertir en array et trier par document puis par fréquence
        return Array.from(questionsMap.values())
            .sort((a, b) => {
                if (a.docId !== b.docId) {
                    return a.docId - b.docId; // Trier par ordre de document
                }
                return b.frequency - a.frequency; // Puis par fréquence décroissante
            });
    }

    // NOUVELLE MÉTHODE : Générer un nom de colonne lisible
    generateColumnName(docName, questionText) {
        // Règles de transformation pour des noms de colonnes courts et clairs
        let shortName = questionText;
        
        // Supprimer les formulations courantes
        shortName = shortName.replace(/^Est-ce que /i, '');
        shortName = shortName.replace(/^Est-ce /i, '');
        shortName = shortName.replace(/^Le /i, '');
        shortName = shortName.replace(/^La /i, '');
        shortName = shortName.replace(/^Les /i, '');
        shortName = shortName.replace(/ \?$/i, '');
        shortName = shortName.replace(/^Quel(le)? est /i, '');
        shortName = shortName.replace(/^Comment /i, '');
        shortName = shortName.replace(/^Quels? /i, '');
        
        // Remplacements spécifiques
        const replacements = {
            'le document est présent': 'Présent',
            'document est présent': 'Présent',
            'tous les documents sont-ils bien ajoutés dans Zeendoc': 'Zeendoc Complet',
            'la signature du conseiller est-elle présente': 'Signature Conseiller',
            'la signature de tous les clients est-elle présente': 'Signature Clients',
            'le type de document': 'Type',
            'la bonne version': 'Version',
            'le document est entièrement complété': 'Complété',
            'les mentions sont-elles présentes sur le document': 'Mentions',
            'la date est-elle présente sur le document': 'Date',
            'date est-elle présente': 'Date',
            'document est-il valide': 'Valide',
            'Date de moins de 3 mois': 'Date < 3 mois',
            'Datant de - de 24 mois': 'Date < 24 mois',
            'le RIB correspond t-il bien au client': 'Correspond Client',
            'cartographie client a-t-elle été réalisée': 'Carto Réalisée',
            'cartographie de l\'opération a-t-elle été réalisée': 'Carto Opé Réalisée'
        };
        
        const lowerShortName = shortName.toLowerCase();
        for (const [pattern, replacement] of Object.entries(replacements)) {
            if (lowerShortName.includes(pattern.toLowerCase())) {
                shortName = replacement;
                break;
            }
        }
        
        // Si pas de remplacement trouvé, essayer de raccourcir intelligemment
        if (shortName.length > 40) {
            // Garder les premiers mots importants
            const words = shortName.split(' ');
            if (words.length > 6) {
                shortName = words.slice(0, 6).join(' ') + '...';
            }
        }
        
        // Préfixer avec le nom du document
        return `${docName} ${shortName}`;
    }

    // NOUVELLE MÉTHODE : Obtenir la réponse d'une question pour l'export
    getQuestionResponseForExport(controle, questionInfo) {
        if (!controle.rawControlData?.responses) {
            return 'N/A';
        }
        
        const docResponses = controle.rawControlData.responses[questionInfo.docId];
        if (!docResponses) {
            return 'N/A';
        }
        
        // Chercher la réponse correspondante
        const response = Object.values(docResponses).find(r => 
            r.question === questionInfo.questionText
        );
        
        if (!response) {
            return 'N/C'; // Pas applicable
        }
        
        // Construire la valeur de cellule selon le type de réponse
        return this.formatCellValue(response);
    }

    // NOUVELLE MÉTHODE : Formater la valeur d'une cellule selon la réponse
    formatCellValue(response) {
        let cellValue = response.answer || 'N/A';
        
        // Gestion spéciale pour les checklists
        if (response.missingElements && Array.isArray(response.missingElements)) {
            if (response.missingElements.length === 0) {
                return 'Aucun manquant';
            } else {
                return `${response.missingElements.length} manquants: ${response.missingElements.join(', ')}`;
            }
        }
        
        // Gestion des réponses non conformes
        if (response.conforme === false || response.quality === 'Non conforme') {
            if (response.justification && response.justification.trim()) {
                cellValue += ` - ${response.justification}`;
            }
        }
        
        // Gestion des réponses partiellement conformes
        if (response.quality === 'Partiellement conforme') {
            if (response.justification && response.justification.trim()) {
                cellValue += ` (Partiel - ${response.justification})`;
            } else {
                cellValue += ' (Partiel)';
            }
        }
        
        // Gestion des détails de qualité pour les signatures
        if (response.qualityDetails) {
            if (response.qualityDetails.signatureType) {
                cellValue += ` (${response.qualityDetails.signatureType})`;
            }
            if (response.qualityDetails.cifStatus) {
                cellValue += ` (${response.qualityDetails.cifStatus})`;
            }
        }
        
        return cellValue;
    }

    // NOUVELLE MÉTHODE : Formater un onglet de type de contrôle dynamique
    formatDynamicControlTypeSheet(ws, rowCount, baseColumnsCount, questionColumnsCount, allQuestions) {
        if (!ws['!ref']) return;
        
        const range = XLSX.utils.decode_range(ws['!ref']);
        
        // Largeurs de colonnes
        const colWidths = [];
        
        // Colonnes de base
        for (let i = 0; i < baseColumnsCount; i++) {
            colWidths.push({ width: i === 1 ? 25 : 15 }); // Client plus large
        }
        
        // Colonnes questions (largeur selon le contenu)
        allQuestions.forEach(questionInfo => {
            const columnWidth = Math.min(Math.max(questionInfo.columnName.length * 0.8, 12), 30);
            colWidths.push({ width: columnWidth });
        });
        
        ws['!cols'] = colWidths;

        // Créer les styles avec patternFill (méthode alternative pour Excel)
        const createCellStyle = (fillColor, fontColor = '000000', bold = false) => ({
            alignment: { vertical: 'center', wrapText: true },
            font: { 
                name: 'Calibri', 
                sz: 10, 
                bold: bold,
                color: { rgb: fontColor }
            },
            fill: { 
                fgColor: { rgb: fillColor },
                patternType: 'solid' // Ajout explicite du pattern
            },
            border: {
                top: { style: 'thin', color: { rgb: '000000' } },
                bottom: { style: 'thin', color: { rgb: '000000' } },
                left: { style: 'thin', color: { rgb: '000000' } },
                right: { style: 'thin', color: { rgb: '000000' } }
            }
        });

        // Formatage des cellules
        for (let R = range.s.r; R <= range.e.r; ++R) {
            for (let C = range.s.c; C <= range.e.c; ++C) {
                const cell_address = XLSX.utils.encode_cell({ c: C, r: R });
                if (!ws[cell_address]) continue;

                // En-têtes
                if (R === 0) {
                    let headerColor = this.companyColors.primary.substring(2);
                    
                    // Couleur différente pour les colonnes de questions selon le document
                    if (C >= baseColumnsCount) {
                        const questionIndex = C - baseColumnsCount;
                        const questionInfo = allQuestions[questionIndex];
                        headerColor = this.getDocumentColor(questionInfo.docId).substring(2);
                    }
                    
                    ws[cell_address].s = createCellStyle(headerColor, 'FFFFFF', true);
                    ws[cell_address].s.alignment = { horizontal: 'center', vertical: 'center', wrapText: true };
                    
                } else {
                    // Couleur de base (alternance)
                    const isEvenRow = R % 2 === 0;
                    let bgColor = isEvenRow ? 'FFFFFF' : this.companyColors.light.substring(2);
                    let fontColor = '000000';
                    let isBold = false;

                    // Coloration spéciale pour certaines colonnes
                    if (C < baseColumnsCount) {
                        // Colonnes de base - conformité globale
                        if (C === baseColumnsCount - 2) { // Conformité globale
                            if (ws[cell_address].v === 'CONFORME') {
                                bgColor = this.companyColors.success.substring(2);
                                fontColor = 'FFFFFF';
                                isBold = true;
                            } else if (ws[cell_address].v === 'NON CONFORME') {
                                bgColor = this.companyColors.danger.substring(2);
                                fontColor = 'FFFFFF';
                                isBold = true;
                            }
                        }
                    } else {
                        // Colonnes de questions - coloration selon le contenu
                        const cellValue = ws[cell_address].v;
                        if (cellValue) {
                            const cellStr = cellValue.toString().toLowerCase();
                            
                            // Vert pour les réponses positives
                            if (cellStr === 'oui' || cellStr === 'conforme' || cellStr === 'aucun manquant') {
                                bgColor = this.companyColors.success.substring(2);
                                fontColor = 'FFFFFF';
                                isBold = true;
                            }
                            // Rouge pour les non-conformités
                            else if (cellStr.includes('non -') || cellStr === 'non' || cellStr.includes('manquants:')) {
                                bgColor = this.companyColors.danger.substring(2);
                                fontColor = 'FFFFFF';
                                isBold = true;
                            }
                            // Orange pour les partiels
                            else if (cellStr.includes('partiel')) {
                                bgColor = this.companyColors.warning.substring(2);
                                fontColor = '000000';
                                isBold = true;
                            }
                            // Gris pour N/A, N/C, Absent
                            else if (cellStr === 'n/a' || cellStr === 'n/c' || cellStr === 'absent') {
                                bgColor = 'E9ECEF';
                                fontColor = '6C757D';
                                isBold = false;
                            }
                        }
                    }
                    
                    ws[cell_address].s = createCellStyle(bgColor, fontColor, isBold);
                }
            }
        }

        // Filtres automatiques
        ws['!autofilter'] = { ref: `A1:${XLSX.utils.encode_col(range.e.c)}1` };
    }

     createCellStyle(options = {}) {
        const {
            fillColor = null,
            fontColor = '000000',
            bold = false,
            fontSize = 10,
            alignment = { vertical: 'center', wrapText: true }
        } = options;

        const style = {
            alignment: alignment,
            font: { 
                name: 'Calibri', 
                sz: fontSize, 
                bold: bold,
                color: { rgb: fontColor }
            },
            border: {
                top: { style: 'thin', color: { rgb: '000000' } },
                bottom: { style: 'thin', color: { rgb: '000000' } },
                left: { style: 'thin', color: { rgb: '000000' } },
                right: { style: 'thin', color: { rgb: '000000' } }
            }
        };

        // Ajouter le remplissage seulement si spécifié
        if (fillColor) {
            style.fill = {
                patternType: 'solid',
                fgColor: { rgb: fillColor }
            };
        }

        return style;
    }

    applyCellStyle(ws, cellAddress, styleOptions) {
        // Créer la cellule si elle n'existe pas
        if (!ws[cellAddress]) {
            ws[cellAddress] = { v: '', t: 's' };
        }
        
        // Appliquer le style
        ws[cellAddress].s = this.createCellStyle(styleOptions);
    }

    // NOUVELLE MÉTHODE : Obtenir une couleur selon le document
    getDocumentColor(docId) {
        const documentColors = {
            1: '1A1A2E',    // FR - Bleu foncé
            2: '6F42C1',    // Profil Risques - Violet
            4: '20C997',    // Carto Client - Teal
            5: 'FD7E14',    // FIL - Orange
            6: '6610F2',    // LM - Indigo
            7: 'DC3545',    // CNI - Rouge
            8: '28A745',    // Justif - Vert
            9: '17A2B8',    // Etude - Cyan
            10: 'FFC107',   // RIB - Jaune
            11: '343A40',   // Convention RTO - Dark
            12: 'E83E8C',   // Origine fonds - Pink
            13: '6C757D',   // Carto Opé - Gris
            14: '495057',   // Destination - Gris foncé
            21: '007BFF',   // Harvest - Bleu
            99: 'ADB5BD'    // Zeendoc - Gris clair
        };
        
        return documentColors[docId] || this.companyColors.secondary.substring(2);
    }

    // NOUVELLE MÉTHODE : Construire une justification détaillée
    buildJustificationFromDocStatus(docStatus) {
        if (docStatus.totalQuestions === 0) {
            return 'Document non vérifié';
        }
        
        const parts = [];
        
        if (docStatus.anomaliesObligatoires > 0) {
            parts.push(`${docStatus.anomaliesObligatoires} anomalie(s) obligatoire(s)`);
        }
        
        if (docStatus.anomaliesOptionnelles > 0) {
            parts.push(`${docStatus.anomaliesOptionnelles} anomalie(s) optionnelle(s)`);
        }
        
        if (parts.length === 0) {
            return `Document conforme (${docStatus.questionsConformes}/${docStatus.totalQuestions} vérifications)`;
        }
        
        return parts.join(', ') + ` - Taux conformité: ${docStatus.conformityRate}%`;
    }

    // NOUVELLE MÉTHODE : Formater un onglet de type de contrôle
    formatControlTypeSheet(ws, rowCount, baseColumnsCount, documentColumnsCount) {
        if (!ws['!ref']) return;
        
        const range = XLSX.utils.decode_range(ws['!ref']);
        
        // Largeurs de colonnes
        const colWidths = [];
        
        // Colonnes de base
        for (let i = 0; i < baseColumnsCount; i++) {
            colWidths.push({ width: i === 1 ? 25 : 15 }); // Client plus large
        }
        
        // Colonnes documents (présent + justification)
        for (let i = 0; i < documentColumnsCount; i++) {
            colWidths.push({ width: 12 }); // Présent
            colWidths.push({ width: 30 }); // Justification
        }
        
        ws['!cols'] = colWidths;

        // Formatage des cellules
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

                // En-têtes
                if (R === 0) {
                    ws[cell_address].s = {
                        ...ws[cell_address].s,
                        font: { name: 'Calibri', sz: 11, bold: true, color: { rgb: 'FFFFFF' } },
                        fill: { fgColor: { rgb: this.companyColors.primary.substr(2) } },
                        alignment: { horizontal: 'center', vertical: 'center' }
                    };
                } else {
                    // Alternance de couleurs pour les lignes
                    const isEvenRow = R % 2 === 0;
                    ws[cell_address].s.fill = { 
                        fgColor: { rgb: isEvenRow ? 'FFFFFF' : this.companyColors.light.substr(2) } 
                    };

                    // Coloration spéciale pour certaines colonnes
                    if (C < baseColumnsCount) {
                        // Colonnes de base
                        if (C === baseColumnsCount - 2) { // Conformité globale
                            if (ws[cell_address].v === 'CONFORME') {
                                ws[cell_address].s.fill = { fgColor: { rgb: this.companyColors.success.substr(2) } };
                                ws[cell_address].s.font = { ...ws[cell_address].s.font, bold: true, color: { rgb: 'FFFFFF' } };
                            } else if (ws[cell_address].v === 'NON CONFORME') {
                                ws[cell_address].s.fill = { fgColor: { rgb: this.companyColors.danger.substr(2) } };
                                ws[cell_address].s.font = { ...ws[cell_address].s.font, bold: true, color: { rgb: 'FFFFFF' } };
                            }
                        }
                    } else {
                        // Colonnes documents
                        const docColumnIndex = (C - baseColumnsCount) % 2;
                        if (docColumnIndex === 0) { // Colonne "Présent"
                            if (ws[cell_address].v === 'Oui') {
                                ws[cell_address].s.font = { 
                                    ...ws[cell_address].s.font, 
                                    color: { rgb: this.companyColors.success.substr(2) }, 
                                    bold: true 
                                };
                            } else if (ws[cell_address].v === 'Non') {
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
        }

        // Filtres automatiques
        ws['!autofilter'] = { ref: `A1:${XLSX.utils.encode_col(range.e.c)}1` };
    }

    // NOUVELLE MÉTHODE : Nettoyer le nom d'onglet pour Excel
    sanitizeSheetName(name) {
        // Excel limite les noms d'onglets à 31 caractères et interdit certains caractères
        return name
            .replace(/[\\\/\?\*\[\]]/g, '') // Supprimer caractères interdits
            .substring(0, 31) // Limiter à 31 caractères
            .trim();
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

    // MÉTHODE LEGACY pour compatibilité descendante
    analyzeDocumentDetailsLegacy(documentDetails) {
        const totalQuestions = documentDetails.length;
        const conformeAnswers = documentDetails.filter(d => d.conforme).length;
        const nonConformeAnswers = totalQuestions - conformeAnswers;
        const anomaliesObligatoires = documentDetails.filter(d => !d.conforme && d.obligatoire).length;
        
        const hasYesResponse = documentDetails.some(detail => detail.reponse === 'Oui');
        const hasObligatoryNo = documentDetails.some(detail => 
            detail.reponse === 'Non' && detail.obligatoire
        );
        
        let status;
        if (anomaliesObligatoires > 0) {
            status = 'NON CONFORME';
        } else if (nonConformeAnswers > 0) {
            status = 'AVEC RÉSERVES';
        } else {
            status = 'CONFORME';
        }
        
        return {
            present: hasYesResponse && !hasObligatoryNo,
            justification: this.buildLegacyJustification(documentDetails),
            totalQuestions,
            conformeAnswers,
            nonConformeAnswers,
            status,
            conformityRate: totalQuestions > 0 ? Math.round((conformeAnswers / totalQuestions) * 100) : 0,
            anomalies: nonConformeAnswers
        };
    }

    buildLegacyJustification(documentDetails) {
        const justifications = documentDetails
            .map(detail => detail.justification)
            .filter(j => j && j.trim() !== '')
            .join(' | ');
            
        return justifications || 'Analyse basée sur les réponses disponibles';
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
                const cellAddress = XLSX.utils.encode_cell({ c: C, r: R });
                const cellValue = ws[cellAddress]?.v;
                
                let styleOptions = {
                    fontSize: 10,
                    alignment: { vertical: 'center', wrapText: true }
                };

                // Titre principal
                if (R === 0) {
                    styleOptions = {
                        fillColor: this.companyColors.primary,
                        fontColor: 'FFFFFF',
                        bold: true,
                        fontSize: 14,
                        alignment: { horizontal: 'center', vertical: 'center' }
                    };
                }
                // En-têtes de colonnes
                else if (R === 2) {
                    styleOptions = {
                        fillColor: this.companyColors.secondary,
                        fontColor: 'FFFFFF',
                        bold: true,
                        fontSize: 11,
                        alignment: { horizontal: 'center', vertical: 'center' }
                    };
                }
                // Données
                else if (R > 2) {
                    // Alternance de couleurs
                    const isEvenRow = (R - 3) % 2 === 0;
                    if (!isEvenRow) {
                        styleOptions.fillColor = this.companyColors.light;
                    }
                    
                    // Coloration spéciale pour la conformité (dernière colonne)
                    if (C === range.e.c) {
                        if (cellValue === 'CONFORME') {
                            styleOptions.fillColor = this.companyColors.success;
                            styleOptions.fontColor = 'FFFFFF';
                            styleOptions.bold = true;
                        } else if (cellValue === 'NON CONFORME') {
                            styleOptions.fillColor = this.companyColors.danger;
                            styleOptions.fontColor = 'FFFFFF';
                            styleOptions.bold = true;
                        }
                    }
                    
                    // Coloration pour les anomalies (avant-dernière colonne)
                    if (C === range.e.c - 1) {
                        const anomalies = parseInt(cellValue) || 0;
                        if (anomalies > 0) {
                            styleOptions.fontColor = this.companyColors.danger;
                            styleOptions.bold = true;
                        } else {
                            styleOptions.fontColor = this.companyColors.success;
                            styleOptions.bold = true;
                        }
                    }
                }
                
                this.applyCellStyle(ws, cellAddress, styleOptions);
            }
        }

        // Fusionner le titre
        if (!ws['!merges']) ws['!merges'] = [];
        ws['!merges'].push({ s: { c: 0, r: 0 }, e: { c: 9, r: 0 } });
        
        // Filtres automatiques
        ws['!autofilter'] = { ref: `A3:${XLSX.utils.encode_col(range.e.c)}3` };
    }

    validateExportData() {
        const issues = [];
        
        // Vérifier les contrôles
        this.controles.forEach((controle, index) => {
            if (!controle.date || !(controle.date instanceof Date)) {
                issues.push(`Contrôle ${index}: date invalide`);
            }
            if (!controle.client || typeof controle.client !== 'string') {
                issues.push(`Contrôle ${index}: client invalide`);
            }
            if (!controle.type || typeof controle.type !== 'string') {
                issues.push(`Contrôle ${index}: type invalide`);
            }
        });
        
        if (issues.length > 0) {
            console.warn('Problèmes de données détectés:', issues);
            return false;
        }
        
        return true;
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
                        fill: { fgColor: { rgb: this.companyColors.warning.substr(2) } },
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
                            ws[cell_address].s.fill = { fgColor: { rgb: this.companyColors.danger.substr(2) } };
                            ws[cell_address].s.font = { ...ws[cell_address].s.font, bold: true, color: { rgb: 'FFFFFF' } };
                        } else if (days >= 14) {
                            ws[cell_address].s.fill = { fgColor: { rgb: this.companyColors.warning.substr(2) } };
                            ws[cell_address].s.font = { ...ws[cell_address].s.font, bold: true };
                        }
                    }
                    
                    // Statut suspendu (dernière colonne)
                    if (C === range.e.c) {
                        ws[cell_address].s.fill = { fgColor: { rgb: this.companyColors.warning.substr(2) } };
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
                        fill: { fgColor: { rgb: this.companyColors.warning.substr(2) } },
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
                    // Fond d'alerte pour les suspendus
                    ws[cell_address].s.fill = { fgColor: { rgb: 'FFFACD' } }; // Jaune clair
                    
                    // Coloration spéciale pour les jours suspendus
                    if (C === 7) { // Colonne Jours
                        const days = parseInt(ws[cell_address].v) || 0;
                        if (days >= 30) {
                            ws[cell_address].s.fill = { fgColor: { rgb: this.companyColors.danger.substr(2) } };
                            ws[cell_address].s.font = { ...ws[cell_address].s.font, bold: true, color: { rgb: 'FFFFFF' } };
                        } else if (days >= 14) {
                            ws[cell_address].s.fill = { fgColor: { rgb: this.companyColors.warning.substr(2) } };
                            ws[cell_address].s.font = { ...ws[cell_address].s.font, bold: true };
                        }
                    }
                    
                    // Statut suspendu (dernière colonne)
                    if (C === range.e.c) {
                        ws[cell_address].s.fill = { fgColor: { rgb: this.companyColors.warning.substr(2) } };
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
