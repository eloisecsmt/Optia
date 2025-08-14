// dataProcessor.js - Traitement et mapping des données Excel

import { Utils } from './utils.js';

export class DataProcessor {
    constructor() {
        this.columnMapping = {};
        this.allDossiers = [];
        this.filteredDossiers = [];

        this.originalHeaders = [];
        this.rawData = [];
        
        Utils.debugLog('DataProcessor: Constructor - propriétés initialisées');
        Utils.debugLog(`allDossiers défini: ${!!this.allDossiers}, longueur: ${this.allDossiers.length}`);
    }

    createColumnMapping(headers) {
        const mapping = {};
        
        Utils.debugLog('=== ANALYSE DES EN-TÊTES ===');
        headers.forEach((header, index) => {
            Utils.debugLog(`Colonne ${index}: "${header}" (Excel: ${Utils.getExcelColumnName(index)})`);
        });
        
        // MAPPING FORCÉ pour les colonnes problématiques (positions fixes)
        const forcedMapping = {
            'montant': 11, // Forcer la colonne L (index 11) pour le montant
            // Vous pouvez ajouter d'autres mappings forcés ici si nécessaire
        };
        
        // Appliquer les mappings forcés d'abord
        Utils.debugLog('=== MAPPINGS FORCÉS ===');
        Object.entries(forcedMapping).forEach(([key, index]) => {
            if (index < headers.length && headers[index]) {
                mapping[key] = index;
                Utils.debugLog(`🔒 Forcé: ${key} -> colonne ${index} (${headers[index]}) (Excel: ${Utils.getExcelColumnName(index)})`);
            }
        });
        
        // Mapping basé sur les noms de colonnes avec priorité (premier trouvé = celui utilisé)
        const mappingRules = {
            'client': ['client', 'nom prénom', 'nom prenom', 'nom client', 'prénom nom', 'prenom nom'],
            'assistantBO': ['assistant bo', 'assistant back office', 'back office', 'assistant'],
            'conseiller': ['conseiller', 'nom conseiller', 'conseiller client', 'commercial', 'gestionnaire'],
            'nouveauClient': ['nouveau client', 'nvx client', 'nouveau', 'statut client'],
            'domaine': ['domaine', 'secteur', 'activité', 'activite', 'branche'],
            'fournisseur': ['fournisseur', 'partenaire', 'société', 'societe', 'compagnie'],
            'contrat': ['contrat', 'produit', 'support', 'véhicule', 'vehicule'],
            'reference': ['référence', 'reference', 'ref', 'n° référence', 'numero reference'],
            'typeActe': ['type acte', 'type d\'acte', 'acte', 'opération', 'operation'],
            'montant': ['montant', 'capital', 'montant investi', 'valeur', 'somme', 'montant €', 'capital €'],
            'etatBO': ['état bo', 'etat bo', 'statut bo', 'état', 'etat', 'statut'],
            'codeDossier': ['code dossier', 'n° dossier', 'numero dossier', 'id dossier', 'dossier'],
            'ppe': ['ppe', 'personne politiquement exposée', 'politiquement exposé'],
            'dateValidation': ['date validation', 'validation', 'validé', 'approuvé']
        };

        // Pour chaque type de données, trouver la PREMIÈRE colonne qui correspond (sauf si déjà forcé)
        for (const [key, patterns] of Object.entries(mappingRules)) {
            // Skip si déjà mappé par le mapping forcé
            if (mapping[key] !== undefined) {
                Utils.debugLog(`⏭️  ${key} déjà mappé, ignoré`);
                continue;
            }
            
            // Recherche de correspondance exacte
            for (let index = 0; index < headers.length; index++) {
                const header = headers[index];
                if (!header || header.trim() === '') continue;
                
                // Vérifier que cette colonne n'est pas déjà utilisée
                if (Object.values(mapping).includes(index)) continue;
                
                const headerNormalized = Utils.normalizeText(header);
                
                // Chercher une correspondance exacte d'abord
                for (const pattern of patterns) {
                    const patternNormalized = Utils.normalizeText(pattern);
                        
                    // Correspondance exacte prioritaire
                    if (headerNormalized === patternNormalized) {
                        mapping[key] = index;
                        Utils.debugLog(`✅ Mapping exact: ${key} -> colonne ${index} (${header}) (Excel: ${Utils.getExcelColumnName(index)})`);
                        break;
                    }
                }
                
                if (mapping[key] !== undefined) break;
            }
            
            // Si pas de correspondance exacte, chercher des correspondances partielles
            if (mapping[key] === undefined) {
                for (let index = 0; index < headers.length; index++) {
                    const header = headers[index];
                    if (!header || header.trim() === '') continue;
                    
                    // Vérifier que cette colonne n'est pas déjà utilisée
                    if (Object.values(mapping).includes(index)) continue;
                    
                    const headerNormalized = Utils.normalizeText(header);
                    
                    for (const pattern of patterns) {
                        const patternNormalized = Utils.normalizeText(pattern);
                            
                        if (headerNormalized.includes(patternNormalized)) {
                            mapping[key] = index;
                            Utils.debugLog(`✅ Mapping partiel: ${key} -> colonne ${index} (${header}) (Excel: ${Utils.getExcelColumnName(index)})`);
                            break;
                        }
                    }
                    
                    if (mapping[key] !== undefined) break;
                }
            }
        }

        // Fallback intelligent SEULEMENT pour les colonnes essentielles non trouvées
        this.applyFallbackMapping(mapping, headers);

        Utils.debugLog('=== MAPPING FINAL ===');
        Object.entries(mapping).forEach(([key, index]) => {
            Utils.debugLog(`${key}: colonne ${index} -> "${headers[index]}" (Excel: ${Utils.getExcelColumnName(index)})`);
        });
        
        Utils.debugLog('=== COLONNES NON MAPPÉES ===');
        headers.forEach((header, index) => {
            if (header && header.trim() !== '' && !Object.values(mapping).includes(index)) {
                Utils.debugLog(`❌ Colonne ${index} non utilisée: "${header}" (Excel: ${Utils.getExcelColumnName(index)})`);
            }
        });

        return mapping;
    }

