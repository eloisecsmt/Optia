// dateAnalyzer.js - Module d'analyse globale des dates DCC et Profil Investisseur

import { Utils } from './utils.js';

export class DateAnalyzer {
    constructor() {
        this.allData = [];
        this.companyColors = {
            primary: '1A1A2E',
            secondary: '6C757D', 
            success: '28A745',
            warning: 'FFC107',
            danger: 'DC3545',
            light: 'F8F9FA',
            info: '17A2B8'
        };
        this.init();
    }

    init() {
        Utils.debugLog('DateAnalyzer initialisé');
        
        // Écouter les données traitées
        window.addEventListener('dataProcessed', (e) => {
            this.allData = e.detail.allDossiers || [];
            Utils.debugLog(`DateAnalyzer: ${this.allData.length} dossiers chargés pour analyse`);
        });
    }

    // Méthode principale d'export
    exportGlobalDateAnalysis() {
        if (!this.allData || this.allData.length === 0) {
            Utils.showNotification('Aucune donnée disponible pour l\'analyse', 'error');
            return false;
        }

        Utils.debugLog(`=== DÉBUT ANALYSE GLOBALE DES DATES ===`);
        Utils.debugLog(`Analyse de ${this.allData.length} opérations`);

        try {
            const analysisData = this.prepareAnalysisData();
            const fileName = this.generateFileName();
            
            this.createExcelFile(analysisData, fileName);
            
            const stats = this.calculateStats(analysisData);
            Utils.showNotification(
                `Analyse exportée: ${stats.total} opérations (${stats.expired} expirées)`, 
                'success'
            );
            
            Utils.debugLog(`Export terminé: ${fileName}`);
            return true;

        } catch (error) {
            console.error('Erreur analyse dates:', error);
            Utils.showNotification('Erreur lors de l\'analyse: ' + error.message, 'error');
            return false;
        }
    }

    // Préparer les données pour l'analyse
    prepareAnalysisData() {
        Utils.debugLog('Préparation des données d\'analyse...');
        
        const analysisData = this.allData.map((dossier, index) => {
            const analysisRow = {
                // Informations de base
                client: dossier.client || 'Non spécifié',
                conseiller: dossier.conseiller || 'Non assigné',
                codeDossier: dossier.codeDossier || 'N/A',
                
                // Dates brutes (pour la logique)
                dateEnvoiBrute: dossier.dateEnvoi,
                dateDCCBrute: dossier.dateDCC,
                dateProfilBrute: dossier.dateProfilInvestisseur,
                
                // Dates formatées (pour l'affichage)
                dateEnvoi: this.formatDateForDisplay(dossier.dateEnvoi),
                dateDCC: this.formatDateForDisplay(dossier.dateDCC),
                dateProfilInvestisseur: this.formatDateForDisplay(dossier.dateProfilInvestisseur),
                
                // Statuts depuis les colonnes Excel existantes
                statusDCC: dossier.statusDCC || this.calculateFallbackStatus(dossier.dateDCC, dossier.dateEnvoi, 'DCC'),
                statusProfilInvestisseur: dossier.statusProfilInvestisseur || this.calculateFallbackStatus(dossier.dateProfilInvestisseur, dossier.dateEnvoi, 'Profil'),
                
                // Métadonnées
                domaine: dossier.domaine || '',
                montant: dossier.montant || '',
                nouveauClient: dossier.nouveauClient || '',
                originalIndex: index
            };

            return analysisRow;
        });

        Utils.debugLog(`${analysisData.length} lignes d'analyse préparées`);
        return analysisData;
    }

