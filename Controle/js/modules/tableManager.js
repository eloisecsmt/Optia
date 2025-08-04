// tableManager.js - Gestion des tableaux, filtres et sélections

import { Utils } from './utils.js';

export class TableManager {
    constructor() {
        this.selectedDossiers = [];
        this.dataProcessor = null;
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Écouter les données traitées
        window.addEventListener('dataProcessed', (e) => {
            Utils.debugLog('TableManager: Réception événement dataProcessed');
            
            // Récupérer le dataProcessor depuis l'événement ET depuis window
            this.dataProcessor = window.dataProcessor;
            
            Utils.debugLog(`TableManager: DataProcessor récupéré: ${this.dataProcessor ? 'OK' : 'NON'}`);
            
            if (this.dataProcessor) {
                const allDossiers = this.dataProcessor.getAllDossiers();
                Utils.debugLog(`TableManager: ${allDossiers.length} dossiers trouvés`);
                
                if (allDossiers.length > 0) {
                    this.populateFilters();
                    
                    // Charger le tableau seulement si on est dans la bonne section
                    const currentSection = document.querySelector('.content-section.active');
                    if (currentSection && currentSection.id === 'dossier-selection-section') {
                        this.loadDossiersTable();
                    }
                } else {
                    Utils.debugLog('TableManager: Dossiers vides dans DataProcessor');
                }
            } else {
                Utils.debugLog('TableManager: DataProcessor non trouvé dans window');
            }
        });

        // Écouter la réinitialisation des fichiers
        window.addEventListener('fileReset', () => {
            this.reset();
        });

        // NOUVEAU : Écouter les contrôles suspendus pour rafraîchir l'affichage
        window.addEventListener('controlSuspended', (e) => {
            Utils.debugLog('TableManager: Contrôle suspendu détecté');
            
            // Rafraîchir le tableau si visible
            if (document.getElementById('dossier-selection-section').classList.contains('active')) {
                setTimeout(() => {
                    this.loadDossiersTable();
                }, 1000);
            }
        });

        // Configuration de la recherche en temps réel
        const searchInput = document.getElementById('filter-search');
        if (searchInput) {
            searchInput.addEventListener('input', () => {
                if (searchInput.value.length > 2 || searchInput.value.length === 0) {
                    this.applyFilters();
                }
            });
        }
    }

    populateFilters() {
        Utils.debugLog('=== INITIALISATION FILTRES ===');
        
        if (!this.dataProcessor) {
            Utils.debugLog('TableManager: Pas de dataProcessor disponible pour les filtres');
            return;
        }

        const allDossiers = this.dataProcessor.getAllDossiers();
        if (!allDossiers || allDossiers.length === 0) {
            Utils.debugLog('TableManager: Aucun dossier disponible pour les filtres');
            return;
        }

        // Obtenir les valeurs uniques pour les filtres directement
        const conseillers = [...new Set(
            allDossiers
                .map(d => d.conseiller)
                .filter(c => c && c.trim() !== '' && c.trim() !== '-')
        )].sort();
        
        const domaines = [...new Set(
            allDossiers
                .map(d => d.domaine)
                .filter(d => d && d.trim() !== '' && d.trim() !== '-')
        )].sort();
        
        Utils.debugLog(`Conseillers trouvés: ${conseillers.length} - ${conseillers.slice(0, 5).join(', ')}${conseillers.length > 5 ? '...' : ''}`);
        Utils.debugLog(`Domaines trouvés: ${domaines.length} - ${domaines.slice(0, 5).join(', ')}${domaines.length > 5 ? '...' : ''}`);
        
        // Remplir le filtre conseiller
        this.populateSelectFilter('filter-conseiller', conseillers, 'Tous les conseillers', 'Aucun conseiller trouvé');
        
        // Remplir le filtre domaine
        this.populateSelectFilter('filter-domaine', domaines, 'Tous les domaines', 'Aucun domaine trouvé');
    }

    populateSelectFilter(selectId, options, defaultText, emptyText) {
        const select = document.getElementById(selectId);
        if (!select) return;

        select.innerHTML = `<option value="">${defaultText}</option>`;
        
        if (options.length > 0) {
            options.forEach(option => {
                const optionElement = document.createElement('option');
                optionElement.value = option;
                optionElement.textContent = option;
                select.appendChild(optionElement);
            });
        } else {
            const optionElement = document.createElement('option');
            optionElement.value = '';
            optionElement.textContent = emptyText;
            optionElement.disabled = true;
            select.appendChild(optionElement);
        }
    }