    applyFallbackMapping(mapping, headers) {
        Utils.debugLog('=== FALLBACK POUR COLONNES CRITIQUES ===');
        
        // Le client est critique - fallback sur les premières colonnes non utilisées
        if (!mapping.client) {
            for (let i = 1; i <= 5 && i < headers.length; i++) {
                if (headers[i] && headers[i].trim() !== '' && !Object.values(mapping).includes(i)) {
                    mapping.client = i;
                    Utils.debugLog(`🔄 Fallback client -> colonne ${i} (${headers[i]}) (Excel: ${Utils.getExcelColumnName(i)})`);
                    break;
                }
            }
        }
        
        // Fallback pour assistant et conseiller seulement s'ils ne sont pas trouvés
        if (!mapping.assistantBO && mapping.client !== undefined) {
            for (let i = mapping.client + 1; i < headers.length && i <= mapping.client + 5; i++) {
                if (headers[i] && headers[i].trim() !== '' && !Object.values(mapping).includes(i)) {
                    mapping.assistantBO = i;
                    Utils.debugLog(`🔄 Fallback assistantBO -> colonne ${i} (${headers[i]}) (Excel: ${Utils.getExcelColumnName(i)})`);
                    break;
                }
            }
        }
        
        if (!mapping.conseiller && mapping.client !== undefined) {
            for (let i = mapping.client + 1; i < headers.length && i <= mapping.client + 6; i++) {
                if (headers[i] && headers[i].trim() !== '' && !Object.values(mapping).includes(i)) {
                    mapping.conseiller = i;
                    Utils.debugLog(`🔄 Fallback conseiller -> colonne ${i} (${headers[i]}) (Excel: ${Utils.getExcelColumnName(i)})`);
                    break;
                }
            }
        }
    }

    processExcelData(jsonData, headers, file) {
        Utils.debugLog('=== DÉBUT TRAITEMENT DONNÉES ===');

         // NOUVEAU : Stocker les en-têtes originaux pour la configuration des colonnes
        this.originalHeaders = [...headers];
        this.rawData = [...jsonData];

        // Créer le mapping dynamique
        this.columnMapping = this.createColumnMapping(headers);
        Utils.debugLog('Mapping final: ' + JSON.stringify(this.columnMapping));

        // Traiter les données
        const processedDossiers = jsonData
            .filter((row, index) => {
                if (!row || row.length === 0) return false;
                
                // Vérifier qu'il y a un nom de client
                const clientIndex = this.columnMapping.client || 2;
                const hasClient = row[clientIndex] && row[clientIndex].toString().trim() !== '';
                
                return hasClient;
            })
            .map((row, index) => {
                const dossier = {
                    originalIndex: index,
                    
                    // Utiliser le mapping pour extraire les données
                    client: this.getColumnValue(row, 'client') || '',
                    assistantBO: this.getColumnValue(row, 'assistantBO') || '',
                    conseiller: this.getColumnValue(row, 'conseiller') || '',
                    nouveauClient: this.getColumnValue(row, 'nouveauClient') || '',
                    domaine: this.getColumnValue(row, 'domaine') || '',
                    fournisseur: this.getColumnValue(row, 'fournisseur') || '',
                    contrat: this.getColumnValue(row, 'contrat') || '',
                    reference: this.getColumnValue(row, 'reference') || '',
                    typeActe: this.getColumnValue(row, 'typeActe') || '',
                    montant: this.processMontant(row, index),
                    etatBO: this.getColumnValue(row, 'etatBO') || '',
                    codeDossier: this.getColumnValue(row, 'codeDossier') || '',
                    ppe: this.getColumnValue(row, 'ppe') || '',
                    dateValidation: Utils.formatDate(this.getColumnValue(row, 'dateValidation')) || '',
                    
                    rawData: row
                };
                
                return dossier;
            });

        // IMPORTANT: Assigner les données AVANT la notification
        this.allDossiers = processedDossiers;
        this.filteredDossiers = [...this.allDossiers];
        
        Utils.debugLog(`=== RÉSULTAT: ${this.allDossiers.length} dossiers traités ===`);
        Utils.debugLog(`Vérification immédiate: allDossiers.length = ${this.allDossiers.length}`);
        
        if (this.allDossiers.length > 0) {
            Utils.debugLog('Exemple de dossier traité: ' + JSON.stringify(this.allDossiers[0], null, 2));
        }
        
        // Mettre à jour les informations du fichier
        this.updateFileInfo(file, this.allDossiers.length, headers.length);
        
        // Notifier APRÈS avoir assigné les données
        this.notifyDataProcessed();
    }