    // Formater une date pour l'affichage
    formatDateForDisplay(dateValue) {
        if (!dateValue) return 'Non renseignée';
        
        try {
            // Si c'est déjà formaté au format français
            if (typeof dateValue === 'string' && dateValue.match(/^\d{2}\/\d{2}\/\d{4}$/)) {
                return dateValue;
            }
            
            // Parser la date avec la même logique que DataProcessor
            const date = this.parseExcelDateSafe(dateValue);
            if (!date || isNaN(date.getTime())) {
                return dateValue.toString();
            }
            
            return date.toLocaleDateString('fr-FR', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric'
            });
        } catch (error) {
            return dateValue ? dateValue.toString() : 'Erreur format';
        }
    }

    // Parser une date Excel de manière sécurisée
    parseExcelDateSafe(dateValue) {
        if (!dateValue) return null;
        
        // Si c'est déjà un objet Date
        if (dateValue instanceof Date) {
            return dateValue;
        }
        
        // Si c'est un nombre (date Excel sérialisée)
        if (typeof dateValue === 'number') {
            const excelEpoch = new Date(1900, 0, 1);
            const daysOffset = dateValue - 2;
            return new Date(excelEpoch.getTime() + daysOffset * 24 * 60 * 60 * 1000);
        }
        
        // Si c'est une chaîne
        const dateString = dateValue.toString().trim();
        if (!dateString) return null;
        
        // Format DD/MM/YYYY
        if (dateString.includes('/')) {
            const parts = dateString.split('/');
            if (parts.length === 3) {
                const day = parseInt(parts[0], 10);
                const month = parseInt(parts[1], 10);
                const year = parseInt(parts[2], 10);
                
                if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
                    return new Date(year, month - 1, day);
                }
            }
        }
        
        // Format ISO ou autres
        const isoDate = new Date(dateString);
        if (!isNaN(isoDate.getTime())) {
            return isoDate;
        }
        
        return null;
    }

    // Calculer un statut de fallback si pas dans les colonnes Excel
    calculateFallbackStatus(dateDoc, dateEnvoi, type) {
        if (!dateDoc) return 'Non renseignée';
        
        // Si pas de date d'envoi, utiliser la date du jour
        const referenceDate = dateEnvoi ? 
            this.parseExcelDateSafe(dateEnvoi) : 
            new Date();
            
        if (!referenceDate) return 'Date référence invalide';
        
        const docDate = this.parseExcelDateSafe(dateDoc);
        if (!docDate) return 'Date invalide';
        
        // Calculer l'écart en mois
        const diffMonths = (referenceDate.getFullYear() - docDate.getFullYear()) * 12 + 
                          (referenceDate.getMonth() - docDate.getMonth());
        
        if (diffMonths <= 24) {
            if (diffMonths <= 6) return 'Très récent';
            if (diffMonths <= 12) return 'Récent';
            return 'Valide';
        } else {
            return 'Expiré';
        }
    }

    // Créer le fichier Excel
    createExcelFile(analysisData, fileName) {
        const wb = XLSX.utils.book_new();
        
        // Créer l'onglet principal d'analyse
        this.createMainAnalysisSheet(wb, analysisData);
        
        // Créer l'onglet de statistiques
        this.createStatsSheet(wb, analysisData);
        
        // Créer l'onglet par conseiller
        this.createConseillerSheet(wb, analysisData);
        
        // Sauvegarder le fichier
        XLSX.writeFile(wb, fileName);
    }

    // Créer l'onglet principal d'analyse
    createMainAnalysisSheet(wb, analysisData) {
        const sheetData = [
            ['ANALYSE GLOBALE DES DATES DOCUMENTAIRES', '', '', '', '', '', '', '', ''],
            ['', '', '', '', '', '', '', '', ''],
            ['Export généré le', new Date().toLocaleDateString('fr-FR'), '', '', '', '', '', '', ''],
            ['Nombre d\'opérations analysées', analysisData.length.toString(), '', '', '', '', '', '', ''],
            ['', '', '', '', '', '', '', '', ''],
            ['Client', 'Conseiller', 'Code Dossier', 'Date Envoi', 'Date DCC', 'Statut DCC', 'Date Profil Investisseur', 'Statut Profil', 'Domaine']
        ];

        // Ajouter les données
        analysisData.forEach(row => {
            sheetData.push([
                row.client,
                row.conseiller,
                row.codeDossier,
                row.dateEnvoi,
                row.dateDCC,
                row.statusDCC,
                row.dateProfilInvestisseur,
                row.statusProfilInvestisseur,
                row.domaine
            ]);
        });

        const ws = XLSX.utils.aoa_to_sheet(sheetData);
        this.formatMainAnalysisSheet(ws, sheetData.length);
        XLSX.utils.book_append_sheet(wb, ws, "Analyse Dates");
    }

    // Formater l'onglet principal
    formatMainAnalysisSheet(ws, rowCount) {
        if (!ws['!ref']) return;

        // Largeurs de colonnes
        ws['!cols'] = [
            { width: 30 }, // Client
            { width: 20 }, // Conseiller
            { width: 15 }, // Code Dossier
            { width: 12 }, // Date Envoi
            { width: 12 }, // Date DCC
            { width: 18 }, // Statut DCC
            { width: 18 }, // Date Profil
            { width: 18 }, // Statut Profil
            { width: 15 }  // Domaine
        ];

        const range = XLSX.utils.decode_range(ws['!ref']);

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
                        fill: {
                            patternType: "solid",
                            fgColor: { rgb: this.companyColors.info }
                        },
                        alignment: { horizontal: 'center', vertical: 'center' }
                    };
                }
                // En-têtes de données
                else if (R === 5) {
                    ws[cell_address].s = {
                        ...ws[cell_address].s,
                        font: { name: 'Calibri', sz: 11, bold: true, color: { rgb: 'FFFFFF' } },
                        fill: {
                            patternType: "solid",
                            fgColor: { rgb: this.companyColors.primary }
                        },
                        alignment: { horizontal: 'center', vertical: 'center' }
                    };
                }
                // Données
                else if (R > 5) {
                    // Alternance de couleurs
                    const isEvenRow = (R - 6) % 2 === 0;
                    ws[cell_address].s.fill = {
                        patternType: "solid",
                        fgColor: { rgb: isEvenRow ? 'FFFFFF' : this.companyColors.light }
                    };

                    // Coloration des statuts
                    if (C === 5 || C === 7) { // Colonnes statuts
                        const statusValue = ws[cell_address].v;
                        if (statusValue && typeof statusValue === 'string') {
                            const lowerStatus = statusValue.toLowerCase();
                            
                            if (lowerStatus.includes('expiré') || lowerStatus.includes('expired')) {
                                ws[cell_address].s.fill = {
                                    patternType: "solid",
                                    fgColor: { rgb: this.companyColors.danger }
                                };
                                ws[cell_address].s.font = { ...ws[cell_address].s.font, bold: true, color: { rgb: 'FFFFFF' } };
                            }
                            else if (lowerStatus.includes('valide') || lowerStatus.includes('récent')) {
                                ws[cell_address].s.fill = {
                                    patternType: "solid",
                                    fgColor: { rgb: this.companyColors.success }
                                };
                                ws[cell_address].s.font = { ...ws[cell_address].s.font, bold: true, color: { rgb: 'FFFFFF' } };
                            }
                            else if (lowerStatus.includes('non renseignée') || lowerStatus.includes('invalide')) {
                                ws[cell_address].s.fill = {
                                    patternType: "solid",
                                    fgColor: { rgb: this.companyColors.secondary }
                                };
                                ws[cell_address].s.font = { ...ws[cell_address].s.font, color: { rgb: 'FFFFFF' } };
                            }
                        }
                    }
                }
            }
        }

        // Fusionner le titre
        ws['!merges'] = [
            { s: { c: 0, r: 0 }, e: { c: 8, r: 0 } },
            { s: { c: 0, r: 2 }, e: { c: 1, r: 2 } },
            { s: { c: 0, r: 3 }, e: { c: 1, r: 3 } }
        ];

        // Filtres automatiques
        ws['!autofilter'] = { ref: `A6:I6` };
    }

    // Créer l'onglet de statistiques
    createStatsSheet(wb, analysisData) {
        const stats = this.calculateDetailedStats(analysisData);
        
        const statsData = [
            ['STATISTIQUES DÉTAILLÉES', '', '', ''],
            ['', '', '', ''],
            ['RÉSUMÉ GLOBAL', '', '', ''],
            ['Total opérations analysées', stats.total, '', ''],
            ['Opérations avec DCC expirée', stats.dccExpired, '', ''],
            ['Opérations avec Profil expiré', stats.profilExpired, '', ''],
            ['Taux de conformité DCC', `${stats.dccComplianceRate}%`, '', ''],
            ['Taux de conformité Profil', `${stats.profilComplianceRate}%`, '', ''],
            ['', '', '', ''],
            ['RÉPARTITION PAR CONSEILLER', '', '', ''],
            ['Conseiller', 'Total opérations', 'DCC expirées', 'Profil expirés']
        ];

        // Ajouter les stats par conseiller
        Object.entries(stats.byConseiller).forEach(([conseiller, conseillerStats]) => {
            statsData.push([
                conseiller,
                conseillerStats.total,
                conseillerStats.dccExpired,
                conseillerStats.profilExpired
            ]);
        });

        const ws = XLSX.utils.aoa_to_sheet(statsData);
        this.formatStatsSheet(ws, statsData.length);
        XLSX.utils.book_append_sheet(wb, ws, "Statistiques");
    }

    // Créer l'onglet par conseiller
    createConseillerSheet(wb, analysisData) {
        const conseillerData = [
            ['RÉPARTITION PAR CONSEILLER', '', '', '', '', ''],
            ['', '', '', '', '', ''],
            ['Conseiller', 'Client', 'Statut DCC', 'Statut Profil', 'Date DCC', 'Date Profil']
        ];

        // Grouper et trier par conseiller
        const byConseiller = {};
        analysisData.forEach(row => {
            const conseiller = row.conseiller;
            if (!byConseiller[conseiller]) {
                byConseiller[conseiller] = [];
            }
            byConseiller[conseiller].push(row);
        });

        Object.keys(byConseiller).sort().forEach(conseiller => {
            byConseiller[conseiller].forEach(row => {
                conseillerData.push([
                    conseiller,
                    row.client,
                    row.statusDCC,
                    row.statusProfilInvestisseur,
                    row.dateDCC,
                    row.dateProfilInvestisseur
                ]);
            });
        });

        const ws = XLSX.utils.aoa_to_sheet(conseillerData);
        this.formatConseillerSheet(ws, conseillerData.length);
        XLSX.utils.book_append_sheet(wb, ws, "Par Conseiller");
    }

    // Formater l'onglet statistiques
    formatStatsSheet(ws, rowCount) {
        if (!ws['!ref']) return;

        ws['!cols'] = [
            { width: 30 },
            { width: 20 },
            { width: 15 },
            { width: 15 }
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
                            fill: {
                                patternType: "solid",
                                fgColor: { rgb: this.companyColors.secondary }
                            },
                            alignment: { horizontal: 'center', vertical: 'center' }
                        };
                    }
                }
            }
        }

        // Fusionner les titres
        ws['!merges'] = [
            { s: { c: 0, r: 0 }, e: { c: 3, r: 0 } },
            { s: { c: 0, r: 2 }, e: { c: 3, r: 2 } },
            { s: { c: 0, r: 9 }, e: { c: 3, r: 9 } }
        ];
    }

    // Formater l'onglet par conseiller
    formatConseillerSheet(ws, rowCount) {
        if (!ws['!ref']) return;

        ws['!cols'] = [
            { width: 25 }, // Conseiller
            { width: 30 }, // Client
            { width: 18 }, // Statut DCC
            { width: 18 }, // Statut Profil
            { width: 12 }, // Date DCC
            { width: 12 }  // Date Profil
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
                        fill: {
                            patternType: "solid",
                            fgColor: { rgb: this.companyColors.info }
                        },
                        alignment: { horizontal: 'center', vertical: 'center' }
                    };
                } else if (R === 2) {
                    ws[cell_address].s = {
                        ...ws[cell_address].s,
                        font: { name: 'Calibri', sz: 11, bold: true, color: { rgb: 'FFFFFF' } },
                        fill: {
                            patternType: "solid",
                            fgColor: { rgb: this.companyColors.primary }
                        },
                        alignment: { horizontal: 'center', vertical: 'center' }
                    };
                } else if (R > 2) {
                    // Coloration des statuts
                    if (C === 2 || C === 3) {
                        const statusValue = ws[cell_address].v;
                        if (statusValue && typeof statusValue === 'string') {
                            const lowerStatus = statusValue.toLowerCase();
                            
                            if (lowerStatus.includes('expiré')) {
                                ws[cell_address].s.fill = {
                                    patternType: "solid",
                                    fgColor: { rgb: this.companyColors.danger }
                                };
                                ws[cell_address].s.font = { ...ws[cell_address].s.font, bold: true, color: { rgb: 'FFFFFF' } };
                            } else if (lowerStatus.includes('valide') || lowerStatus.includes('récent')) {
                                ws[cell_address].s.fill = {
                                    patternType: "solid",
                                    fgColor: { rgb: this.companyColors.success }
                                };
                                ws[cell_address].s.font = { ...ws[cell_address].s.font, bold: true, color: { rgb: 'FFFFFF' } };
                            }
                        }
                    }
                }
            }
        }

        ws['!merges'] = [{ s: { c: 0, r: 0 }, e: { c: 5, r: 0 } }];
        ws['!autofilter'] = { ref: `A3:F3` };
    }

    // Calculer les statistiques de base
    calculateStats(analysisData) {
        const total = analysisData.length;
        const expired = analysisData.filter(row => 
            (row.statusDCC && row.statusDCC.toLowerCase().includes('expiré')) ||
            (row.statusProfilInvestisseur && row.statusProfilInvestisseur.toLowerCase().includes('expiré'))
        ).length;

        return { total, expired };
    }

    // Calculer les statistiques détaillées
    calculateDetailedStats(analysisData) {
        const total = analysisData.length;
        const dccExpired = analysisData.filter(row => 
            row.statusDCC && row.statusDCC.toLowerCase().includes('expiré')
        ).length;
        const profilExpired = analysisData.filter(row => 
            row.statusProfilInvestisseur && row.statusProfilInvestisseur.toLowerCase().includes('expiré')
        ).length;

        const dccComplianceRate = total > 0 ? Math.round(((total - dccExpired) / total) * 100) : 0;
        const profilComplianceRate = total > 0 ? Math.round(((total - profilExpired) / total) * 100) : 0;

        // Statistiques par conseiller
        const byConseiller = {};
        analysisData.forEach(row => {
            const conseiller = row.conseiller;
            if (!byConseiller[conseiller]) {
                byConseiller[conseiller] = {
                    total: 0,
                    dccExpired: 0,
                    profilExpired: 0
                };
            }
            
            byConseiller[conseiller].total++;
            
            if (row.statusDCC && row.statusDCC.toLowerCase().includes('expiré')) {
                byConseiller[conseiller].dccExpired++;
            }
            
            if (row.statusProfilInvestisseur && row.statusProfilInvestisseur.toLowerCase().includes('expiré')) {
                byConseiller[conseiller].profilExpired++;
            }
        });

        return {
            total,
            dccExpired,
            profilExpired,
            dccComplianceRate,
            profilComplianceRate,
            byConseiller
        };
    }

    // Générer le nom de fichier
    generateFileName() {
        const today = new Date();
        const dateStr = today.toISOString().split('T')[0];
        return `Analyse_Dates_DCC_Profil_${dateStr}.xlsx`;
    }

    // Obtenir les statistiques pour l'interface
    getAnalysisStats() {
        if (!this.allData || this.allData.length === 0) {
            return {
                total: 0,
                dccExpired: 0,
                profilExpired: 0,
                lastUpdate: null
            };
        }

        const analysisData = this.prepareAnalysisData();
        const stats = this.calculateStats(analysisData);
        
        return {
            total: stats.total,
            expired: stats.expired,
            lastUpdate: new Date()
        };
    }
}
