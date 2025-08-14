// tableManager.js - Gestion des tableaux, filtres et sélections

import { Utils } from './utils.js';

export class TableManager {
    constructor() {
        this.selectedDossiers = [];
        this.dataProcessor = null;
        this.availableColumns = [];
        this.visibleColumns = this.getDefaultColumns();
        this.columnHeaders = [];
        
        this.setupEventListeners();
        this.loadColumnConfiguration();
    }

     getDefaultColumns() {
        return [
            'client',
            'codeDossier', 
            'assistantBO',
            'conseiller',
            'domaine',
            'contrat',
            'typeActe',
            'montant',
            'etatBO',
            'nouveauClient',
            'ppe',
            'dateEnvoi'
        ];
    }

    initializeAvailableColumns(headers) {
        this.columnHeaders = headers;
        this.availableColumns = headers.map((header, index) => ({
            key: `col_${index}`,
            header: header,
            index: index,
            isMapped: this.isMappedColumn(header),
            mappedKey: this.getMappedKey(header)
        }));
        
        Utils.debugLog(`Colonnes disponibles initialisées: ${this.availableColumns.length}`);
    }

    // NOUVEAU : Vérifier si une colonne est déjà mappée
    isMappedColumn(header) {
        if (!this.dataProcessor || !header) return false;
    
        // Obtenir le mapping actuel
        const columnMapping = this.dataProcessor.getColumnMapping();
        if (!columnMapping) return false;
        
        // Obtenir les en-têtes originaux
        const originalHeaders = this.dataProcessor.getOriginalHeaders();
        if (!originalHeaders) return false;
        
        // Trouver l'index de cette en-tête
        const headerIndex = originalHeaders.indexOf(header);
        if (headerIndex === -1) return false;
        
        // Vérifier si cet index est dans le mapping
        const mappedIndices = Object.values(columnMapping);
        const isMapped = mappedIndices.includes(headerIndex);
        
        Utils.debugLog(`En-tête "${header}" (index ${headerIndex}) mappée: ${isMapped}`);
        return isMapped;
    }

    // NOUVEAU : Obtenir la clé mappée pour une colonne
    getMappedKey(header) {
        if (!this.dataProcessor || !header) return null;
    
        // Obtenir le mapping actuel
        const columnMapping = this.dataProcessor.getColumnMapping();
        if (!columnMapping) return null;
        
        // Obtenir les en-têtes originaux
        const originalHeaders = this.dataProcessor.getOriginalHeaders();
        if (!originalHeaders) return null;
        
        // Trouver l'index de cette en-tête
        const headerIndex = originalHeaders.indexOf(header);
        if (headerIndex === -1) return null;
        
        // Chercher la clé qui correspond à cet index
        for (const [key, index] of Object.entries(columnMapping)) {
            if (index === headerIndex) {
                Utils.debugLog(`En-tête "${header}" mappée sur la clé: ${key}`);
                return key;
            }
        }
        
        return null;
    }

    // NOUVEAU : Sauvegarder la configuration des colonnes
    saveColumnConfiguration() {
        try {
            const config = {
                visibleColumns: this.visibleColumns,
                timestamp: new Date().toISOString()
            };
            localStorage.setItem('table_columns_config', JSON.stringify(config));
            Utils.debugLog('Configuration colonnes sauvegardée');
        } catch (error) {
            Utils.debugLog('Erreur sauvegarde config colonnes: ' + error.message);
        }
    }

    // NOUVEAU : Charger la configuration des colonnes
    loadColumnConfiguration() {
        try {
            const saved = localStorage.getItem('table_columns_config');
            if (saved) {
                const config = JSON.parse(saved);
                this.visibleColumns = config.visibleColumns || this.getDefaultColumns();
                Utils.debugLog(`Configuration colonnes chargée: ${this.visibleColumns.length} colonnes`);
            }
        } catch (error) {
            Utils.debugLog('Erreur chargement config colonnes: ' + error.message);
            this.visibleColumns = this.getDefaultColumns();
        }
    }