    // NOUVEAU : Exposer les en-têtes originaux
    getOriginalHeaders() {
        return this.originalHeaders;
    }

    // NOUVEAU : Obtenir une valeur brute par index de colonne
    getRawColumnValue(row, columnIndex) {
        if (!row || columnIndex >= row.length || columnIndex < 0) {
            return '';
        }
        
        const value = row[columnIndex];
        return value ? value.toString().trim() : '';
    }

    // NOUVEAU : Obtenir les données brutes complètes
    getRawData() {
        return this.rawData;
    }

    // NOUVEAU : Obtenir les informations sur une colonne par index
    getColumnInfo(columnIndex) {
        if (columnIndex < 0 || columnIndex >= this.originalHeaders.length) {
            return null;
        }
        
        return {
            index: columnIndex,
            header: this.originalHeaders[columnIndex],
            isMapped: this.isColumnMapped(columnIndex),
            mappedKey: this.getMappedKeyByIndex(columnIndex)
        };
    }

    // NOUVEAU : Vérifier si une colonne est mappée
    isColumnMapped(columnIndex) {
        return Object.values(this.columnMapping).includes(columnIndex);
    }

    // NOUVEAU : Obtenir la clé mappée pour un index de colonne
    getMappedKeyByIndex(columnIndex) {
        for (const [key, index] of Object.entries(this.columnMapping)) {
            if (index === columnIndex) {
                return key;
            }
        }
        return null;
    }

    processMontant(row, index) {
        const rawMontant = this.getColumnValue(row, 'montant');
        
        if (index < 3) { // Debug seulement pour les 3 premiers dossiers
            Utils.debugLog(`=== DEBUG MONTANT DOSSIER ${index + 1} ===`);
            Utils.debugLog(`Client: ${this.getColumnValue(row, 'client')}`);
            Utils.debugLog(`Colonne montant (index ${this.columnMapping.montant}, Excel ${Utils.getExcelColumnName(this.columnMapping.montant)})`);
            Utils.debugLog(`Valeur brute: "${rawMontant}" (type: ${typeof rawMontant})`);
            
            // Vérifier toute la ligne autour de la colonne montant
            for (let i = Math.max(0, this.columnMapping.montant - 2); i <= Math.min(row.length - 1, this.columnMapping.montant + 2); i++) {
                Utils.debugLog(`Colonne ${i} (${Utils.getExcelColumnName(i)}): "${row[i]}" (type: ${typeof row[i]})`);
            }
        }
        
        const formatted = Utils.formatMontant(rawMontant);
        
        if (index < 3) {
            Utils.debugLog(`Résultat formaté: "${formatted}"`);
            Utils.debugLog(`=== FIN DEBUG MONTANT ===`);
        }
        
        return formatted;
    }

    getColumnValue(row, columnKey) {
        const columnIndex = this.columnMapping[columnKey];
        if (columnIndex === undefined) {
            if (columnKey === 'montant') {
                Utils.debugLog(`❌ ERREUR: Colonne '${columnKey}' non trouvée dans le mapping!`);
                Utils.debugLog(`Mapping disponible: ${JSON.stringify(this.columnMapping)}`);
                
                // Tentative de recherche manuelle dans la colonne L (index 11)
                if (row.length > 11 && row[11] !== undefined && row[11] !== '') {
                    Utils.debugLog(`🔍 Tentative colonne L (index 11): "${row[11]}"`);
                    return row[11];
                }
            }
            return '';
        }
        if (columnIndex >= row.length) {
            Utils.debugLog(`❌ Index ${columnIndex} hors limite pour la ligne (longueur: ${row.length})`);
            return '';
        }
        const value = row[columnIndex];
        
        if (columnKey === 'montant') {
            Utils.debugLog(`✅ Colonne montant trouvée - Index: ${columnIndex}, Valeur: "${value}" (type: ${typeof value})`);
        }
        
        return value ? value.toString().trim() : '';
    }

