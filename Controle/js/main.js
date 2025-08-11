// main.js - Point d'entrée principal de l'application

import { Utils } from './modules/utils.js';
import { FileHandler } from './modules/fileHandler.js';
import { DataProcessor } from './modules/dataProcessor.js';
import { TableManager } from './modules/tableManager.js';
import { ControlTypes } from './modules/controlTypes.js';
import { DocumentController } from './modules/documentController.js';
import { PersistenceManager } from './modules/persistenceManager.js';
import { HistoryInterface } from './modules/historyInterface.js';
import { MailManager } from './modules/mailManager.js';


class DocumentControlApp {
    constructor() {
        this.modules = {};
        this.init();
    }

    async init() {
        try {
            Utils.debugLog('=== INITIALISATION APPLICATION ===');
            
            // Initialiser les modules dans l'ordre
            this.modules.fileHandler = new FileHandler();
            this.modules.dataProcessor = new DataProcessor();
            this.modules.tableManager = new TableManager();
            this.modules.controlTypes = new ControlTypes();
            this.modules.documentController = new DocumentController();
            this.modules.persistenceManager = new PersistenceManager();
            this.modules.historyInterface = new HistoryInterface();
            this.modules.mailManager = new MailManager();
            
            // Exposer les modules globalement IMMÉDIATEMENT
            window.fileHandler = this.modules.fileHandler;
            window.dataProcessor = this.modules.dataProcessor;
            window.tableManager = this.modules.tableManager;
            window.controlTypes = this.modules.controlTypes;
            window.documentController = this.modules.documentController;
            window.persistenceManager = this.modules.persistenceManager;
            window.historyInterface = this.modules.historyInterface;
            window.mailManager = this.modules.mailManager;
            
            Utils.debugLog('Modules exposés globalement');
            
            // Configurer les gestionnaires d'événements globaux
            this.setupGlobalEventHandlers();
            
            // Diagnostic initial
            setTimeout(() => {
                Utils.debugLog(`DataProcessor global: ${window.dataProcessor ? 'OK' : 'NON'}`);
                Utils.debugLog(`TableManager global: ${window.tableManager ? 'OK' : 'NON'}`);
                Utils.debugLog(`DocumentController global: ${window.documentController ? 'OK' : 'NON'}`);
                Utils.debugLog(`PersistenceManager global: ${window.persistenceManager ? 'OK' : 'NON'}`);
                Utils.debugLog(`HistoryInterface global: ${window.historyInterface ? 'OK' : 'NON'}`);
                Utils.debugLog(`MailManager global: ${window.mailManager ? 'OK' : 'NON'}`);
            }, 100);
            
            Utils.debugLog('Application initialisée avec succès');
            
        } catch (error) {
            console.error('Erreur lors de l\'initialisation:', error);
            Utils.showNotification('Erreur lors de l\'initialisation de l\'application', 'error');
        }
    }

    setupGlobalEventHandlers() {
        // Gestionnaires pour les boutons de navigation
        this.setupNavigationHandlers();
        
        // Gestionnaires pour les contrôles
        this.setupControlHandlers();
        
        // Gestionnaires pour les filtres
        this.setupFilterHandlers();
        
        // Gestionnaires pour la sélection
        this.setupSelectionHandlers();
        
        // Gestionnaires pour l'export
        this.setupExportHandlers();
        
        // Gestionnaires pour le debug
        this.setupDebugHandlers();
        
        // Gestionnaires pour l'historique (basique pour l'instant)
        this.setupHistoryHandlers();
        
        // Événements personnalisés entre modules
        this.setupCustomEvents();
    }

    setupNavigationHandlers() {
        // Boutons de navigation entre sections
        window.proceedToSelection = () => {
            this.modules.tableManager.proceedToSelection();
        };

        window.showFileUpload = () => {
            this.modules.tableManager.showFileUpload();
        };

        window.showDossierSelection = () => {
            this.modules.tableManager.showDossierSelection();
        };

        window.showAutomaticControls = () => {
            this.modules.tableManager.showAutomaticControls();
        };

        window.resetFile = () => {
            this.modules.fileHandler.resetFileUpload();
        };
    }

    setupControlHandlers() {
        // Contrôles manuels
        window.proceedToControl = () => {
            this.modules.tableManager.proceedToControl();
        };

        // Navigation depuis l'interface de contrôle
        window.returnToAutomaticControls = () => {
            this.modules.controlTypes.returnToAutomaticControls();
        };
    }