    loadDossiersTable() {
        Utils.debugLog('=== CHARGEMENT TABLEAU AVEC STATUTS ===');
        
        if (!this.dataProcessor) return;

        const filteredDossiers = this.dataProcessor.getFilteredDossiers();
        Utils.debugLog(`Dossiers filtrés: ${filteredDossiers.length}`);
        
        const tbody = document.getElementById('dossiers-table-body');
        if (!tbody) return;

        tbody.innerHTML = '';

        if (filteredDossiers.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="12" style="text-align: center; padding: 40px; color: #6c757d;">
                        Aucun dossier trouvé avec les filtres actuels
                    </td>
                </tr>
            `;
            return;
        }

        // NOUVEAU : Statistiques des dossiers
        let controlledCount = 0;
        let suspendedCount = 0;

        filteredDossiers.forEach((dossier, index) => {
            const row = document.createElement('tr');
            const isSelected = this.selectedDossiers.includes(dossier.originalIndex);
            
            // Vérifier les statuts
            const statuses = this.getDossierStatuses(dossier);
            const hasControlled = Object.values(statuses).some(s => s.status === 'controlled');
            const hasSuspended = Object.values(statuses).some(s => s.status === 'suspended');
            
            if (hasControlled) controlledCount++;
            if (hasSuspended) suspendedCount++;
            
            if (isSelected) {
                row.classList.add('selected');
            }
            
            // Ajouter classes pour les dossiers contrôlés/suspendus
            if (hasControlled) {
                row.classList.add('row-controlled');
            }
            if (hasSuspended) {
                row.classList.add('row-suspended');
            }
            
            row.innerHTML = this.generateTableRow(dossier, isSelected);
            tbody.appendChild(row);
        });

        // NOUVEAU : Afficher les statistiques
        this.updateTableStatistics(filteredDossiers.length, controlledCount, suspendedCount);

        this.updateSelectAllCheckbox();
        Utils.debugLog(`Tableau chargé: ${filteredDossiers.length} dossiers (${controlledCount} contrôlés, ${suspendedCount} suspendus)`);
    }

    // NOUVEAU : Obtenir les statuts d'un dossier pour tous les types de contrôle
    getDossierStatuses(dossier) {
        if (!window.documentController) return {};
        
        const dossierKey = window.documentController.generateDossierKey(dossier);
        const controlTypes = ['LCB-FT', 'FINANCEMENT', 'CARTO_CLIENT', 'OPERATION', 'NOUVEAU_CLIENT'];
        const statuses = {};
        
        controlTypes.forEach(type => {
            if (window.persistenceManager) {
                statuses[type] = window.persistenceManager.getDossierStatus(dossierKey, type);
            } else {
                statuses[type] = { status: 'not_controlled' };
            }
        });
        
        return statuses;
    }

    // NOUVEAU : Générer les badges de statut
    generateStatusBadges(statuses) {
        const badges = [];
        
        Object.entries(statuses).forEach(([type, status]) => {
            if (status.status === 'controlled') {
                badges.push(`<span class="badge controlled" title="Contrôlé le ${new Date(status.controlledAt).toLocaleDateString('fr-FR')}">${this.getShortControlType(type)} ✓</span>`);
            } else if (status.status === 'suspended') {
                const daysSuspended = Math.floor((new Date() - new Date(status.suspendedAt)) / (1000 * 60 * 60 * 24));
                badges.push(`<span class="badge suspended" title="Suspendu depuis ${daysSuspended} jour(s)${status.suspendReason ? ': ' + status.suspendReason : ''}">${this.getShortControlType(type)} ⏸️</span>`);
            }
        });
        
        return badges.join(' ');
    }

    // NOUVEAU : Obtenir le nom court du type de contrôle
    getShortControlType(type) {
        const shortNames = {
            'LCB-FT': 'LCB',
            'FINANCEMENT': 'FIN',
            'CARTO_CLIENT': 'CARTO',
            'OPERATION': 'OP',
            'NOUVEAU_CLIENT': 'NC'
        };
        return shortNames[type] || type.substring(0, 3);
    }

    generateTableRow(dossier, isSelected) {
        const dossierStatuses = this.getDossierStatuses(dossier);
        const hasAnyControl = Object.values(dossierStatuses).some(status => status.status !== 'not_controlled');
        
        // Classes CSS selon le statut
        let rowClasses = '';
        let statusBadges = '';
        
        if (hasAnyControl) {
            rowClasses = 'row-controlled';
            statusBadges = this.generateStatusBadges(dossierStatuses);
        }
        
         return `
            <td>
                <div class="checkbox-container">
                    <div class="checkbox ${isSelected ? 'checked' : ''}" 
                         onclick="window.tableManager?.toggleDossierSelection(${dossier.originalIndex})"></div>
                </div>
            </td>
            <td class="${hasAnyControl ? 'controlled-cell' : ''}">
                <strong>${dossier.client || 'Client non spécifié'}</strong>
                ${dossier.reference ? `<br><small>Réf: ${dossier.reference}</small>` : ''}
                ${statusBadges ? `<br>${statusBadges}` : ''}
            </td>
            <td class="${hasAnyControl ? 'controlled-cell' : ''}">${Utils.displayValue(dossier.codeDossier, 'N/A')}</td>
            <td class="${hasAnyControl ? 'controlled-cell' : ''}">${Utils.displayValue(dossier.assistantBO, 'Non assigné')}</td>
            <td class="${hasAnyControl ? 'controlled-cell' : ''}">${Utils.displayValue(dossier.conseiller, 'Non assigné')}</td>
            <td class="${hasAnyControl ? 'controlled-cell' : ''}">${dossier.domaine ? `<span class="badge ${Utils.getBadgeClass(dossier.domaine)}">${dossier.domaine}</span>` : Utils.displayValue('', 'Non défini')}</td>
            <td class="${hasAnyControl ? 'controlled-cell' : ''}">
                ${Utils.displayValue(dossier.contrat, 'Non spécifié')}
                ${dossier.fournisseur ? `<br><small>${dossier.fournisseur}</small>` : ''}
            </td>
            <td class="${hasAnyControl ? 'controlled-cell' : ''}">${Utils.displayValue(dossier.typeActe, 'Non défini')}</td>
            <td class="${hasAnyControl ? 'controlled-cell' : ''}">${dossier.montant ? `<strong>${dossier.montant}</strong>` : Utils.displayValue('', 'N/A')}</td>
            <td class="${hasAnyControl ? 'controlled-cell' : ''}">${Utils.displayValue(dossier.etatBO, 'Non défini')}</td>
            <td class="${hasAnyControl ? 'controlled-cell' : ''}">${dossier.nouveauClient ? `<span class="badge ${dossier.nouveauClient.toLowerCase()}">${dossier.nouveauClient}</span>` : Utils.displayValue('', 'N/A')}</td>
            <td class="${hasAnyControl ? 'controlled-cell' : ''}">${dossier.ppe && dossier.ppe.toLowerCase() === 'oui' ? '<span class="badge oui">PPE</span>' : Utils.displayValue('', 'Non')}</td>
        `;
    }

    toggleDossierSelection(originalIndex) {
        const checkbox = event.target;
        const row = checkbox.closest('tr');
        
        if (this.selectedDossiers.includes(originalIndex)) {
            this.selectedDossiers = this.selectedDossiers.filter(id => id !== originalIndex);
            checkbox.classList.remove('checked');
            row.classList.remove('selected');
        } else {
            this.selectedDossiers.push(originalIndex);
            checkbox.classList.add('checked');
            row.classList.add('selected');
        }
        
        this.updateSelectionSummary();
        this.updateSelectAllCheckbox();
    }

    toggleSelectAll() {
        if (!this.dataProcessor) return;

        const allCheckbox = document.getElementById('select-all-checkbox');
        const filteredDossiers = this.dataProcessor.getFilteredDossiers();
        const visibleIndices = filteredDossiers.map(d => d.originalIndex);
        const allVisibleSelected = visibleIndices.every(index => this.selectedDossiers.includes(index));
        
        if (allVisibleSelected) {
            // Désélectionner tous les visibles
            this.selectedDossiers = this.selectedDossiers.filter(id => !visibleIndices.includes(id));
            allCheckbox.classList.remove('checked');
        } else {
            // Sélectionner tous les visibles
            visibleIndices.forEach(index => {
                if (!this.selectedDossiers.includes(index)) {
                    this.selectedDossiers.push(index);
                }
            });
            allCheckbox.classList.add('checked');
        }
        
        this.loadDossiersTable(); // Rafraîchir pour mettre à jour les checkboxes
        this.updateSelectionSummary();
    }

    updateSelectAllCheckbox() {
        if (!this.dataProcessor) return;

        const allCheckbox = document.getElementById('select-all-checkbox');
        if (!allCheckbox) return;

        const filteredDossiers = this.dataProcessor.getFilteredDossiers();
        const visibleIndices = filteredDossiers.map(d => d.originalIndex);
        const allVisibleSelected = visibleIndices.length > 0 && visibleIndices.every(index => this.selectedDossiers.includes(index));
        
        if (allVisibleSelected) {
            allCheckbox.classList.add('checked');
        } else {
            allCheckbox.classList.remove('checked');
        }
    }

    updateSelectionSummary() {
        const summary = document.getElementById('selection-summary');
        const countSpan = document.getElementById('selected-count');
        
        if (countSpan) {
            countSpan.textContent = this.selectedDossiers.length;
        }
        
        if (summary) {
            if (this.selectedDossiers.length > 0) {
                summary.classList.add('active');
            } else {
                summary.classList.remove('active');
            }
        }
    }

    clearSelection() {
        this.selectedDossiers = [];
        this.loadDossiersTable();
        this.updateSelectionSummary();
    }

    applyFilters() {
        Utils.debugLog('=== APPLICATION FILTRES ===');
        
        if (!this.dataProcessor) return;

        const conseillerEl = document.getElementById('filter-conseiller');
        const domaineEl = document.getElementById('filter-domaine');
        const nouveauEl = document.getElementById('filter-nouveau');
        const searchEl = document.getElementById('filter-search');

        const filters = {
            conseiller: conseillerEl ? conseillerEl.value : '',
            domaine: domaineEl ? domaineEl.value : '',
            nouveau: nouveauEl ? nouveauEl.value : '',
            search: searchEl ? searchEl.value.toLowerCase().trim() : ''
        };

        this.dataProcessor.applyFilters(filters);
        this.loadDossiersTable();
    }

    clearFilters() {
        const filterElements = [
            'filter-conseiller',
            'filter-domaine', 
            'filter-nouveau',
            'filter-search'
        ];

        filterElements.forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                element.value = '';
            }
        });
        
        if (this.dataProcessor) {
            // Réinitialiser les dossiers filtrés à tous les dossiers
            const allDossiers = this.dataProcessor.getAllDossiers();
            this.dataProcessor.setFilteredDossiers([...allDossiers]);
            this.loadDossiersTable();
        }
    }

    proceedToControl() {
        if (this.selectedDossiers.length === 0) {
            Utils.showNotification('Veuillez sélectionner au moins un dossier à contrôler.', 'error');
            return;
        }
        
        Utils.debugLog(`=== LANCEMENT CONTRÔLE MANUEL ===`);
        Utils.debugLog(`${this.selectedDossiers.length} dossiers sélectionnés`);
        
        // Navigation vers l'interface de choix du type de contrôle
        this.showManualControlTypeSelection();
    }

    downloadResults() {
        if (this.selectedDossiers.length === 0) {
            Utils.showNotification('Aucun dossier sélectionné pour l\'export.', 'error');
            return;
        }

        if (!this.dataProcessor) {
            Utils.showNotification('Aucune donnée disponible pour l\'export.', 'error');
            return;
        }

        // Obtenir les données des dossiers sélectionnés
        const allDossiers = this.dataProcessor.getAllDossiers();
        const selectedDossierData = allDossiers.filter(d => this.selectedDossiers.includes(d.originalIndex));
        
        // Créer les données d'export avec résultats de contrôle placeholder
        const exportData = selectedDossierData.map(dossier => ({
            'Client': dossier.client,
            'Code Dossier': dossier.codeDossier,
            'Assistant BO': dossier.assistantBO,
            'Conseiller': dossier.conseiller,
            'Nouveau Client': dossier.nouveauClient,
            'Domaine': dossier.domaine,
            'Fournisseur': dossier.fournisseur,
            'Contrat': dossier.contrat,
            'Référence': dossier.reference,
            'Type Acte': dossier.typeActe,
            'Montant': dossier.montant,
            'État BO': dossier.etatBO,
            'PPE': dossier.ppe,
            'Date Contrôle': new Date().toLocaleDateString('fr-FR'),
            'Contrôlé par': 'Utilisateur',
            'Statut Contrôle': 'Sélection manuelle',
            'Remarques': 'Export depuis sélection manuelle'
        }));

        const fileName = Utils.generateFileName('Selection_Manuelle');
        
        // Utiliser le FileHandler pour l'export
        if (window.fileHandler) {
            const success = window.fileHandler.exportToExcel(exportData, fileName);
            if (success) {
                Utils.showNotification(`Fichier "${fileName}" téléchargé avec ${selectedDossierData.length} dossier(s).`, 'success');
            }
        }
    }

    // Navigation entre sections
    showFileUpload() {
        Utils.showSection('file-upload-section');
    }

    showDossierSelection() {
        Utils.showSection('dossier-selection-section');
    }

    showAutomaticControls() {
        Utils.showSection('automatic-control-section');
    }

    proceedToSelection() {
        Utils.debugLog('=== DEMANDE NAVIGATION VERS SÉLECTION ===');
        
        // S'assurer qu'on a le dataProcessor
        if (!this.dataProcessor) {
            this.dataProcessor = window.dataProcessor;
        }
        
        if (!this.dataProcessor) {
            Utils.debugLog('Aucun dataProcessor disponible');
            Utils.showNotification('Aucun dossier trouvé dans le fichier', 'error');
            return;
        }
        
        const allDossiers = this.dataProcessor.getAllDossiers();
        Utils.debugLog(`DataProcessor contient: ${allDossiers.length} dossiers`);
        
        if (allDossiers.length === 0) {
            Utils.showNotification('Aucun dossier trouvé dans le fichier', 'error');
            return;
        }
        
        Utils.debugLog('=== NAVIGATION VERS SÉLECTION ===');
        Utils.debugLog(`${allDossiers.length} dossiers disponibles`);
        
        this.showDossierSelection();
        
        // Forcer la réinitialisation des filtres et du tableau
        setTimeout(() => {
            this.populateFilters();
            this.loadDossiersTable();
        }, 100);
    }

    showManualControlTypeSelection() {
    const selectedData = this.getSelectedDossiersData();
    
    if (selectedData.length === 0) {
        Utils.showNotification('Erreur: Aucun dossier sélectionné trouvé', 'error');
        return;
    }
    
    Utils.debugLog(`Affichage choix type contrôle pour ${selectedData.length} dossiers`);
    
    // Naviguer vers la nouvelle section
    Utils.showSection('manual-control-type-section');
    
    // Peupler l'interface
    this.populateManualControlTypeInterface(selectedData);
}

    populateManualControlTypeInterface(selectedDossiers) {
        // Mettre à jour le compteur
        const countElement = document.getElementById('manual-selected-count');
        if (countElement) {
            countElement.textContent = selectedDossiers.length;
        }
        
        // Générer la liste des dossiers sélectionnés
        this.generateSelectedDossiersList(selectedDossiers);
        
        // Générer les cartes de types de contrôle pour le manuel
        this.generateManualControlTypes(selectedDossiers);
    }

    generateSelectedDossiersList(selectedDossiers) {
        const container = document.getElementById('selected-dossiers-list');
        if (!container) return;
        
        container.innerHTML = selectedDossiers.map(dossier => `
            <div class="dossier-preview-card">
                <div class="dossier-preview-header">
                    ${dossier.client || 'Client non spécifié'}
                </div>
                <div class="dossier-preview-details">
                    <div class="detail"><strong>Code:</strong> ${dossier.codeDossier || 'N/A'}</div>
                    <div class="detail"><strong>Conseiller:</strong> ${dossier.conseiller || 'N/A'}</div>
                    <div class="detail"><strong>Montant:</strong> ${dossier.montant || 'N/A'}</div>
                    <div class="detail"><strong>Domaine:</strong> ${dossier.domaine || 'N/A'}</div>
                    ${dossier.nouveauClient && dossier.nouveauClient.toLowerCase() === 'oui' ? 
                        '<div class="detail"><span class="badge nouveau">⭐ Nouveau Client</span></div>' : ''}
                    ${dossier.ppe && dossier.ppe.toLowerCase() === 'oui' ? 
                        '<div class="detail"><span class="badge oui">PPE</span></div>' : ''}
                </div>
            </div>
        `).join('');
    }

    generateManualControlTypes(selectedDossiers) {
        const container = document.getElementById('manual-control-types-grid');
        if (!container) return;
        
        // Obtenir les définitions de contrôle depuis ControlTypes
        const controlDefinitions = window.controlTypes?.getControlDefinitions() || this.getDefaultControlDefinitions();
        
        container.innerHTML = Object.entries(controlDefinitions).map(([key, control]) => {
            const eligibleCount = this.countEligibleDossiers(selectedDossiers, control);
            const canProceed = eligibleCount >= Math.min(control.sampleSize, selectedDossiers.length);
            
            return `
                <div class="control-card ${canProceed ? '' : 'disabled'}">
                    <div class="control-header">
                        <h3 class="control-title">${control.name}</h3>
                        <span class="control-priority priority-${control.priority}">${control.priority.toUpperCase()}</span>
                    </div>
                    
                    <div class="control-description">
                        ${control.description}
                    </div>
                    
                    <div class="control-stats">
                        <div class="stat-item">
                            <span class="stat-value">${eligibleCount}</span>
                            <span class="stat-label">Dossiers éligibles</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-value">${selectedDossiers.length}</span>
                            <span class="stat-label">Sélectionnés</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-value">${control.frequency}</span>
                            <span class="stat-label">Fréquence</span>
                        </div>
                    </div>
                    
                    <div class="control-criteria">
                        <h4>Critères de ce contrôle :</h4>
                        <ul>
                            ${control.criteria.montantMinimum > 0 ? 
                                `<li>Montant ≥ ${control.criteria.montantMinimum.toLocaleString('fr-FR')} €</li>` : ''}
                            ${control.criteria.nouveauxClients ? 
                                '<li>Nouveaux clients uniquement</li>' : 
                                '<li>Tous types de clients</li>'}
                            <li>Documents requis : ${control.criteria.requiredDocuments.length} types</li>
                        </ul>
                    </div>
                    
                    <button class="btn ${canProceed ? 'btn-manual-start' : 'btn-secondary'}" 
                            onclick="window.tableManager?.startManualControl('${key}')"
                            ${canProceed ? '' : 'disabled'}>
                        ${canProceed ? 
                            `🚀 Contrôler ${selectedDossiers.length} dossier(s)` : 
                            `❌ Critères non remplis (${eligibleCount}/${selectedDossiers.length})`
                        }
                    </button>
                </div>
            `;
        }).join('');
    }

    countEligibleDossiers(dossiers, controlCriteria) {
        return dossiers.filter(dossier => {
            // Critère montant minimum
            if (controlCriteria.criteria.montantMinimum > 0) {
                const montantValue = this.extractNumericAmount(dossier.montant);
                if (montantValue < controlCriteria.criteria.montantMinimum) return false;
            }

            // Critère nouveaux clients
            if (controlCriteria.criteria.nouveauxClients) {
                if (!dossier.nouveauClient || dossier.nouveauClient.toLowerCase() !== 'oui') return false;
            }

            return true;
        }).length;
    }

    extractNumericAmount(montantString) {
        if (!montantString) return 0;
        
        const cleaned = montantString.toString()
            .replace(/[^\d,.-]/g, '')
            .replace(/,/g, '.');
        
        const number = parseFloat(cleaned);
        return isNaN(number) ? 0 : number;
    }

    startManualControl(controlType) {
        const selectedData = this.getSelectedDossiersData();
        
        if (selectedData.length === 0) {
            Utils.showNotification('Erreur: Aucun dossier sélectionné', 'error');
            return;
        }
        
        Utils.debugLog(`=== DÉBUT CONTRÔLE MANUEL ${controlType} ===`);
        Utils.debugLog(`${selectedData.length} dossiers à contrôler`);
        
        // Déclencher le contrôle manuel via DocumentController
        if (window.documentController) {
            window.documentController.startManualControl(selectedData, controlType);
        } else {
            Utils.showNotification('Erreur: DocumentController non disponible', 'error');
            Utils.debugLog('DocumentController non trouvé dans window');
        }
    }

    getDefaultControlDefinitions() {
        // Définitions de base au cas où ControlTypes ne serait pas disponible
        return {
            'LCB-FT': {
                name: 'LCB-FT',
                description: 'Contrôle Lutte Contre le Blanchiment et Financement du Terrorisme',
                frequency: 'Mensuel',
                sampleSize: 5,
                priority: 'high',
                criteria: {
                    requiredDocuments: ['CNI', 'Justificatif domicile', 'FR', 'Origine des fonds'],
                    montantMinimum: 10000,
                    nouveauxClients: false
                }
            },
            'NOUVEAU_CLIENT': {
                name: 'Nouveau Client',
                description: 'Contrôle spécifique des nouveaux clients',
                frequency: 'Hebdomadaire',
                sampleSize: 6,
                priority: 'high',
                criteria: {
                    requiredDocuments: ['CNI', 'Justificatif domicile', 'FR', 'Profil Risques', 'Profil ESG'],
                    montantMinimum: 0,
                    nouveauxClients: true
                }
            },
            'FINANCEMENT': {
                name: 'Financement',
                description: 'Contrôle des dossiers de financement et crédits',
                frequency: 'Hebdomadaire',
                sampleSize: 8,
                priority: 'medium',
                criteria: {
                    requiredDocuments: ['FR', 'Profil Risques', 'Etude', 'RIB'],
                    montantMinimum: 50000,
                    nouveauxClients: false
                }
            },
            'CARTO_CLIENT': {
                name: 'Carto Client',
                description: 'Cartographie et classification des clients',
                frequency: 'Trimestriel',
                sampleSize: 10,
                priority: 'medium',
                criteria: {
                    requiredDocuments: ['Harvest'],
                    montantMinimum: 0,
                    nouveauxClients: false
                }
            },
            'OPERATION': {
                name: 'Opération',
                description: 'Contrôle des opérations et transactions clients',
                frequency: 'Hebdomadaire',
                sampleSize: 12,
                priority: 'high',
                criteria: {
                    requiredDocuments: [
                        'FR', 
                        'Profil Risques', 
                        'Harvest', 
                        'LM Entrée en Relation', 
                        'RIB', 
                        'Convention RTO', 
                        'Carto Opération', 
                        'Origine/Destination des fonds'
                    ],
                    montantMinimum: 5000,
                    nouveauxClients: false
                }
            }
        };
    }

    // NOUVEAU : Créer le conteneur de statistiques s'il n'existe pas
    getOrCreateStatsContainer() {
        let statsContainer = document.getElementById('table-statistics');
        
        if (!statsContainer) {
            statsContainer = document.createElement('div');
            statsContainer.id = 'table-statistics';
            statsContainer.className = 'table-statistics-container';
            
            const tableContainer = document.querySelector('.table-container');
            if (tableContainer) {
                tableContainer.parentNode.insertBefore(statsContainer, tableContainer);
            }
        }
        
        return statsContainer;
    }

    // NOUVEAU : Afficher l'interface des contrôles suspendus
    showSuspendedControls() {
        if (!window.persistenceManager) {
            Utils.showNotification('Gestionnaire de persistance non disponible', 'error');
            return;
        }
        
        const suspendedControls = window.persistenceManager.getSuspendedControls();
        
        if (suspendedControls.length === 0) {
            Utils.showNotification('Aucun contrôle suspendu', 'info');
            return;
        }
        
        this.createSuspendedControlsModal(suspendedControls);
    }

    // NOUVEAU : Créer la modal des contrôles suspendus
    createSuspendedControlsModal(suspendedControls) {
        const modal = document.createElement('div');
        modal.className = 'justification-modal';
        modal.id = 'suspended-controls-modal';
        
        modal.innerHTML = `
            <div class="modal-overlay" onclick="window.tableManager?.closeSuspendedModal()">
                <div class="modal-content suspended-modal" onclick="event.stopPropagation();" style="max-width: 90vw; width: 1200px; max-height: 80vh;">
                    <div class="modal-header">
                        <h3>⏸️ Contrôles Suspendus (${suspendedControls.length})</h3>
                        <button class="btn btn-sm btn-secondary" onclick="window.tableManager?.closeSuspendedModal()">❌</button>
                    </div>
                    
                    <div class="suspended-stats">
                        ${this.generateSuspendedStats(suspendedControls)}
                    </div>
                    
                    <div class="suspended-table-container">
                        <table class="suspended-table">
                            <thead>
                                <tr>
                                    <th>📅 Suspendu le</th>
                                    <th>🔍 Type</th>
                                    <th>👤 Client</th>
                                    <th>📋 Code</th>
                                    <th>👨‍💼 Conseiller</th>
                                    <th>💰 Montant</th>
                                    <th>📄 Progress</th>
                                    <th>⏰ Durée</th>
                                    <th>📝 Raison</th>
                                    <th>🔧 Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${this.generateSuspendedRows(suspendedControls)}
                            </tbody>
                        </table>
                    </div>
                    
                    <div class="modal-actions">
                        <button class="btn btn-primary" onclick="window.persistenceManager?.exportSuspendedControls()">
                            📊 Exporter la liste
                        </button>
                        <button class="btn btn-warning" onclick="window.tableManager?.cleanOldSuspended()">
                            🧹 Nettoyer anciens (90j+)
                        </button>
                        <button class="btn btn-secondary" onclick="window.tableManager?.closeSuspendedModal()">
                            ❌ Fermer
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
    }

    // NOUVEAU : Générer les statistiques des contrôles suspendus
    generateSuspendedStats(suspendedControls) {
        const stats = this.calculateSuspendedStats(suspendedControls);
        
        return `
            <div class="suspended-stats-grid">
                <div class="stat-card">
                    <div class="stat-icon">📊</div>
                    <div class="stat-value">${stats.total}</div>
                    <div class="stat-label">Total suspendus</div>
                </div>
                <div class="stat-card ${stats.oldCount > 0 ? 'warning' : ''}">
                    <div class="stat-icon">⚠️</div>
                    <div class="stat-value">${stats.oldCount}</div>
                    <div class="stat-label">Anciens (14j+)</div>
                </div>
                <div class="stat-card ${stats.veryOldCount > 0 ? 'danger' : ''}">
                    <div class="stat-icon">🚨</div>
                    <div class="stat-value">${stats.veryOldCount}</div>
                    <div class="stat-label">Très anciens (30j+)</div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon">🔍</div>
                    <div class="stat-value">${stats.mostFrequentType}</div>
                    <div class="stat-label">Type le plus fréquent</div>
                </div>
            </div>
        `;
    }

    // NOUVEAU : Calculer les statistiques des suspendus
    calculateSuspendedStats(suspendedControls) {
        const now = new Date();
        let oldCount = 0;
        let veryOldCount = 0;
        const typeCount = {};
        
        suspendedControls.forEach(control => {
            const daysSuspended = Math.floor((now - new Date(control.suspendedAt)) / (1000 * 60 * 60 * 24));
            
            if (daysSuspended >= 14) oldCount++;
            if (daysSuspended >= 30) veryOldCount++;
            
            typeCount[control.type] = (typeCount[control.type] || 0) + 1;
        });
        
        const mostFrequentType = Object.entries(typeCount)
            .sort(([,a], [,b]) => b - a)[0]?.[0] || 'Aucun';
        
        return {
            total: suspendedControls.length,
            oldCount,
            veryOldCount,
            mostFrequentType
        };
    }

    // NOUVEAU : Générer les lignes du tableau des suspendus
    generateSuspendedRows(suspendedControls) {
        return suspendedControls.map(control => {
            const daysSuspended = Math.floor((new Date() - new Date(control.suspendedAt)) / (1000 * 60 * 60 * 24));
            const questionsCount = Object.keys(control.responses || {}).length;
            const totalDocs = Object.keys(control.documents || {}).length;
            
            let ageClass = '';
            if (daysSuspended >= 30) ageClass = 'very-old';
            else if (daysSuspended >= 14) ageClass = 'old';
            
            return `
                <tr class="suspended-row ${ageClass}">
                    <td><strong>${new Date(control.suspendedAt).toLocaleDateString('fr-FR')}</strong></td>
                    <td><span class="badge control-type">${control.type}</span></td>
                    <td><strong>${control.dossier.client}</strong></td>
                    <td>${control.dossier.codeDossier || 'N/A'}</td>
                    <td>${control.dossier.conseiller || 'N/A'}</td>
                    <td>${control.dossier.montant || 'N/A'}</td>
                    <td><span class="progress-badge">${questionsCount} Q / ${totalDocs} Docs</span></td>
                    <td><span class="duration-badge ${ageClass}">${daysSuspended}j</span></td>
                    <td class="reason-cell">${control.suspendReason || 'Non spécifiée'}</td>
                    <td class="actions-cell">
                        <button class="btn btn-sm btn-primary" 
                                onclick="window.tableManager?.resumeSuspendedControl('${control.id}')"
                                title="Reprendre le contrôle">
                            🔄 Reprendre
                        </button>
                        <button class="btn btn-sm btn-danger" 
                                onclick="window.tableManager?.deleteSuspendedControl('${control.id}')"
                                title="Supprimer définitivement">
                            🗑️
                        </button>
                    </td>
                </tr>
            `;
        }).join('');
    }

    // NOUVEAU : Reprendre un contrôle suspendu depuis la liste
    resumeSuspendedControl(controlId) {
        const suspendedControl = window.persistenceManager?.getSuspendedControlById(controlId);
        if (!suspendedControl) {
            Utils.showNotification('Contrôle suspendu introuvable', 'error');
            return;
        }
        
        // Fermer la modal
        this.closeSuspendedModal();
        
        // Préparer les données pour DocumentController
        if (window.documentController) {
            window.documentController.currentDossier = suspendedControl.dossier;
            window.documentController.currentControl = suspendedControl.control;
            window.documentController.resumeControl(controlId);
        } else {
            Utils.showNotification('DocumentController non disponible', 'error');
        }
    }

    // NOUVEAU : Supprimer un contrôle suspendu
    deleteSuspendedControl(controlId) {
        const suspendedControl = window.persistenceManager?.getSuspendedControlById(controlId);
        if (!suspendedControl) {
            Utils.showNotification('Contrôle suspendu introuvable', 'error');
            return;
        }
        
        const confirmed = confirm(
            `Êtes-vous sûr de vouloir supprimer définitivement le contrôle suspendu ?\n\n` +
            `Client: ${suspendedControl.dossier.client}\n` +
            `Type: ${suspendedControl.type}\n` +
            `Suspendu le: ${new Date(suspendedControl.suspendedAt).toLocaleDateString('fr-FR')}\n\n` +
            `Cette action est irréversible !`
        );
        
        if (confirmed) {
            // Supprimer le contrôle suspendu
            const dossierKey = window.documentController?.generateDossierKey(suspendedControl.dossier);
            if (dossierKey && window.persistenceManager?.removeSuspendedControl(dossierKey, suspendedControl.type)) {
                Utils.showNotification('Contrôle suspendu supprimé', 'success');
                
                // Rafraîchir la modal
                this.closeSuspendedModal();
                setTimeout(() => this.showSuspendedControls(), 500);
                
                // Rafraîchir le tableau principal si visible
                if (document.getElementById('dossier-selection-section').classList.contains('active')) {
                    this.loadDossiersTable();
                }
            } else {
                Utils.showNotification('Erreur lors de la suppression', 'error');
            }
        }
    }

    // NOUVEAU : Nettoyer les contrôles suspendus anciens
    cleanOldSuspended() {
        if (!window.persistenceManager) return;
        
        const confirmed = confirm(
            'Supprimer tous les contrôles suspendus depuis plus de 90 jours ?\n\n' +
            'Cette action est irréversible !'
        );
        
        if (confirmed) {
            const cleanedCount = window.persistenceManager.cleanOldSuspendedControls(90);
            
            if (cleanedCount > 0) {
                Utils.showNotification(`${cleanedCount} ancien(s) contrôle(s) suspendu(s) supprimé(s)`, 'success');
                
                // Rafraîchir la modal
                this.closeSuspendedModal();
                setTimeout(() => this.showSuspendedControls(), 500);
            } else {
                Utils.showNotification('Aucun contrôle ancien à supprimer', 'info');
            }
        }
    }

    // NOUVEAU : Fermer la modal des contrôles suspendus
    closeSuspendedModal() {
        const modal = document.getElementById('suspended-controls-modal');
        if (modal) {
            modal.remove();
        }
    }

    addSuspendedControlsButton() {
        // Chercher une zone appropriée pour ajouter le bouton
        const filtersSection = document.querySelector('.filters-section');
        if (!filtersSection) return;
        
        // Vérifier si le bouton existe déjà
        if (document.getElementById('suspended-controls-btn')) return;
        
        const btnGroup = filtersSection.querySelector('.btn-group');
        if (btnGroup) {
            const suspendedBtn = document.createElement('button');
            suspendedBtn.id = 'suspended-controls-btn';
            suspendedBtn.className = 'btn btn-warning';
            suspendedBtn.innerHTML = '⏸️ Contrôles suspendus';
            suspendedBtn.title = 'Voir et gérer les contrôles suspendus';
            suspendedBtn.onclick = () => this.showSuspendedControls();
            
            btnGroup.appendChild(suspendedBtn);
        }
    }

    // NOUVEAU : Méthode utilitaire pour diagnostiquer les statuts
    diagnoseControlStatuses() {
        if (!this.dataProcessor || !window.persistenceManager) {
            Utils.debugLog('Impossible de diagnostiquer: modules manquants');
            return;
        }
        
        const allDossiers = this.dataProcessor.getAllDossiers();
        const totalDossiers = allDossiers.length;
        const controlled = allDossiers.filter(d => {
            const statuses = this.getDossierStatuses(d);
            return Object.values(statuses).some(s => s.status === 'controlled');
        }).length;
        const suspended = allDossiers.filter(d => {
            const statuses = this.getDossierStatuses(d);
            return Object.values(statuses).some(s => s.status === 'suspended');
        }).length;
        
        Utils.debugLog(`=== DIAGNOSTIC STATUTS DOSSIERS ===`);
        Utils.debugLog(`Total: ${totalDossiers}`);
        Utils.debugLog(`Contrôlés: ${controlled} (${Math.round(controlled/totalDossiers*100)}%)`);
        Utils.debugLog(`Suspendus: ${suspended} (${Math.round(suspended/totalDossiers*100)}%)`);
        Utils.debugLog(`Disponibles: ${totalDossiers - controlled} (${Math.round((totalDossiers-controlled)/totalDossiers*100)}%)`);
        
        return { totalDossiers, controlled, suspended, available: totalDossiers - controlled };
    }

    // Méthodes existantes inchangées...
    populateFilters() {
        Utils.debugLog('=== INITIALISATION FILTRES ===');
        
        if (!this.dataProcessor) {
            Utils.debugLog('TableManager: Pas de dataProcessor disponible pour les filtres');
            return;
        }

        const allDossiers = this.dataProcessor.getAllDossiers();
        if (!allDossiers || allDossiers.length === 0) {
            Utils.debugLog('TableManager: Aucun dossier disponible pour les filtres');
            return;
        }

        const conseillers = [...new Set(
            allDossiers
                .map(d => d.conseiller)
                .filter(c => c && c.trim() !== '' && c.trim() !== '-')
        )].sort();
        
        const domaines = [...new Set(
            allDossiers
                .map(d => d.domaine)
                .filter(d => d && d.trim() !== '' && d.trim() !== '-')
        )].sort();
        
        Utils.debugLog(`Conseillers trouvés: ${conseillers.length} - ${conseillers.slice(0, 5).join(', ')}${conseillers.length > 5 ? '...' : ''}`);
        Utils.debugLog(`Domaines trouvés: ${domaines.length} - ${domaines.slice(0, 5).join(', ')}${domaines.length > 5 ? '...' : ''}`);
        
        this.populateSelectFilter('filter-conseiller', conseillers, 'Tous les conseillers', 'Aucun conseiller trouvé');
        this.populateSelectFilter('filter-domaine', domaines, 'Tous les domaines', 'Aucun domaine trouvé');
    }

    populateSelectFilter(selectId, options, defaultText, emptyText) {
        const select = document.getElementById(selectId);
        if (!select) return;

        select.innerHTML = `<option value="">${defaultText}</option>`;
        
        if (options.length > 0) {
            options.forEach(option => {
                const optionElement = document.createElement('option');
                optionElement.value = option;
                optionElement.textContent = option;
                select.appendChild(optionElement);
            });
        } else {
            const optionElement = document.createElement('option');
            optionElement.value = '';
            optionElement.textContent = emptyText;
            optionElement.disabled = true;
            select.appendChild(optionElement);
        }
    }

     getEligibleDossiers(controlType) {
        if (!this.dataProcessor) return [];
        
        const allDossiers = this.dataProcessor.getAllDossiers();
        
        // Filtrer d'abord selon les critères du contrôle
        const basicFiltered = allDossiers.filter(dossier => {
            // Appliquer les critères de base du contrôle
            // (logique existante de filtrage selon montant, type client, etc.)
            return true; // Simplifié pour l'exemple
        });
        
        // NOUVEAU : Exclure les dossiers déjà contrôlés pour ce type
        const eligibleDossiers = basicFiltered.filter(dossier => {
            if (!window.documentController) return true;
            return !window.documentController.isDossierControlled(dossier, controlType);
        });
        
        Utils.debugLog(`Dossiers éligibles pour ${controlType}: ${eligibleDossiers.length}/${basicFiltered.length} (${basicFiltered.length - eligibleDossiers.length} déjà contrôlés)`);
        
        return eligibleDossiers;
    }

    // Getters pour les autres modules
    getSelectedDossiers() {
        return this.selectedDossiers;
    }

    getSelectedDossiersData() {
        if (!this.dataProcessor) return [];
        
        const allDossiers = this.dataProcessor.getAllDossiers();
        return allDossiers.filter(d => this.selectedDossiers.includes(d.originalIndex));
    }

    exposeGlobalMethods() {
        // S'assurer que les méthodes sont disponibles globalement
        window.tableManager = this;
    }

    reset() {
        this.selectedDossiers = [];
        this.dataProcessor = null;
        
        // Réinitialiser l'interface
        const tbody = document.getElementById('dossiers-table-body');
        if (tbody) {
            tbody.innerHTML = '';
        }
        
        const summary = document.getElementById('selection-summary');
        if (summary) {
            summary.classList.remove('active');
        }
        
        // Réinitialiser les filtres
        this.clearFilters();
    }
}