    updateFileInfo(file, rowCount, columnCount) {
        // Mettre à jour directement les éléments du DOM
        const fileNameEl = document.getElementById('file-name');
        const totalRowsEl = document.getElementById('total-rows');
        const totalColumnsEl = document.getElementById('total-columns');
        const fileSizeEl = document.getElementById('file-size');
        const fileInfoEl = document.getElementById('file-info');

        if (fileNameEl) fileNameEl.textContent = file.name;
        if (totalRowsEl) totalRowsEl.textContent = rowCount.toLocaleString();
        if (totalColumnsEl) totalColumnsEl.textContent = columnCount;
        if (fileSizeEl) fileSizeEl.textContent = (file.size / 1024).toFixed(0) + ' KB';
        if (fileInfoEl) fileInfoEl.classList.add('active');
    }

    notifyDataProcessed() {
        // Vérification finale avant notification
        Utils.debugLog(`DataProcessor: Notification - ${this.allDossiers.length} dossiers`);
        Utils.debugLog(`allDossiers défini: ${!!this.allDossiers}`);
        Utils.debugLog(`filteredDossiers défini: ${!!this.filteredDossiers}`);
        
        if (this.allDossiers && this.allDossiers.length > 0) {
            Utils.debugLog(`Premier dossier avant notification: ${this.allDossiers[0].client}`);
        }
        
        window.dispatchEvent(new CustomEvent('dataProcessed', {
            detail: {
                allDossiers: this.allDossiers,
                filteredDossiers: this.filteredDossiers,
                columnMapping: this.columnMapping,
                originalHeaders: this.originalHeaders,
                rawData: this.rawData
            }
        }));
        
        // S'assurer que les données sont disponibles globalement
        setTimeout(() => {
            Utils.debugLog('DataProcessor: Vérification données globales');
            if (window.dataProcessor) {
                const count = window.dataProcessor.getAllDossiers().length;
                Utils.debugLog(`Données disponibles globalement: ${count} dossiers`);
                
                // Vérification approfondie
                if (count === 0 && this.allDossiers && this.allDossiers.length > 0) {
                    Utils.debugLog('PROBLÈME: Instance locale a des données mais pas l\'instance globale');
                    Utils.debugLog(`Instance locale: ${this.allDossiers.length}, Instance globale: ${count}`);
                }
            }
        }, 50);
    }

    // Méthodes d'accès pour les autres modules
    getAllDossiers() {
        const count = this.allDossiers ? this.allDossiers.length : 0;
        Utils.debugLog(`DataProcessor.getAllDossiers() appelé: ${count} dossiers (array défini: ${!!this.allDossiers})`);
        
        if (this.allDossiers && this.allDossiers.length > 0) {
            Utils.debugLog(`Premier dossier: ${this.allDossiers[0].client || 'pas de client'}`);
        }
        
        return this.allDossiers || [];
    }

    getFilteredDossiers() {
        return this.filteredDossiers || [];
    }

    setFilteredDossiers(dossiers) {
        this.filteredDossiers = dossiers;
    }

    getColumnMapping() {
        return this.columnMapping;
    }

    // Méthodes de filtrage
    applyFilters(filters) {
        const { conseiller, domaine, nouveau, search } = filters;

        this.filteredDossiers = this.allDossiers.filter(dossier => {
            const matchConseiller = !conseiller || (dossier.conseiller && dossier.conseiller === conseiller);
            const matchDomaine = !domaine || (dossier.domaine && dossier.domaine === domaine);
            const matchNouveau = !nouveau || (dossier.nouveauClient && dossier.nouveauClient === nouveau);
            const matchSearch = !search || 
                (dossier.client && dossier.client.toLowerCase().includes(search)) || 
                (dossier.codeDossier && dossier.codeDossier.toLowerCase().includes(search)) ||
                (dossier.contrat && dossier.contrat.toLowerCase().includes(search)) ||
                (dossier.reference && dossier.reference.toLowerCase().includes(search));

            return matchConseiller && matchDomaine && matchNouveau && matchSearch;
        });

        Utils.debugLog(`Filtres appliqués: ${this.filteredDossiers.length} dossiers sur ${this.allDossiers.length}`);
        return this.filteredDossiers;
    }

    getUniqueValues(fieldName) {
        return [...new Set(
            this.allDossiers
                .map(d => d[fieldName])
                .filter(value => value && value.trim() !== '' && value.trim() !== '-')
        )].sort();
    }

    reset() {
        this.columnMapping = {};
        this.allDossiers = [];
        this.filteredDossiers = [];
    }
}