    setupFilterHandlers() {
        // Application et effacement des filtres
        window.applyFilters = () => {
            this.modules.tableManager.applyFilters();
        };

        window.clearFilters = () => {
            this.modules.tableManager.clearFilters();
        };

         window.showManualControlTypeSelection = () => {
        if (window.tableManager) {
            window.tableManager.showManualControlTypeSelection();
        } else {
            Utils.showNotification('TableManager non disponible', 'error');
        }
    };
    
         window.startManualControl = (controlType) => {
            if (window.tableManager) {
                window.tableManager.startManualControl(controlType);
            } else {
                Utils.showNotification('TableManager non disponible', 'error');
            }
        };
        
         window.pauseManualControl = () => {
            if (window.documentController) {
                window.documentController.pauseManualControl();
            } else {
                Utils.showNotification('DocumentController non disponible', 'error');
            }
        };
        
         window.cancelManualControl = () => {
            if (window.documentController) {
                window.documentController.cancelManualControl();
            } else {
                Utils.showNotification('DocumentController non disponible', 'error');
            }
        };
        
         window.exportAllManualResults = () => {
            if (window.documentController) {
                window.documentController.exportAllManualResults();
            } else {
                Utils.showNotification('DocumentController non disponible', 'error');
            }
        };
        
         window.exportSingleManualResult = (index) => {
            if (window.documentController) {
                window.documentController.exportSingleManualResult(index);
            } else {
                Utils.showNotification('DocumentController non disponible', 'error');
            }
        };
    }

    setupSelectionHandlers() {
        // Gestion de la sélection des dossiers
        window.toggleSelectAll = () => {
            this.modules.tableManager.toggleSelectAll();
        };

        window.clearSelection = () => {
            this.modules.tableManager.clearSelection();
        };

        // La fonction toggleDossierSelection est gérée directement dans TableManager
        // via window.tableManager?.toggleDossierSelection()
    }

    setupExportHandlers() {
        // Export des résultats
        window.downloadResults = () => {
            this.modules.tableManager.downloadResults();
        };
    }

    setupDebugHandlers() {
        // Fonctions de debug
        window.toggleDebug = () => {
            Utils.toggleDebug();
        };
    }

    setupHistoryHandlers() {
        window.showHistory = () => {
            if (window.historyInterface) {
                window.historyInterface.show();
            } else {
                Utils.showNotification('Interface historique non disponible', 'error');
            }
        };
    }

    // Méthodes utilitaires pour les autres modules
    getModule(moduleName) {
        return this.modules[moduleName];
    }

    getAllModules() {
        return this.modules;
    }

    // Gestion des événements personnalisés entre modules
    setupCustomEvents() {
        // Vos événements existants (ne pas toucher)
        window.addEventListener('fileReset', () => {
            Utils.debugLog('Événement fileReset reçu');
            if (this.modules.dataProcessor) {
                this.modules.dataProcessor.reset();
            }
            if (this.modules.tableManager) {
                this.modules.tableManager.reset();
            }
        });

        window.addEventListener('dataProcessed', (e) => {
            Utils.debugLog('Événement dataProcessed reçu dans main.js');
            
            const localDP = this.modules.dataProcessor;
            const globalDP = window.dataProcessor;
            
            if (localDP !== globalDP) {
                Utils.debugLog('ATTENTION: Instance locale différente de l\'instance globale');
                Utils.debugLog(`Local: ${localDP.getAllDossiers().length}, Global: ${globalDP.getAllDossiers().length}`);
                
                if (localDP.getAllDossiers().length > 0 && globalDP.getAllDossiers().length === 0) {
                    Utils.debugLog('Synchronisation des instances...');
                    window.dataProcessor = localDP;
                    this.modules.dataProcessor = localDP;
                }
            }
        });

        window.addEventListener('controlLaunched', (e) => {
            Utils.debugLog('Événement controlLaunched reçu');
        });

        window.addEventListener('manualControlLaunched', (e) => {
            Utils.debugLog('Événement manualControlLaunched reçu');
        });

        // événement pour le contrôle manuel
        window.addEventListener('manualControlStarted', (e) => {
            Utils.debugLog('Événement manualControlStarted reçu dans main.js');
            Utils.debugLog(`Contrôle manuel démarré: ${e.detail.controlType}, ${e.detail.dossiersCount} dossiers`);
        });

        window.addEventListener('manualControlCompleted', (e) => {
            Utils.debugLog('Événement manualControlCompleted reçu dans main.js');
            Utils.debugLog(`Contrôle manuel terminé: ${e.detail.completedDossiers} dossiers`);
            
            // Optionnel: Notification utilisateur
            Utils.showNotification(
                `Contrôle manuel terminé avec succès ! ${e.detail.completedDossiers} dossier(s) contrôlé(s)`, 
                'success'
            );
        });

        window.addEventListener('manualControlProgress', (e) => {
            Utils.debugLog(`Progression contrôle manuel: ${e.detail.current}/${e.detail.total}`);
        });
    }

