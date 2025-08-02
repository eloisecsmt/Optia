// persistenceManager.js - Version simple pour commencer

import { Utils } from './utils.js';

export class PersistenceManager {
    constructor() {
        this.controles = [];
        this.lastSaveTime = 0;
        this.init();
    }

    init() {
        Utils.debugLog('PersistenceManager initialisé');
        
        // Essayer de charger depuis localStorage
        this.loadFromStorage();
    }

    // Sauvegarder un contrôle
    saveControl(controlData) {
        try {

            const now = Date.now();
            if (now - this.lastSaveTime < 1000) { // Moins d'1 seconde = doublon
                Utils.debugLog('Doublon détecté - sauvegarde ignorée');
                return null;
            }
            this.lastSaveTime = now;
            
            // Vérifications de sécurité
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
                details: controlData.responses ? this.extractDetails(controlData) : []
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
                    conforme: response.answer === 'Oui' && response.quality !== 'Non conforme',
                    obligatoire: response.obligation === 'Obligatoire',
                    justification: response.justification || ''
                });
            });
        });
        
        return details;
    }

    // Obtenir le nom du document
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

    // Obtenir les données d'historique
    getHistoryData() {
        return {
            controles: this.controles
        };
    }

    // Calculer les statistiques
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

    // Rechercher dans les contrôles
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

    // Export Excel simple
    saveToExcel(fileName = null) {
        if (!fileName) {
            fileName = `Historique_Controles_${new Date().toISOString().split('T')[0]}.xlsx`;
        }

        try {
            const exportData = this.controles.map(c => ({
                'Date': c.date.toLocaleDateString('fr-FR'),
                'Type de contrôle': c.type,
                'Client': c.client,
                'Code dossier': c.codeDossier,
                'Conseiller': c.conseiller,
                'Montant': c.montant,
                'Domaine': c.domaine,
                'Nouveau client': c.nouveauClient,
                'Documents contrôlés': c.documentsControles,
                'Anomalies majeures': c.anomaliesMajeures,
                'Conformité': c.conformiteGlobale
            }));

            const ws = XLSX.utils.json_to_sheet(exportData);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Historique");
            
            XLSX.writeFile(wb, fileName);
            
            Utils.showNotification(`Historique exporté: ${fileName}`, 'success');
            return true;

        } catch (error) {
            console.error('Erreur export Excel:', error);
            Utils.showNotification('Erreur lors de l\'export Excel', 'error');
            return false;
        }
    }

    // Export filtré
    exportFiltered(criteria, fileName) {
        const filteredControles = this.searchControls(criteria);
        
        // Temporairement remplacer les données
        const originalControles = this.controles;
        this.controles = filteredControles;
        
        // Exporter
        const result = this.saveToExcel(fileName);
        
        // Restaurer les données originales
        this.controles = originalControles;
        
        return result;
    }

    // Sauvegarde en localStorage (simple)
    saveToStorage() {
        try {
            const dataToSave = this.controles.map(c => ({
                ...c,
                date: c.date.toISOString() // Convertir Date en string
            }));
            localStorage.setItem('controles_historique', JSON.stringify(dataToSave));
            Utils.debugLog(`${this.controles.length} contrôles sauvegardés en localStorage`);
        } catch (error) {
            Utils.debugLog('Erreur sauvegarde localStorage: ' + error.message);
        }
    }

    // Chargement depuis localStorage
    loadFromStorage() {
        try {
            const saved = localStorage.getItem('controles_historique');
            if (saved) {
                const data = JSON.parse(saved);
                this.controles = data.map(c => ({
                    ...c,
                    date: new Date(c.date) // Reconvertir string en Date
                }));
                Utils.debugLog(`${this.controles.length} contrôles chargés depuis localStorage`);
            }
        } catch (error) {
            Utils.debugLog('Erreur chargement localStorage: ' + error.message);
            this.controles = [];
        }
    }

    // Effacer l'historique
    clearHistory() {
        this.controles = [];
        localStorage.removeItem('controles_historique');
        Utils.showNotification('Historique effacé', 'info');
    }

    // Obtenir le nombre de contrôles
    getControlsCount() {
        return this.controles.length;
    }
}