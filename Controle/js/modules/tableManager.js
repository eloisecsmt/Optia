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
        Utils.debugLog('=== CHARGEMENT TABLEAU ===');
        
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

        filteredDossiers.forEach((dossier, index) => {
            const row = document.createElement('tr');
            const isSelected = this.selectedDossiers.includes(dossier.originalIndex);
            
            if (isSelected) {
                row.classList.add('selected');
            }
            
            row.innerHTML = this.generateTableRow(dossier, isSelected);
            tbody.appendChild(row);
        });

        this.updateSelectAllCheckbox();
        Utils.debugLog(`Tableau chargé avec ${filteredDossiers.length} lignes`);
    }

    generateTableRow(dossier, isSelected) {
        return `
            <td>
                <div class="checkbox-container">
                    <div class="checkbox ${isSelected ? 'checked' : ''}" 
                         onclick="window.tableManager?.toggleDossierSelection(${dossier.originalIndex})"></div>
                </div>
            </td>
            <td>
                <strong>${dossier.client || 'Client non spécifié'}</strong>
                ${dossier.reference ? `<br><small>Réf: ${dossier.reference}</small>` : ''}
            </td>
            <td>${Utils.displayValue(dossier.codeDossier, 'N/A')}</td>
            <td>${Utils.displayValue(dossier.assistantBO, 'Non assigné')}</td>
            <td>${Utils.displayValue(dossier.conseiller, 'Non assigné')}</td>
            <td>${dossier.domaine ? `<span class="badge ${Utils.getBadgeClass(dossier.domaine)}">${dossier.domaine}</span>` : Utils.displayValue('', 'Non défini')}</td>
            <td>
                ${Utils.displayValue(dossier.contrat, 'Non spécifié')}
                ${dossier.fournisseur ? `<br><small>${dossier.fournisseur}</small>` : ''}
            </td>
            <td>${Utils.displayValue(dossier.typeActe, 'Non défini')}</td>
            <td>${dossier.montant ? `<strong>${dossier.montant}</strong>` : Utils.displayValue('', 'N/A')}</td>
            <td>${Utils.displayValue(dossier.etatBO, 'Non défini')}</td>
            <td>${dossier.nouveauClient ? `<span class="badge ${dossier.nouveauClient.toLowerCase()}">${dossier.nouveauClient}</span>` : Utils.displayValue('', 'N/A')}</td>
            <td>${dossier.ppe && dossier.ppe.toLowerCase() === 'oui' ? '<span class="badge oui">PPE</span>' : Utils.displayValue('', 'Non')}</td>
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
        
        Utils.showSection('control-section');
        
        // Log des dossiers sélectionnés pour développement
        if (this.dataProcessor) {
            const allDossiers = this.dataProcessor.getAllDossiers();
            const selectedDossierData = allDossiers.filter(d => this.selectedDossiers.includes(d.originalIndex));
            Utils.debugLog(`Dossiers sélectionnés pour contrôle: ${selectedDossierData.length}`);
            
            // Notifier les autres modules
            window.dispatchEvent(new CustomEvent('manualControlLaunched', {
                detail: {
                    selectedDossiers: selectedDossierData,
                    selectionType: 'manual'
                }
            }));
        }
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

    // Getters pour les autres modules
    getSelectedDossiers() {
        return this.selectedDossiers;
    }

    getSelectedDossiersData() {
        if (!this.dataProcessor) return [];
        
        const allDossiers = this.dataProcessor.getAllDossiers();
        return allDossiers.filter(d => this.selectedDossiers.includes(d.originalIndex));
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