    // Méthodes de gestion d'état global
    getAppState() {
        return {
            hasFile: !!this.modules.fileHandler.getCurrentFile(),
            hasData: this.modules.dataProcessor.getAllDossiers().length > 0,
            selectedCount: this.modules.tableManager.getSelectedDossiers().length,
            currentControl: this.modules.controlTypes.getCurrentControl()
        };
    }

    // Méthode pour diagnostiquer l'état de l'application
    diagnose() {
        const state = this.getAppState();
        
        Utils.debugLog('=== DIAGNOSTIC APPLICATION ===');
        Utils.debugLog(`Fichier chargé: ${state.hasFile}`);
        Utils.debugLog(`Données traitées: ${state.hasData}`);
        Utils.debugLog(`Dossiers sélectionnés: ${state.selectedCount}`);
        Utils.debugLog(`Contrôle en cours: ${state.currentControl ? state.currentControl.type : 'Aucun'}`);
        
        // Diagnostics des modules
        Object.entries(this.modules).forEach(([name, module]) => {
            Utils.debugLog(`Module ${name}: ${module ? 'Initialisé' : 'Non initialisé'}`);
        });
        
        // Diagnostic spécifique DataProcessor
        if (this.modules.dataProcessor) {
            const allDossiers = this.modules.dataProcessor.getAllDossiers();
            Utils.debugLog(`DataProcessor local: ${allDossiers.length} dossiers`);
        }
        
        if (window.dataProcessor) {
            const allDossiers = window.dataProcessor.getAllDossiers();
            Utils.debugLog(`DataProcessor global: ${allDossiers.length} dossiers`);
        }
        
        return state;
    }

    // Fonction spécifique pour débugger les données
    debugData() {
        Utils.debugLog('=== DEBUG DONNÉES ===');
        
        const localDP = this.modules.dataProcessor;
        const globalDP = window.dataProcessor;
        
        Utils.debugLog(`Instance locale === Instance globale: ${localDP === globalDP}`);
        
        if (localDP) {
            Utils.debugLog(`DataProcessor local.allDossiers: ${localDP.allDossiers ? localDP.allDossiers.length : 'undefined'}`);
            Utils.debugLog(`DataProcessor local.filteredDossiers: ${localDP.filteredDossiers ? localDP.filteredDossiers.length : 'undefined'}`);
        }
        
        if (globalDP) {
            Utils.debugLog(`DataProcessor global.allDossiers: ${globalDP.allDossiers ? globalDP.allDossiers.length : 'undefined'}`);
            Utils.debugLog(`DataProcessor global.filteredDossiers: ${globalDP.filteredDossiers ? globalDP.filteredDossiers.length : 'undefined'}`);
        }
        
        if (window.tableManager) {
            Utils.debugLog(`TableManager.dataProcessor: ${window.tableManager.dataProcessor ? 'défini' : 'undefined'}`);
            if (window.tableManager.dataProcessor) {
                Utils.debugLog(`TableManager.dataProcessor === global: ${window.tableManager.dataProcessor === globalDP}`);
            }
        }
    }

    // Fonction pour forcer la synchronisation
    forceSync() {
        Utils.debugLog('=== SYNCHRONISATION FORCÉE ===');
        
        const localDP = this.modules.dataProcessor;
        if (localDP && localDP.getAllDossiers().length > 0) {
            Utils.debugLog(`Synchronisation: ${localDP.getAllDossiers().length} dossiers`);
            window.dataProcessor = localDP;
            
            // Forcer le TableManager à récupérer les bonnes données
            if (window.tableManager) {
                window.tableManager.dataProcessor = localDP;
                window.tableManager.populateFilters();
                window.tableManager.loadDossiersTable();
            }
            
            Utils.debugLog('Synchronisation terminée');
        }
    }
}

// Initialisation de l'application au chargement du DOM
document.addEventListener('DOMContentLoaded', () => {
    window.app = new DocumentControlApp();
    
    // Exposer quelques méthodes utiles globalement
    window.diagnoseApp = () => window.app.diagnose();
    window.debugData = () => window.app.debugData();
    window.forceSync = () => window.app.forceSync();
    window.getAppState = () => window.app.getAppState();
    
    Utils.debugLog('Application Document Control démarrée');
});

// Gestion des erreurs globales
window.addEventListener('error', (e) => {
    console.error('Erreur globale:', e.error);
    Utils.debugLog('ERREUR: ' + e.error.message);
});

window.addEventListener('unhandledrejection', (e) => {
    console.error('Promesse rejetée:', e.reason);
    Utils.debugLog('PROMESSE REJETÉE: ' + e.reason);
});

// Export pour utilisation en module
export default DocumentControlApp;