    // NOUVEAU : Afficher la modal de configuration des colonnes
    showColumnConfigModal() {
        if (this.availableColumns.length === 0) {
            Utils.showNotification('Aucun fichier chargé pour configurer les colonnes', 'warning');
            return;
        }

        const modal = document.createElement('div');
        modal.className = 'column-config-overlay';
        modal.id = 'column-config-modal';
        
        modal.innerHTML = `
            <div class="column-config-backdrop" onclick="window.tableManager?.closeColumnConfigModal()">
                <div class="column-config-container" onclick="event.stopPropagation();">
                    
                    <!-- En-tête de la modal -->
                    <header class="column-config-header">
                        <div class="config-title">
                            <h2>Configuration des colonnes</h2>
                            <p class="config-subtitle">Personnalisez l'affichage de votre tableau de données</p>
                        </div>
                        <button class="close-btn" onclick="window.tableManager?.closeColumnConfigModal()" 
                                title="Fermer">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <line x1="18" y1="6" x2="6" y2="18"></line>
                                <line x1="6" y1="6" x2="18" y2="18"></line>
                            </svg>
                        </button>
                    </header>

                    <!-- Informations et statistiques -->
                    <div class="config-info-bar">
                        <div class="info-item">
                            <span class="info-">Total des colonnes</span>
                            <span class="info-value">${this.availableColumns.length}</span>
                        </div>
                        <div class="info-item">
                            <span class="info-">Colonnes sélectionnées</span>
                            <span class="info-value" id="selected-columns-count">${this.visibleColumns.length}</span>
                        </div>
                        <div class="info-item">
                            <span class="info-">Colonnes mappées</span>
                            <span class="info-value">${this.availableColumns.filter(col => col.isMapped).length}</span>
                        </div>
                    </div>

                    <!-- Actions rapides -->
                    <div class="quick-actions">
                        <button class="action-btn secondary" onclick="window.tableManager?.selectAllColumns()">
                            Tout sélectionner
                        </button>
                        <button class="action-btn secondary" onclick="window.tableManager?.selectDefaultColumns()">
                            Configuration par défaut
                        </button>
                        <button class="action-btn secondary" onclick="window.tableManager?.clearAllColumns()">
                            Tout désélectionner
                        </button>
                    </div>

                    <!-- Grille des colonnes -->
                    <div class="columns-grid-container">
                        <div class="columns-grid">
                            ${this.generateModernColumnCheckboxes()}
                        </div>
                    </div>

                    <!-- Actions principales -->
                    <footer class="config-footer">
                        <button class="footer-btn cancel" onclick="window.tableManager?.closeColumnConfigModal()">
                            Annuler
                        </button>
                        <button class="footer-btn apply" onclick="window.tableManager?.applyColumnConfiguration()">
                            Appliquer la configuration
                        </button>
                    </footer>

                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        this.addModernColumnConfigStyles();
        
        // Animation d'entrée
        requestAnimationFrame(() => {
            modal.classList.add('show');
        });
    }


    // NOUVEAU : Générer les checkboxes pour toutes les colonnes
    generateModernColumnCheckboxes() {
        return this.availableColumns.map((column, index) => {
            const isVisible = this.isColumnVisible(column);
            const typeClass = column.isMapped ? 'mapped' : 'raw';
            const mappedText = column.isMapped ? 'Mappée' : 'Brute';
            
            return `
                < class="column-card ${typeClass} ${isVisible ? 'selected' : ''}" 
                    data-column="${column.key}">
                    <div class="column-card-content">
                        <div class="column-header">
                            <input type="checkbox" 
                                class="column-checkbox"
                                ${isVisible ? 'checked' : ''} 
                                onchange="window.tableManager?.toggleColumnModern('${column.key}', this)">
                            <span class="column-title">${column.header || `Colonne ${column.index + 1}`}</span>
                        </div>
                        <div class="column-meta">
                            <span class="column-type">${mappedText}</span>
                            <span class="column-index">Col. ${String.fromCharCode(65 + column.index)}</span>
                        </div>
                        ${column.isMapped && column.mappedKey ? 
                            `<div class="column-mapping">→ ${this.getMappedKey(column.mappedKey)}</div>` : 
                            ''}
                    </div>
                    <div class="selection-indicator">
                        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                            <path d="m6 10 2 2 4-4" stroke="currentColor" stroke-width="2" 
                                stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                    </div>
                </label>
            `;
        }).join('');
    }

    getMappedKeyLabel(mappedKey) {
        const labels = {
            'client': 'Client',
            'codeDossier': 'Code Dossier',
            'assistantBO': 'Assistant BO',
            'conseiller': 'Conseiller',
            'domaine': 'Domaine',
            'contrat': 'Contrat',
            'typeActe': 'Type Acte',
            'montant': 'Montant',
            'etatBO': 'État BO',
            'nouveauClient': 'Nouveau Client',
            'ppe': 'PPE'
        };
        return labels[mappedKey] || mappedKey;
    }

    // NOUVEAU : Vérifier si une colonne est visible
    isColumnVisible(column) {
        if (column.isMapped && column.mappedKey) {
            return this.visibleColumns.includes(column.mappedKey);
        }
        return this.visibleColumns.includes(column.key);
    }

    // NOUVEAU : Basculer l'état d'une colonne
    toggleColumnModern(columnKey, checkboxElement) {
        const card = checkboxElement.closest('.column-card');
        const column = this.availableColumns.find(col => col.key === columnKey);
        if (!column) return;

        const identifier = column.isMapped && column.mappedKey ? column.mappedKey : column.key;
        
        if (this.visibleColumns.includes(identifier)) {
            this.visibleColumns = this.visibleColumns.filter(col => col !== identifier);
            card.classList.remove('selected');
        } else {
            this.visibleColumns.push(identifier);
            card.classList.add('selected');
        }
        
        this.updateSelectedCount();
    }

    // NOUVEAU : Actions de sélection rapide
    selectAllColumns() {
        this.visibleColumns = [];
        this.availableColumns.forEach(column => {
            const identifier = column.isMapped && column.mappedKey ? column.mappedKey : column.key;
            if (!this.visibleColumns.includes(identifier)) {
                this.visibleColumns.push(identifier);
            }
        });
        this.updateColumnCheckboxes();
        this.updateSelectedCount();
    }

    selectDefaultColumns() {
        this.visibleColumns = [...this.getDefaultColumns()];
        this.updateColumnCheckboxes();
        this.updateSelectedCount();
    }

    clearAllColumns() {
        this.visibleColumns = [];
        this.updateColumnCheckboxes();
        this.updateSelectedCount();
    }

    // NOUVEAU : Mettre à jour les checkboxes
    updateColumnCheckboxes() {
        const modal = document.getElementById('column-config-modal');
        if (!modal) return;
        
        this.availableColumns.forEach(column => {
            const card = modal.querySelector(`[data-column="${column.key}"]`);
            const checkbox = card?.querySelector('input[type="checkbox"]');
            if (checkbox && card) {
                const isVisible = this.isColumnVisible(column);
                checkbox.checked = isVisible;
                card.classList.toggle('selected', isVisible);
            }
        });
    }

    // NOUVEAU : Mettre à jour le compteur
    updateSelectedCount() {
        const countElement = document.getElementById('selected-columns-count');
        if (countElement) {
            countElement.textContent = this.visibleColumns.length;
        }
    }

    // NOUVEAU : Appliquer la configuration
    applyColumnConfiguration() {
        if (this.visibleColumns.length === 0) {
            Utils.showNotification('Vous devez sélectionner au moins une colonne', 'warning');
            return;
        }

        this.saveColumnConfiguration();
        this.closeColumnConfigModal();
        this.loadDossiersTable();
        
        Utils.showNotification(`Configuration appliquée: ${this.visibleColumns.length} colonne(s) affichée(s)`, 'success');
    }

    // NOUVEAU : Fermer la modal
    closeColumnConfigModal() {
        const modal = document.getElementById('column-config-modal');
        if (modal) {
            modal.remove();
        }
    }

    generateTableHeader() {
        const headerRow = document.querySelector('#dossiers-table-body').closest('table').querySelector('thead tr');
        if (!headerRow) return;

        // Conserver la première colonne (checkbox)
        let headerHTML = `
            <th>
                <div class="checkbox-container">
                    <div class="checkbox" id="select-all-checkbox" onclick="toggleSelectAll()"></div>
                </div>
            </th>
        `;

        // Ajouter les colonnes visibles
        this.visibleColumns.forEach(columnKey => {
            const columnInfo = this.getColumnInfo(columnKey);
            headerHTML += `<th>${columnInfo.label}</th>`;
        });

        headerRow.innerHTML = headerHTML;
    }

    // NOUVEAU : Obtenir les informations d'une colonne
    getColumnInfo(columnKey) {
        const columnLabels = {
            'client': '👤 Client',
            'codeDossier': '📋 Code Dossier',
            'assistantBO': '👨‍💼 Assistant BO',
            'conseiller': '👨‍💼 Conseiller',
            'domaine': '🏢 Domaine',
            'contrat': '📄 Contrat',
            'typeActe': '📝 Type Acte',
            'montant': '💰 Montant',
            'etatBO': '📊 État BO',
            'nouveauClient': '⭐ Nouveau',
            'ppe': '🔒 PPE',
            'dateEnvoi': '📅 Date d\'envoi'
        };

        // Si c'est une colonne mappée
        if (columnLabels[columnKey]) {
            return {
                label: columnLabels[columnKey],
                key: columnKey,
                isMapped: true
            };
        }

        // Si c'est une colonne brute
        const column = this.availableColumns.find(col => col.key === columnKey);
        if (column) {
            return {
                label: column.header || `Col ${column.index + 1}`,
                key: columnKey,
                isMapped: false,
                index: column.index
            };
        }

        return {
            label: columnKey,
            key: columnKey,
            isMapped: false
        };
    }

    setupEventListeners() {
        // Écouter les données traitées
        window.addEventListener('dataProcessed', (e) => {
            Utils.debugLog('TableManager: Réception événement dataProcessed');
            
            this.dataProcessor = window.dataProcessor;
            
            Utils.debugLog(`TableManager: DataProcessor récupéré: ${this.dataProcessor ? 'OK' : 'NON'}`);
            
            if (this.dataProcessor) {
                const allDossiers = this.dataProcessor.getAllDossiers();
                Utils.debugLog(`TableManager: ${allDossiers.length} dossiers trouvés`);
                
                if (allDossiers.length > 0) {
                    // ✅ CORRECTION : Utiliser les vrais en-têtes originaux
                    const originalHeaders = this.dataProcessor.getOriginalHeaders();
                    if (originalHeaders && originalHeaders.length > 0) {
                        this.initializeAvailableColumns(originalHeaders);
                        Utils.debugLog(`Colonnes initialisées avec ${originalHeaders.length} en-têtes originaux`);
                    } else {
                        Utils.debugLog('❌ Aucun en-tête original trouvé');
                    }
                    
                    this.populateFilters();
                    
                    setTimeout(() => {
                        this.addColumnConfigButton();
                    }, 100);
                    
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
        Utils.debugLog('=== CHARGEMENT TABLEAU AVEC COLONNES CONFIGURÉES ===');
        
        if (!this.dataProcessor) return;

        // Générer l'en-tête dynamique
        this.generateTableHeader();

        const filteredDossiers = this.dataProcessor.getFilteredDossiers();
        Utils.debugLog(`Dossiers filtrés: ${filteredDossiers.length}`);
        Utils.debugLog(`Colonnes visibles: ${this.visibleColumns.length}`);
        
        const tbody = document.getElementById('dossiers-table-body');
        if (!tbody) return;

        tbody.innerHTML = '';

        if (filteredDossiers.length === 0) {
            const colspan = this.visibleColumns.length + 1; // +1 pour la checkbox
            tbody.innerHTML = `
                <tr>
                    <td colspan="${colspan}" style="text-align: center; padding: 40px; color: #6c757d;">
                        Aucun dossier trouvé avec les filtres actuels
                    </td>
                </tr>
            `;
            return;
        }

        // Statistiques
        let controlledCount = 0;
        let suspendedCount = 0;

        filteredDossiers.forEach((dossier, index) => {
            const row = document.createElement('tr');
            const isSelected = this.selectedDossiers.includes(dossier.originalIndex);
            
            const statuses = this.getDossierStatuses(dossier);
            const hasControlled = Object.values(statuses).some(s => s.status === 'controlled');
            const hasSuspended = Object.values(statuses).some(s => s.status === 'suspended');
            
            if (hasControlled) controlledCount++;
            if (hasSuspended) suspendedCount++;
            
            if (isSelected) row.classList.add('selected');
            if (hasControlled) row.classList.add('row-controlled');
            if (hasSuspended) row.classList.add('row-suspended');
            
            row.innerHTML = this.generateTableRow(dossier, isSelected);
            tbody.appendChild(row);
        });

        //this.updateTableStatistics(filteredDossiers.length, controlledCount, suspendedCount);
        this.updateSelectAllCheckbox();
        
        Utils.debugLog(`Tableau chargé: ${filteredDossiers.length} dossiers, ${this.visibleColumns.length} colonnes`);
    }

    // NOUVEAU : Ajouter le bouton de configuration des colonnes
    addColumnConfigButton() {
        const existingButtons = document.querySelectorAll('#column-config-btn');
    existingButtons.forEach(btn => btn.remove());
    
    const filtersSection = document.querySelector('.filters-section .btn-group');
    if (!filtersSection) {
        console.log('❌ Section des filtres non trouvée');
        return;
    }

    // Créer le nouveau bouton
    const configBtn = document.createElement('button');
    configBtn.id = 'column-config-btn';
    configBtn.className = 'btn btn-info';
    configBtn.innerHTML = '🔧 Configurer colonnes';
    configBtn.title = 'Personnaliser les colonnes affichées dans le tableau';
    configBtn.onclick = () => this.showColumnConfigModal();

    // L'insérer à la bonne position (avant le bouton "Changer de fichier")
    const changeFileBtn = filtersSection.querySelector('button[onclick*="showFileUpload"]');
    if (changeFileBtn) {
        filtersSection.insertBefore(configBtn, changeFileBtn);
    } else {
        filtersSection.appendChild(configBtn);
    }

    console.log('✅ Bouton de configuration des colonnes ajouté (unique)');
}

    // NOUVEAU : Styles pour la configuration des colonnes
    addModernColumnConfigStyles() {
        if (document.getElementById('modern-column-config-styles')) return;
        
        const style = document.createElement('style');
        style.id = 'modern-column-config-styles';
        style.textContent = `
            /* Overlay et backdrop */
            .column-config-overlay {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                z-index: 10000;
                opacity: 0;
                visibility: hidden;
                transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            }

            .column-config-overlay.show {
                opacity: 1;
                visibility: visible;
            }

            .column-config-backdrop {
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(15, 23, 42, 0.8);
                backdrop-filter: blur(8px);
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 20px;
            }

            /* Container principal */
            .column-config-container {
                background: white;
                border-radius: 16px;
                box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
                width: 100%;
                max-width: 1000px;
                max-height: 90vh;
                display: flex;
                flex-direction: column;
                overflow: hidden;
                transform: scale(0.95) translateY(20px);
                transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            }

            .column-config-overlay.show .column-config-container {
                transform: scale(1) translateY(0);
            }

            /* En-tête */
            .column-config-header {
                display: flex;
                align-items: flex-start;
                justify-content: space-between;
                padding: 24px 24px 20px;
                border-bottom: 1px solid #e2e8f0;
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
            }

            .config-title h2 {
                margin: 0 0 4px 0;
                font-size: 1.5rem;
                font-weight: 600;
                color: white;
            }

            .config-subtitle {
                margin: 0;
                font-size: 0.875rem;
                opacity: 0.9;
                color: rgba(255, 255, 255, 0.8);
            }

            .close-btn {
                background: rgba(255, 255, 255, 0.2);
                border: none;
                border-radius: 8px;
                width: 40px;
                height: 40px;
                display: flex;
                align-items: center;
                justify-content: center;
                cursor: pointer;
                color: white;
                transition: background-color 0.2s;
            }

            .close-btn:hover {
                background: rgba(255, 255, 255, 0.3);
            }

            /* Barre d'informations */
            .config-info-bar {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
                gap: 16px;
                padding: 20px 24px;
                background: #f8fafc;
                border-bottom: 1px solid #e2e8f0;
            }

            .info-item {
                text-align: center;
            }

            .info-label {
                display: block;
                font-size: 0.75rem;
                font-weight: 500;
                color: #64748b;
                text-transform: uppercase;
                letter-spacing: 0.05em;
                margin-bottom: 4px;
            }

            .info-value {
                display: block;
                font-size: 1.5rem;
                font-weight: 700;
                color: #1e293b;
            }

            /* Légende */
            .config-legend {
                display: flex;
                gap: 24px;
                padding: 16px 24px;
                background: #f1f5f9;
                border-bottom: 1px solid #e2e8f0;
            }

            .legend-item {
                display: flex;
                align-items: center;
                gap: 8px;
            }

            .legend-indicator {
                width: 12px;
                height: 12px;
                border-radius: 3px;
                flex-shrink: 0;
            }

            .legend-indicator.mapped {
                background: linear-gradient(135deg, #10b981, #059669);
            }

            .legend-indicator.raw {
                background: linear-gradient(135deg, #6b7280, #4b5563);
            }

            .legend-text {
                font-size: 0.875rem;
                color: #374151;
                font-weight: 500;
            }

            /* Actions rapides */
            .quick-actions {
                display: flex;
                gap: 12px;
                padding: 16px 24px;
                border-bottom: 1px solid #e2e8f0;
            }

            .action-btn {
                padding: 8px 16px;
                border-radius: 8px;
                border: 1px solid #d1d5db;
                background: white;
                color: #374151;
                font-size: 0.875rem;
                font-weight: 500;
                cursor: pointer;
                transition: all 0.2s;
            }

            .action-btn:hover {
                border-color: #9ca3af;
                background: #f9fafb;
            }

            .action-btn.secondary:hover {
                border-color: #667eea;
                color: #667eea;
            }

            /* Grille des colonnes */
            .columns-grid-container {
                flex: 1;
                overflow-y: auto;
                padding: 24px;
            }

            .columns-grid {
                display: grid;
                grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
                gap: 16px;
            }

            /* Cartes de colonnes */
            .column-card {
                position: relative;
                background: white;
                border: 2px solid #e2e8f0;
                border-radius: 12px;
                padding: 16px;
                cursor: pointer;
                transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
                overflow: hidden;
            }

            .column-card::before {
                content: '';
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                height: 4px;
                background: #e2e8f0;
                transition: background 0.2s;
            }

            .column-card.mapped::before {
                background: linear-gradient(90deg, #10b981, #059669);
            }

            .column-card.raw::before {
                background: linear-gradient(90deg, #6b7280, #4b5563);
            }

            .column-card:hover {
                border-color: #c7d2fe;
                box-shadow: 0 4px 12px rgba(99, 102, 241, 0.15);
                transform: translateY(-2px);
            }

            .column-card.selected {
                border-color: #667eea;
                background: #f0f4ff;
                box-shadow: 0 4px 20px rgba(99, 102, 241, 0.2);
            }

            .column-card-content {
                position: relative;
                z-index: 2;
            }

            .column-header {
                display: flex;
                align-items: flex-start;
                gap: 12px;
                margin-bottom: 8px;
            }

            .column-checkbox {
                margin: 2px 0 0 0;
                width: 18px;
                height: 18px;
                accent-color: #667eea;
                cursor: pointer;
            }

            .column-title {
                flex: 1;
                font-size: 0.95rem;
                font-weight: 600;
                color: #1e293b;
                line-height: 1.4;
            }

            .column-meta {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 8px;
            }

            .column-type {
                font-size: 0.75rem;
                font-weight: 600;
                padding: 2px 8px;
                border-radius: 4px;
                text-transform: uppercase;
                letter-spacing: 0.05em;
            }

            .column-card.mapped .column-type {
                background: #d1fae5;
                color: #059669;
            }

            .column-card.raw .column-type {
                background: #f3f4f6;
                color: #4b5563;
            }

            .column-index {
                font-size: 0.75rem;
                color: #64748b;
                font-weight: 500;
            }

            .column-mapping {
                font-size: 0.8rem;
                color: #059669;
                font-weight: 500;
                font-style: italic;
            }

            .selection-indicator {
                position: absolute;
                top: 12px;
                right: 12px;
                width: 24px;
                height: 24px;
                border-radius: 50%;
                background: #667eea;
                color: white;
                display: flex;
                align-items: center;
                justify-content: center;
                opacity: 0;
                transform: scale(0.8);
                transition: all 0.2s;
            }

            .column-card.selected .selection-indicator {
                opacity: 1;
                transform: scale(1);
            }

            /* Footer */
            .config-footer {
                display: flex;
                justify-content: space-between;
                gap: 12px;
                padding: 20px 24px;
                border-top: 1px solid #e2e8f0;
                background: #f8fafc;
            }

            .footer-btn {
                padding: 12px 24px;
                border-radius: 8px;
                font-size: 0.875rem;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.2s;
                border: none;
                min-width: 120px;
            }

            .footer-btn.cancel {
                background: #f1f5f9;
                color: #475569;
            }

            .footer-btn.cancel:hover {
                background: #e2e8f0;
            }

            .footer-btn.apply {
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
            }

            .footer-btn.apply:hover {
                transform: translateY(-1px);
                box-shadow: 0 4px 12px rgba(99, 102, 241, 0.4);
            }

            /* Scrollbar customization */
            .columns-grid-container::-webkit-scrollbar {
                width: 8px;
            }

            .columns-grid-container::-webkit-scrollbar-track {
                background: #f1f5f9;
                border-radius: 4px;
            }

            .columns-grid-container::-webkit-scrollbar-thumb {
                background: #cbd5e1;
                border-radius: 4px;
            }

            .columns-grid-container::-webkit-scrollbar-thumb:hover {
                background: #94a3b8;
            }

            /* Responsive */
            @media (max-width: 768px) {
                .column-config-container {
                    margin: 10px;
                    max-height: calc(100vh - 20px);
                }
                
                .columns-grid {
                    grid-template-columns: 1fr;
                }
                
                .config-legend {
                    flex-direction: column;
                    gap: 12px;
                }
                
                .quick-actions {
                    flex-wrap: wrap;
                }
            }
        `;
        
        document.head.appendChild(style);
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
        const statusBadges = hasAnyControl ? this.generateStatusBadges(dossierStatuses) : '';
        const cellClass = hasAnyControl ? 'controlled-cell' : '';

        // Checkbox (toujours en première position)
        let rowHTML = `
            <td>
                <div class="checkbox-container">
                    <div class="checkbox ${isSelected ? 'checked' : ''}" 
                         onclick="window.tableManager?.toggleDossierSelection(${dossier.originalIndex})"></div>
                </div>
            </td>
        `;

        // Ajouter les colonnes visibles
        this.visibleColumns.forEach(columnKey => {
            const columnInfo = this.getColumnInfo(columnKey);
            let cellContent = '';

            if (columnInfo.isMapped) {
                // Colonne mappée - utiliser les données traitées
                cellContent = this.getMappedColumnContent(dossier, columnKey, statusBadges);
            } else {
                // Colonne brute - utiliser les données du fichier Excel
                cellContent = this.getRawColumnContent(dossier, columnInfo.index);
            }

            rowHTML += `<td class="${cellClass}">${cellContent}</td>`;
        });

        return rowHTML;
    }

    // NOUVEAU : Contenu pour les colonnes mappées
    getMappedColumnContent(dossier, columnKey, statusBadges) {
        switch (columnKey) {
            case 'client':
                return `
                    <strong>${dossier.client || 'Client non spécifié'}</strong>
                    ${dossier.reference ? `<br><small>Réf: ${dossier.reference}</small>` : ''}
                    ${statusBadges ? `<br>${statusBadges}` : ''}
                `;
            case 'codeDossier':
                return Utils.displayValue(dossier.codeDossier, 'N/A');
            case 'assistantBO':
                return Utils.displayValue(dossier.assistantBO, 'Non assigné');
            case 'conseiller':
                return Utils.displayValue(dossier.conseiller, 'Non assigné');
            case 'domaine':
                return dossier.domaine ? 
                    `<span class="badge ${Utils.getBadgeClass(dossier.domaine)}">${dossier.domaine}</span>` : 
                    Utils.displayValue('', 'Non défini');
            case 'contrat':
                return `
                    ${Utils.displayValue(dossier.contrat, 'Non spécifié')}
                    ${dossier.fournisseur ? `<br><small>${dossier.fournisseur}</small>` : ''}
                `;
            case 'typeActe':
                return Utils.displayValue(dossier.typeActe, 'Non défini');
            case 'montant':
                return dossier.montant ? 
                    `<strong>${dossier.montant}</strong>` : 
                    Utils.displayValue('', 'N/A');
            case 'etatBO':
                return Utils.displayValue(dossier.etatBO, 'Non défini');
            case 'nouveauClient':
                return dossier.nouveauClient ? 
                    `<span class="badge ${dossier.nouveauClient.toLowerCase()}">${dossier.nouveauClient}</span>` : 
                    Utils.displayValue('', 'N/A');
            case 'ppe':
                return dossier.ppe && dossier.ppe.toLowerCase() === 'oui' ? 
                    '<span class="badge oui">PPE</span>' : 
                    Utils.displayValue('', 'Non');
            case 'dateEnvoi':
                return Utils.displayValue(dossier.dateEnvoi, 'Non définie');
            case 'dateValidation':
                return Utils.displayValue(dossier.dateValidation, 'Non définie');
            default:
                return Utils.displayValue('', 'N/A');
        }
    }

    // NOUVEAU : Contenu pour les colonnes brutes
    getRawColumnContent(dossier, columnIndex) {
        if (!dossier.rawData || columnIndex === undefined || columnIndex === null) {
            return Utils.displayValue('', 'N/A');
        }
        
        if (columnIndex >= dossier.rawData.length || columnIndex < 0) {
            Utils.debugLog(`Index ${columnIndex} hors limites pour rawData (taille: ${dossier.rawData.length})`);
            return Utils.displayValue('', 'N/A');
        }

        const value = dossier.rawData[columnIndex];
        
        // Traitement spécial pour les valeurs numériques (montants, dates, etc.)
        if (typeof value === 'number') {
            // Si c'est probablement un montant (nombre > 1000)
            if (value > 1000) {
                return `<strong>${value.toLocaleString('fr-FR')} €</strong>`;
            }
            return value.toString();
        }
        
        // Traitement pour les dates Excel (nombre de jours depuis 1900)
        if (typeof value === 'number' && value > 40000 && value < 50000) {
            try {
                const excelDate = new Date((value - 25569) * 86400 * 1000);
                if (!isNaN(excelDate.getTime())) {
                    return excelDate.toLocaleDateString('fr-FR');
                }
            } catch (e) {
                // Ignorer les erreurs de conversion de date
            }
        }
        
        return Utils.displayValue(value, 'N/A');
    }

    diagnoseColumnMapping() {
        if (!this.dataProcessor) {
            Utils.debugLog('❌ Pas de DataProcessor pour le diagnostic');
            return;
        }
        
        const originalHeaders = this.dataProcessor.getOriginalHeaders();
        const columnMapping = this.dataProcessor.getColumnMapping();
        
        Utils.debugLog('=== DIAGNOSTIC MAPPING COLONNES ===');
        Utils.debugLog(`En-têtes originaux: ${originalHeaders ? originalHeaders.length : 0}`);
        Utils.debugLog(`Mapping défini: ${columnMapping ? Object.keys(columnMapping).length : 0} clés`);
        Utils.debugLog(`Colonnes disponibles: ${this.availableColumns.length}`);
        
        if (originalHeaders) {
            Utils.debugLog('En-têtes originaux:', originalHeaders);
        }
        
        if (columnMapping) {
            Utils.debugLog('Mapping actuel:', columnMapping);
        }
        
        if (this.availableColumns.length > 0) {
            Utils.debugLog('Premières colonnes disponibles:');
            this.availableColumns.slice(0, 5).forEach(col => {
                Utils.debugLog(`  ${col.index}: "${col.header}" (mappée: ${col.isMapped}, clé: ${col.mappedKey})`);
            });
        }
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
        
        // CORRECTION : Utiliser les vrais en-têtes originaux
        if (this.availableColumns.length === 0) {
            const originalHeaders = this.dataProcessor.getOriginalHeaders();
            if (originalHeaders && originalHeaders.length > 0) {
                this.initializeAvailableColumns(originalHeaders);
                Utils.debugLog(`Colonnes initialisées avec ${originalHeaders.length} en-têtes lors de la navigation`);
            } else {
                Utils.debugLog('❌ Pas d\'en-têtes originaux disponibles lors de la navigation');
            }
        }
        
        Utils.debugLog('=== NAVIGATION VERS SÉLECTION ===');
        Utils.debugLog(`${allDossiers.length} dossiers disponibles`);
        Utils.debugLog(`${this.availableColumns.length} colonnes disponibles`);
        
        this.showDossierSelection();
        
        setTimeout(() => {
            this.populateFilters();
            this.addColumnConfigButton();
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

    updateSampleSelectionInterface() {
        if (!this.currentControl) return;

        const section = document.getElementById('sample-selection-section');
        if (!section) return;

        // Mettre à jour le titre
        const title = section.querySelector('.section-title');
        if (title) {
            title.textContent = `Sélection d'échantillon - ${this.currentControl.definition.name}`;
        }

        // Calculer la répartition par conseiller
        const distribution = {};
        this.currentControl.selectedDossiers.forEach(dossier => {
            const conseiller = dossier.conseiller || 'Non assigné';
            distribution[conseiller] = (distribution[conseiller] || 0) + 1;
        });

        // Mettre à jour les informations avec la répartition
        const sampleInfo = section.querySelector('.sample-info p');
        if (sampleInfo) {
            const conseillerCount = Object.keys(distribution).length;
            sampleInfo.innerHTML = `
                Échantillon de ${this.currentControl.selectedDossiers.length} dossier(s) généré pour le contrôle ${this.currentControl.definition.name}.<br>
                <strong>🎯 Représentativité: ${conseillerCount} conseiller(s) représenté(s)</strong><br>
                Choisissez le dossier à contrôler :
            `;
        }

        // Remplir le tableau de l'échantillon
        this.populateSampleTable();
    }

    // NOUVEAU : Ajouter l'indicateur du nombre de colonnes configurées
    updateColumnConfigButton() {
        const button = document.getElementById('column-config-btn');
        if (!button) return;

        const defaultCount = this.getDefaultColumns().length;
        const currentCount = this.visibleColumns.length;
        
        if (currentCount !== defaultCount) {
            button.innerHTML = `🔧 Configurer colonnes (${currentCount})`;
            button.classList.add('btn-info-active');
        } else {
            button.innerHTML = '🔧 Configurer colonnes';
            button.classList.remove('btn-info-active');
        }
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
        
        // NOUVEAU : Réinitialiser les colonnes
        this.availableColumns = [];
        this.visibleColumns = this.getDefaultColumns();
        this.columnHeaders = [];
        
        // Réinitialiser l'interface
        const tbody = document.getElementById('dossiers-table-body');
        if (tbody) {
            tbody.innerHTML = '';
        }
        
        const summary = document.getElementById('selection-summary');
        if (summary) {
            summary.classList.remove('active');
        }
        
        // Supprimer le bouton de configuration
        const configBtn = document.getElementById('column-config-btn');
        if (configBtn) {
            configBtn.remove();
        }
        
        // Réinitialiser les filtres
        this.clearFilters();
    }
}




