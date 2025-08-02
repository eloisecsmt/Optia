// historyInterface.js - Version enrichie avec toutes les fonctionnalités

import { Utils } from './utils.js';

export class HistoryInterface {
    constructor() {
        this.currentResults = [];
        this.searchTimeout = null;
        this.sortField = 'date';
        this.sortDirection = 'desc';
        this.init();
    }

    init() {
        this.createHistorySection();
        this.setupEventListeners();
        Utils.debugLog('HistoryInterface enrichi initialisé');
    }

    setupEventListeners() {
        // Écouter les contrôles terminés pour mise à jour automatique
        window.addEventListener('controlCompleted', (e) => {
        Utils.debugLog('HistoryInterface: Contrôle terminé détecté');
        
        // SAUVEGARDER ICI (une seule fois)
        if (window.persistenceManager) {
            window.persistenceManager.saveControl(e.detail);
            Utils.debugLog('Contrôle sauvegardé dans l\'historique');
        }
        
        // Mettre à jour l'interface si visible
        if (this.isHistorySectionActive()) {
            setTimeout(() => {
                this.loadHistoryData();
                Utils.showNotification('Historique mis à jour automatiquement', 'success');
            }, 1000);
        }
    });

        // Recherche en temps réel
        document.addEventListener('input', (e) => {
            if (e.target.id === 'history-client' || e.target.id === 'history-conseiller') {
                clearTimeout(this.searchTimeout);
                this.searchTimeout = setTimeout(() => {
                    this.searchHistory();
                }, 500);
            }
        });

        // Changement immédiat pour les selects
        document.addEventListener('change', (e) => {
            if (e.target.id && e.target.id.startsWith('history-')) {
                this.searchHistory();
            }
        });
    }

    createHistorySection() {
        // Vérifier si la section existe déjà
        if (document.getElementById('history-section')) {
            return;
        }

        const section = document.createElement('div');
        section.className = 'content-section';
        section.id = 'history-section';
        
        section.innerHTML = `
            <h2 class="section-title">📋 Historique des contrôles documentaires</h2>
            
            <!-- Filtres de recherche avancée -->
            <div class="filters-section">
                <h3 style="margin-bottom: 15px; color: #1a1a2e;">🔍 Recherche et filtres</h3>
                <div class="filters-grid">
                    <div class="filter-group">
                        <label class="filter-label">📅 Date début</label>
                        <input type="date" id="history-date-debut" class="filter-input" 
                               title="Filtrer les contrôles à partir de cette date">
                    </div>
                    <div class="filter-group">
                        <label class="filter-label">📅 Date fin</label>
                        <input type="date" id="history-date-fin" class="filter-input"
                               title="Filtrer les contrôles jusqu'à cette date">
                    </div>
                    <div class="filter-group">
                        <label class="filter-label">🔍 Type de contrôle</label>
                        <select id="history-type" class="filter-select">
                            <option value="">📋 Tous les types</option>
                            <option value="LCB-FT">🛡️ LCB-FT</option>
                            <option value="Financement">💰 Financement</option>
                            <option value="Carto Client">🗺️ Carto Client</option>
                            <option value="Opération">⚙️ Opération</option>
                            <option value="Nouveau Client">⭐ Nouveau Client</option>
                        </select>
                    </div>
                    <div class="filter-group">
                        <label class="filter-label">👨‍💼 Conseiller</label>
                        <input type="text" id="history-conseiller" class="filter-input" 
                               placeholder="Nom du conseiller..." autocomplete="off"
                               title="Rechercher par nom de conseiller">
                    </div>
                    <div class="filter-group">
                        <label class="filter-label">👤 Client</label>
                        <input type="text" id="history-client" class="filter-input" 
                               placeholder="Nom du client..." autocomplete="off"
                               title="Rechercher par nom de client">
                    </div>
                    <div class="filter-group">
                        <label class="filter-label">✅ Conformité</label>
                        <select id="history-conformite" class="filter-select">
                            <option value="">📊 Toutes</option>
                            <option value="CONFORME">✅ Conforme</option>
                            <option value="NON CONFORME">❌ Non conforme</option>
                        </select>
                    </div>
                </div>
                
                <div class="btn-group">
                    <button class="btn btn-primary" onclick="window.historyInterface?.searchHistory()"
                            title="Lancer la recherche avec les critères sélectionnés">
                        🔍 Rechercher
                    </button>
                    <button class="btn btn-secondary" onclick="window.historyInterface?.clearFilters()"
                            title="Effacer tous les filtres et afficher tout l'historique">
                        🗑️ Effacer filtres
                    </button>
                    <button class="btn btn-info" onclick="window.historyInterface?.showAll()"
                            title="Afficher tous les contrôles">
                        📋 Afficher tout
                    </button>
                    <button class="btn btn-warning" onclick="window.historyInterface?.setDatePreset('thisMonth')"
                            title="Afficher les contrôles de ce mois">
                        📅 Ce mois
                    </button>
                </div>
            </div>
            
            <!-- Statistiques détaillées -->
            <div class="history-summary" id="history-stats">
                <div class="summary-cards">
                    <div class="summary-card">
                        <div class="card-value">0</div>
                        <div class="card-label">Total contrôles</div>
                    </div>
                    <div class="summary-card">
                        <div class="card-value">0%</div>
                        <div class="card-label">Taux conformité</div>
                    </div>
                    <div class="summary-card">
                        <div class="card-value">0</div>
                        <div class="card-label">Anomalies majeures</div>
                    </div>
                    <div class="summary-card">
                        <div class="card-value">0</div>
                        <div class="card-label">Ce mois-ci</div>
                    </div>
                    <div class="summary-card">
                        <div class="card-value">Aucun</div>
                        <div class="card-label">Type le plus fréquent</div>
                    </div>
                </div>
            </div>
            
            <!-- Informations sur les résultats -->
            <div class="history-info" id="history-info" style="display: none;">
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 15px; background: #e3f2fd; border-radius: 8px; margin-bottom: 20px;">
                    <div>
                        <strong>📊 Résultats :</strong> 
                        <span id="results-count">0</span> contrôle(s) trouvé(s)
                        <span id="results-details"></span>
                    </div>
                    <div>
                        <button class="btn btn-sm btn-secondary" onclick="window.historyInterface?.clearFilters()">
                            Afficher tout
                        </button>
                    </div>
                </div>
            </div>
            
            <!-- Tableau des résultats avec tri -->
            <div class="table-container" id="history-results">
                <div style="text-align: center; padding: 40px; color: #6c757d;">
                    <h3>🏠 Bienvenue dans l'historique</h3>
                    <p>Terminez un contrôle pour commencer à voir les données ici.</p>
                    <p><small>💡 Utilisez les filtres ci-dessus pour rechercher dans vos contrôles.</small></p>
                </div>
            </div>
            
            <!-- Actions d'export et gestion -->
            <div class="history-actions">
                <div class="btn-group">
                    <button class="btn btn-success" onclick="window.historyInterface?.exportComplete()" 
                            title="Exporter tous les contrôles en Excel avec mise en forme">
                        📊 Exporter historique complet
                    </button>
                    <button class="btn btn-warning" onclick="window.historyInterface?.exportFiltered()" 
                            title="Exporter uniquement les résultats affichés">
                        🔍 Exporter résultats filtrés (<span id="filtered-count">0</span>)
                    </button>
                    <button class="btn btn-info" onclick="window.historyInterface?.showStatistics()" 
                            title="Voir les statistiques détaillées et graphiques">
                        📈 Statistiques détaillées
                    </button>
                </div>
                
                <div class="btn-group">
                    <button class="btn btn-secondary" onclick="showAutomaticControls()" 
                            title="Retourner à l'interface principale de contrôle">
                        ⬅️ Retour aux contrôles
                    </button>
                    <button class="btn btn-danger" onclick="window.historyInterface?.clearHistory()"
                            title="Effacer complètement l'historique (action irréversible)">
                        🗑️ Effacer historique
                    </button>
                </div>
            </div>
        `;
        
        // Ajouter la section au container
        const container = document.querySelector('.container');
        if (container) {
            container.appendChild(section);
            Utils.debugLog('Section historique enrichie créée');
        }
    }

    // Navigation vers l'historique
    show() {
        Utils.debugLog('Affichage interface historique enrichie');
        
        if (!window.persistenceManager) {
            Utils.showNotification('Gestionnaire d\'historique non disponible', 'error');
            return;
        }
        
        Utils.showSection('history-section');
        this.loadHistoryData();
    }

    // Chargement des données avec tri
    loadHistoryData() {
        if (!window.persistenceManager) {
            Utils.showNotification('Gestionnaire d\'historique non disponible', 'error');
            return;
        }
        
        const allControles = window.persistenceManager.getHistoryData().controles;
        this.currentResults = this.sortControles(allControles);
        this.displayResults(this.currentResults);
        this.updateStats();
        this.hideResultsInfo();
        
        Utils.debugLog(`Historique chargé: ${allControles.length} contrôles`);
    }

    // Tri des contrôles
    sortControles(controles) {
        return [...controles].sort((a, b) => {
            let valueA = a[this.sortField];
            let valueB = b[this.sortField];
            
            // Gestion des dates
            if (this.sortField === 'date') {
                valueA = new Date(valueA);
                valueB = new Date(valueB);
            }
            
            // Gestion des nombres
            if (this.sortField === 'anomaliesMajeures') {
                valueA = parseInt(valueA) || 0;
                valueB = parseInt(valueB) || 0;
            }
            
            // Gestion des chaînes
            if (typeof valueA === 'string') {
                valueA = valueA.toLowerCase();
                valueB = valueB.toLowerCase();
            }
            
            let comparison = 0;
            if (valueA > valueB) comparison = 1;
            if (valueA < valueB) comparison = -1;
            
            return this.sortDirection === 'desc' ? -comparison : comparison;
        });
    }

    // Recherche avancée
    searchHistory() {
        if (!window.persistenceManager) {
            Utils.showNotification('Gestionnaire d\'historique non disponible', 'error');
            return;
        }

        const criteria = this.getSearchCriteria();
        const results = window.persistenceManager.searchControls(criteria);
        
        this.currentResults = this.sortControles(results);
        this.displayResults(this.currentResults);
        this.updateResultsInfo(this.currentResults.length, criteria);
        
        Utils.showNotification(`${this.currentResults.length} résultat(s) trouvé(s)`, 'info');
        Utils.debugLog(`Recherche effectuée: ${this.currentResults.length} résultats`);
    }

    // Presets de dates
    setDatePreset(preset) {
        const now = new Date();
        let startDate, endDate;
        
        switch(preset) {
            case 'thisMonth':
                startDate = new Date(now.getFullYear(), now.getMonth(), 1);
                endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
                break;
            case 'lastMonth':
                startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                endDate = new Date(now.getFullYear(), now.getMonth(), 0);
                break;
            case 'thisYear':
                startDate = new Date(now.getFullYear(), 0, 1);
                endDate = new Date(now.getFullYear(), 11, 31);
                break;
        }
        
        if (startDate && endDate) {
            document.getElementById('history-date-debut').value = startDate.toISOString().split('T')[0];
            document.getElementById('history-date-fin').value = endDate.toISOString().split('T')[0];
            this.searchHistory();
        }
    }

    // Effacer les filtres
    clearFilters() {
        const filterIds = [
            'history-date-debut', 'history-date-fin', 'history-type', 
            'history-conseiller', 'history-client', 'history-conformite'
        ];
        
        filterIds.forEach(id => {
            const element = document.getElementById(id);
            if (element) element.value = '';
        });
        
        this.hideResultsInfo();
        this.loadHistoryData();
        Utils.showNotification('Filtres effacés', 'info');
    }

    // Afficher tout
    showAll() {
        this.clearFilters();
    }

    // Récupérer les critères de recherche
    getSearchCriteria() {
        const dateDebut = document.getElementById('history-date-debut')?.value;
        const dateFin = document.getElementById('history-date-fin')?.value;
        
        return {
            dateDebut: dateDebut ? new Date(dateDebut) : null,
            dateFin: dateFin ? new Date(dateFin) : null,
            type: document.getElementById('history-type')?.value?.trim() || '',
            conseiller: document.getElementById('history-conseiller')?.value?.trim() || '',
            client: document.getElementById('history-client')?.value?.trim() || '',
            conformite: document.getElementById('history-conformite')?.value || ''
        };
    }

    // Mise à jour des statistiques
    updateStats() {
        if (!window.persistenceManager) return;
        
        const stats = window.persistenceManager.getStatistics();
        const statsContainer = document.getElementById('history-stats');
        
        if (statsContainer) {
            statsContainer.innerHTML = `
                <div class="summary-cards">
                    <div class="summary-card ${stats.totalControles === 0 ? 'empty' : ''}">
                        <div class="card-value">${stats.totalControles}</div>
                        <div class="card-label">Total contrôles</div>
                    </div>
                    <div class="summary-card ${stats.tauxConformite >= 80 ? 'success' : stats.tauxConformite >= 60 ? 'warning' : 'danger'}">
                        <div class="card-value">${stats.tauxConformite}%</div>
                        <div class="card-label">Taux conformité</div>
                    </div>
                    <div class="summary-card ${stats.totalAnomaliesMajeures === 0 ? 'success' : 'danger'}">
                        <div class="card-value">${stats.totalAnomaliesMajeures}</div>
                        <div class="card-label">Anomalies majeures</div>
                    </div>
                    <div class="summary-card">
                        <div class="card-value">${stats.controlesMoisActuel}</div>
                        <div class="card-label">Ce mois-ci</div>
                    </div>
                    <div class="summary-card">
                        <div class="card-value">${stats.typePlusFrequent}</div>
                        <div class="card-label">Type le plus fréquent</div>
                    </div>
                </div>
            `;
        }
    }

    // Affichage des résultats avec tri cliquable
    displayResults(controles) {
        const resultsContainer = document.getElementById('history-results');
        
        if (!resultsContainer) return;
        
        // Mettre à jour le compteur filtré
        const filteredCountSpan = document.getElementById('filtered-count');
        if (filteredCountSpan) {
            filteredCountSpan.textContent = controles.length;
        }
        
        if (controles.length === 0) {
            resultsContainer.innerHTML = `
                <div style="text-align: center; padding: 40px; color: #6c757d;">
                    <h3>❌ Aucun résultat</h3>
                    <p>Aucun contrôle ne correspond aux critères de recherche.</p>
                    <button class="btn btn-secondary" onclick="window.historyInterface?.clearFilters()">
                        🗑️ Effacer les filtres
                    </button>
                </div>
            `;
            return;
        }
        
        const tableHtml = `
            <table class="data-table">
                <thead>
                    <tr>
                        <th onclick="window.historyInterface?.sortBy('date')" style="cursor: pointer;" title="Trier par date">
                            📅 Date ${this.getSortIcon('date')}
                        </th>
                        <th onclick="window.historyInterface?.sortBy('type')" style="cursor: pointer;" title="Trier par type">
                            🔍 Type ${this.getSortIcon('type')}
                        </th>
                        <th onclick="window.historyInterface?.sortBy('client')" style="cursor: pointer;" title="Trier par client">
                            👤 Client ${this.getSortIcon('client')}
                        </th>
                        <th>📋 Code</th>
                        <th onclick="window.historyInterface?.sortBy('conseiller')" style="cursor: pointer;" title="Trier par conseiller">
                            👨‍💼 Conseiller ${this.getSortIcon('conseiller')}
                        </th>
                        <th>💰 Montant</th>
                        <th>📄 Documents</th>
                        <th onclick="window.historyInterface?.sortBy('anomaliesMajeures')" style="cursor: pointer;" title="Trier par anomalies">
                            ⚠️ Anomalies ${this.getSortIcon('anomaliesMajeures')}
                        </th>
                        <th onclick="window.historyInterface?.sortBy('conformiteGlobale')" style="cursor: pointer;" title="Trier par conformité">
                            ✅ Conformité ${this.getSortIcon('conformiteGlobale')}
                        </th>
                        <th>🔧 Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${controles.map((controle, index) => `
                        <tr class="${index % 2 === 0 ? 'even' : 'odd'} ${controle.conformiteGlobale === 'CONFORME' ? 'row-conforme' : 'row-non-conforme'}">
                            <td><strong>${controle.date.toLocaleDateString('fr-FR')}</strong></td>
                            <td><span class="badge control-type">${controle.type}</span></td>
                            <td><strong>${controle.client}</strong></td>
                            <td>${controle.codeDossier || 'N/A'}</td>
                            <td>${controle.conseiller || 'N/A'}</td>
                            <td>${controle.montant || 'N/A'}</td>
                            <td><span class="badge secondary">${controle.documentsControles}</span></td>
                            <td><span class="badge ${controle.anomaliesMajeures > 0 ? 'non' : 'oui'}">${controle.anomaliesMajeures}</span></td>
                            <td><span class="badge ${controle.conformiteGlobale === 'CONFORME' ? 'oui' : 'non'}">${controle.conformiteGlobale}</span></td>
                            <td>
                                <button class="btn btn-sm btn-info" 
                                        onclick="window.historyInterface?.showDetails('${controle.id}')"
                                        title="Voir les détails complets de ce contrôle">
                                    📋 Détails
                                </button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
        
        resultsContainer.innerHTML = tableHtml;
    }

    // Icône de tri
    getSortIcon(field) {
        if (this.sortField !== field) return '⚪';
        return this.sortDirection === 'asc' ? '🔼' : '🔽';
    }

    // Tri par colonne
    sortBy(field) {
        if (this.sortField === field) {
            this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
        } else {
            this.sortField = field;
            this.sortDirection = 'desc';
        }
        
        this.currentResults = this.sortControles(this.currentResults);
        this.displayResults(this.currentResults);
        
        Utils.debugLog(`Tri par ${field} (${this.sortDirection})`);
    }

    // Afficher/masquer les infos de résultats
    updateResultsInfo(count, criteria) {
        const infoContainer = document.getElementById('history-info');
        const countSpan = document.getElementById('results-count');
        const detailsSpan = document.getElementById('results-details');
        
        if (infoContainer && countSpan) {
            countSpan.textContent = count;
            
            // Générer le détail des critères appliqués
            const activeCriteria = [];
            if (criteria.dateDebut) activeCriteria.push(`depuis ${criteria.dateDebut.toLocaleDateString('fr-FR')}`);
            if (criteria.dateFin) activeCriteria.push(`jusqu'au ${criteria.dateFin.toLocaleDateString('fr-FR')}`);
            if (criteria.type) activeCriteria.push(`type: ${criteria.type}`);
            if (criteria.conseiller) activeCriteria.push(`conseiller: ${criteria.conseiller}`);
            if (criteria.client) activeCriteria.push(`client: ${criteria.client}`);
            if (criteria.conformite) activeCriteria.push(`conformité: ${criteria.conformite}`);
            
            if (detailsSpan && activeCriteria.length > 0) {
                detailsSpan.textContent = ` (${activeCriteria.join(', ')})`;
            }
            
            infoContainer.style.display = 'block';
        }
    }

    hideResultsInfo() {
        const infoContainer = document.getElementById('history-info');
        if (infoContainer) {
            infoContainer.style.display = 'none';
        }
    }

    // Modal détails d'un contrôle (version simplifiée pour l'instant)
    // Modal détails d'un contrôle (VERSION SANS ÉLÉMENTS FIXES)
showDetails(controleId) {
    if (!window.persistenceManager) return;
    
    const controle = window.persistenceManager.getHistoryData().controles.find(c => c.id == controleId);
    if (!controle) {
        Utils.showNotification('Contrôle non trouvé', 'error');
        return;
    }

    this.closeAllModals();

    const modal = document.createElement('div');
    modal.className = 'justification-modal';
    modal.id = `modal-details-${controleId}`;
    
    modal.innerHTML = `
        <div class="modal-overlay" onclick="window.historyInterface?.closeModal('${controleId}')">
            <div class="modal-content" style="
                max-width: 95vw; 
                max-height: 90vh; 
                width: 1200px; 
                overflow-y: auto; 
                margin: 20px auto;
                padding: 0;
                " onclick="event.stopPropagation();">
                
                <!-- En-tête NORMAL (pas fixe) -->
                <div style="
                    background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); 
                    color: white;
                    padding: 25px; 
                    display: flex; 
                    justify-content: space-between; 
                    align-items: center;
                    border-radius: 15px 15px 0 0;
                ">
                    <h3 style="margin: 0; font-size: 1.3rem;">📋 Détails du contrôle - ${controle.client}</h3>
                    <button class="btn btn-sm" onclick="window.historyInterface?.closeModal('${controleId}')" 
                            style="background: white; color: #1a1a2e; padding: 8px 12px; font-weight: 600;">❌ Fermer</button>
                </div>
                
                <!-- Contenu principal -->
                <div style="padding: 25px;">
                    
                    <!-- Informations principales - Grille VRAIMENT responsive -->
                    <div class="control-summary" style="
                        background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%); 
                        padding: 25px; 
                        border-radius: 12px; 
                        margin-bottom: 25px;
                        border-left: 4px solid #d4af37;
                    ">
                        <h4 style="margin: 0 0 20px 0; color: #1a1a2e;">📊 Informations du contrôle</h4>
                        <div style="
                            display: grid; 
                            grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); 
                            gap: 20px;
                        ">
                            <div class="info-item" style="padding: 10px 0;">
                                <div style="color: #1a1a2e; font-weight: 600; margin-bottom: 5px;">📅 Date de contrôle</div>
                                <div style="font-size: 1.1rem; color: #495057;">${controle.date.toLocaleDateString('fr-FR')}</div>
                            </div>
                            <div class="info-item" style="padding: 10px 0;">
                                <div style="color: #1a1a2e; font-weight: 600; margin-bottom: 5px;">🔍 Type de contrôle</div>
                                <span class="badge control-type" style="font-size: 1rem; padding: 8px 12px;">${controle.type}</span>
                            </div>
                            <div class="info-item" style="padding: 10px 0;">
                                <div style="color: #1a1a2e; font-weight: 600; margin-bottom: 5px;">👤 Client</div>
                                <div style="font-size: 1.1rem; font-weight: 600; color: #495057;">${controle.client}</div>
                            </div>
                            <div class="info-item" style="padding: 10px 0;">
                                <div style="color: #1a1a2e; font-weight: 600; margin-bottom: 5px;">📋 Code dossier</div>
                                <div style="font-size: 1rem; color: #495057;">${controle.codeDossier || 'Non renseigné'}</div>
                            </div>
                            <div class="info-item" style="padding: 10px 0;">
                                <div style="color: #1a1a2e; font-weight: 600; margin-bottom: 5px;">👨‍💼 Conseiller</div>
                                <div style="font-size: 1rem; color: #495057;">${controle.conseiller || 'Non renseigné'}</div>
                            </div>
                            <div class="info-item" style="padding: 10px 0;">
                                <div style="color: #1a1a2e; font-weight: 600; margin-bottom: 5px;">💰 Montant</div>
                                <div style="font-size: 1.1rem; font-weight: 600; color: #28a745;">${controle.montant || 'Non renseigné'}</div>
                            </div>
                            <div class="info-item" style="padding: 10px 0;">
                                <div style="color: #1a1a2e; font-weight: 600; margin-bottom: 5px;">🏢 Domaine</div>
                                <div style="font-size: 1rem; color: #495057;">${controle.domaine || 'Non renseigné'}</div>
                            </div>
                            <div class="info-item" style="padding: 10px 0;">
                                <div style="color: #1a1a2e; font-weight: 600; margin-bottom: 5px;">⭐ Nouveau client</div>
                                <div style="font-size: 1rem; color: #495057;">${controle.nouveauClient || 'Non renseigné'}</div>
                            </div>
                            <div class="info-item" style="padding: 10px 0;">
                                <div style="color: #1a1a2e; font-weight: 600; margin-bottom: 5px;">📄 Documents contrôlés</div>
                                <span class="badge secondary" style="font-size: 1rem; padding: 8px 12px;">${controle.documentsControles}</span>
                            </div>
                            <div class="info-item" style="padding: 10px 0;">
                            <div style="color: #1a1a2e; font-weight: 600; margin-bottom: 5px; font-size: 0.95rem;">⚠️ Anomalies majeures</div>
                            <span class="badge ${controle.anomaliesMajeures > 0 ? 'non' : 'oui'}" 
                                style="font-size: 0.9rem; padding: 4px 10px;">
                                ${controle.anomaliesMajeures}
                            </span>
                        </div>

                        </div>
                        
                        <!-- Conformité globale - Version compacte -->
                            <div style="
                                margin-top: 15px;
                                padding: 12px 16px;
                                background: #f1f3f5;
                                border-radius: 6px;
                                text-align: center;
                                border-left: 4px solid ${controle.conformiteGlobale === 'CONFORME' ? '#28a745' : '#dc3545'};
                                display: inline-block;
                            ">
                                <div style="font-size: 0.95rem; font-weight: 600; color: #1a1a2e;">✅ Conformité globale :</div>
                                <span class="badge ${controle.conformiteGlobale === 'CONFORME' ? 'oui' : 'non'}" 
                                    style="font-size: 1.05rem; padding: 8px 16px; margin-top: 5px; display: inline-block;">
                                    ${controle.conformiteGlobale}
                                </span>
                            </div>
                    
                    ${controle.details && controle.details.length > 0 ? `
                        <!-- Détails des vérifications -->
                        <div style="margin-bottom: 25px;">
                            <h4 style="color: #1a1a2e; margin-bottom: 15px;">📄 Détail des vérifications (${controle.details.length} points de contrôle)</h4>
                            
                            <!-- Tableau responsive avec scroll horizontal -->
                            <div style="
                                border: 2px solid #e9ecef; 
                                border-radius: 12px; 
                                overflow: hidden;
                                background: white;
                            ">
                                <div style="overflow-x: auto; max-height: 400px; overflow-y: auto;">
                                    <table style="
                                        width: 100%; 
                                        border-collapse: collapse; 
                                        font-size: 0.9rem;
                                        min-width: 800px;
                                    ">
                                        <thead style="position: sticky; top: 0; z-index: 5;">
                                            <tr style="background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);">
                                                <th style="color: white; padding: 15px 12px; text-align: left; font-weight: 600; min-width: 120px;">📄 Document</th>
                                                <th style="color: white; padding: 15px 12px; text-align: left; font-weight: 600; min-width: 300px;">❓ Question vérifiée</th>
                                                <th style="color: white; padding: 15px 12px; text-align: center; font-weight: 600; min-width: 100px;">✅ Réponse</th>
                                                <th style="color: white; padding: 15px 12px; text-align: center; font-weight: 600; min-width: 120px;">🔍 Qualité</th>
                                                <th style="color: white; padding: 15px 12px; text-align: left; font-weight: 600; min-width: 250px;">📝 Justification</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            ${controle.details.map((detail, index) => `
                                                <tr style="
                                                    background: ${detail.conforme ? '#f0fff4' : '#fff5f5'}; 
                                                    border-bottom: 1px solid #e9ecef;
                                                    ${!detail.conforme ? 'border-left: 4px solid #dc3545;' : ''}
                                                ">
                                                    <td style="padding: 12px; vertical-align: top;">
                                                        <strong style="color: #1a1a2e;">${detail.document}</strong>
                                                    </td>
                                                    <td style="
                                                        padding: 12px; 
                                                        vertical-align: top; 
                                                        line-height: 1.4;
                                                        word-wrap: break-word;
                                                        max-width: 300px;
                                                    ">
                                                        ${detail.question}
                                                    </td>
                                                    <td style="padding: 12px; text-align: center; vertical-align: top;">
                                                        <span class="badge ${detail.reponse === 'Oui' ? 'oui' : 'non'}" style="padding: 6px 12px;">
                                                            ${detail.reponse}
                                                        </span>
                                                    </td>
                                                    <td style="padding: 12px; text-align: center; vertical-align: top;">
                                                        ${detail.qualite ? `<span style="font-size: 0.9rem; color: #495057;">${detail.qualite}</span>` : '<span style="color: #6c757d;">-</span>'}
                                                    </td>
                                                    <td style="
                                                        padding: 12px; 
                                                        vertical-align: top; 
                                                        line-height: 1.4;
                                                        word-wrap: break-word;
                                                        max-width: 250px;
                                                    ">
                                                        ${detail.justification ? `<span style="font-size: 0.9rem; color: #495057; font-style: italic;">${detail.justification}</span>` : '<span style="color: #6c757d;">-</span>'}
                                                    </td>
                                                </tr>
                                            `).join('')}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                        
                        <!-- Résumé des anomalies -->
                        ${this.generateAnomaliesResume(controle.details)}
                        
                    ` : `
                        <div style="
                            text-align: center; 
                            padding: 40px; 
                            color: #6c757d; 
                            background: #f8f9fa; 
                            border-radius: 12px;
                            border: 2px dashed #dee2e6;
                        ">
                            <h4>📄 Aucun détail de vérification</h4>
                            <p>Les détails des vérifications ne sont pas disponibles pour ce contrôle.</p>
                            <small>Cela peut arriver pour les contrôles effectués avant la mise à jour du système.</small>
                        </div>
                    `}
                    
                </div>
                
                <!-- Pied de page NORMAL (pas fixe) -->
                <div style="
                    background: #f8f9fa; 
                    padding: 20px 25px; 
                    border-top: 1px solid #e9ecef;
                    display: flex; 
                    justify-content: space-between; 
                    gap: 15px;
                    border-radius: 0 0 15px 15px;
                    flex-wrap: wrap;
                ">
                    <button class="btn btn-info" onclick="window.historyInterface?.exportSingleControl('${controle.id}')" 
                            title="Exporter ce contrôle spécifique en Excel">
                        📊 Exporter ce contrôle
                    </button>
                    <button class="btn btn-secondary" onclick="window.historyInterface?.closeModal('${controleId}')">
                        ❌ Fermer
                    </button>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
}

    // AJOUTER cette méthode pour le résumé des anomalies
    generateAnomaliesResume(details) {
        const anomalies = details.filter(d => !d.conforme);
        const anomaliesObligatoires = anomalies.filter(d => d.obligatoire);
        
        if (anomalies.length === 0) {
            return `
                <div style="
                    margin-top: 20px; 
                    padding: 20px; 
                    background: linear-gradient(135deg, #d4edda 0%, #c3e6cb 100%); 
                    border: 2px solid #28a745; 
                    border-radius: 12px;
                    text-align: center;
                ">
                    <h5 style="color: #155724; margin: 0 0 10px 0;">✅ Contrôle parfaitement conforme</h5>
                    <p style="margin: 0; color: #155724; font-size: 1.1rem;">Aucune anomalie détectée dans ce contrôle.</p>
                    <p style="margin: 10px 0 0 0; color: #155724; font-weight: 600;">🏆 Excellent travail !</p>
                </div>
            `;
        }
        
        return `
            <div style="
                margin-top: 20px; 
                padding: 20px; 
                background: ${anomaliesObligatoires.length > 0 ? 'linear-gradient(135deg, #f8d7da 0%, #f5c6cb 100%)' : 'linear-gradient(135deg, #fff3cd 0%, #ffeaa7 100%)'}; 
                border: 2px solid ${anomaliesObligatoires.length > 0 ? '#dc3545' : '#ffc107'}; 
                border-radius: 12px;
            ">
                <h5 style="color: ${anomaliesObligatoires.length > 0 ? '#721c24' : '#856404'}; margin: 0 0 15px 0;">
                    ⚠️ Résumé des anomalies détectées
                </h5>
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 15px;">
                    <div style="background: rgba(255,255,255,0.7); padding: 15px; border-radius: 8px;">
                        <strong style="color: ${anomaliesObligatoires.length > 0 ? '#721c24' : '#856404'};">Total anomalies :</strong><br>
                        <span style="font-size: 1.5rem; font-weight: bold;">${anomalies.length}</span>
                    </div>
                    <div style="background: rgba(255,255,255,0.7); padding: 15px; border-radius: 8px;">
                        <strong style="color: #dc3545;">Anomalies obligatoires :</strong><br>
                        <span style="font-size: 1.5rem; font-weight: bold; color: #dc3545;">${anomaliesObligatoires.length}</span>
                    </div>
                    <div style="background: rgba(255,255,255,0.7); padding: 15px; border-radius: 8px;">
                        <strong style="color: #6c757d;">Anomalies optionnelles :</strong><br>
                        <span style="font-size: 1.5rem; font-weight: bold; color: #6c757d;">${anomalies.length - anomaliesObligatoires.length}</span>
                    </div>
                </div>
                <div style="margin-top: 15px; text-align: center;">
                    ${anomaliesObligatoires.length > 0 ? 
                        '<p style="margin: 0; font-weight: bold; color: #721c24; font-size: 1.1rem;">❌ CONTRÔLE NON CONFORME</p>' : 
                        '<p style="margin: 0; color: #856404; font-size: 1.1rem;">⚠️ Contrôle avec réserves mineures</p>'
                    }
                </div>
            </div>
        `;
    }

    // Export complet
    exportComplete() {
        if (window.persistenceManager) {
            window.persistenceManager.saveToExcel();
            Utils.showNotification('Export historique complet en cours...', 'info');
        } else {
            Utils.showNotification('Gestionnaire d\'historique non disponible', 'error');
        }
    }

    // Export filtré
    exportFiltered() {
        if (this.currentResults.length === 0) {
            Utils.showNotification('Aucun résultat à exporter', 'warning');
            return;
        }

        const criteria = this.getSearchCriteria();
        const fileName = `Historique_Filtré_${new Date().toISOString().split('T')[0]}.xlsx`;
        
        if (window.persistenceManager) {
            window.persistenceManager.exportFiltered(criteria, fileName);
            Utils.showNotification(`Export de ${this.currentResults.length} contrôle(s) en cours...`, 'info');
        } else {
            Utils.showNotification('Gestionnaire d\'historique non disponible', 'error');
        }
    }

    // Modal statistiques (version simple)
    showStatistics() {
        if (!window.persistenceManager) {
            Utils.showNotification('Gestionnaire d\'historique non disponible', 'error');
            return;
        }

        const stats = window.persistenceManager.getStatistics();
        
        // IMPORTANT : Supprimer toute modal existante d'abord
        this.closeAllModals();
        
        const modal = document.createElement('div');
        modal.className = 'justification-modal';
        modal.id = 'modal-statistics';
        
        modal.innerHTML = `
            <div class="modal-overlay" onclick="window.historyInterface?.closeStatsModal()">
                <div class="modal-content" style="max-width: 700px;" onclick="event.stopPropagation();">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                        <h3>📈 Statistiques détaillées</h3>
                        <button class="btn btn-sm btn-secondary" onclick="window.historyInterface?.closeStatsModal()" 
                                style="padding: 5px 10px;">❌</button>
                    </div>
                    
                    <div class="summary-cards" style="margin-bottom: 25px;">
                        <div class="summary-card">
                            <div class="card-value">${stats.totalControles}</div>
                            <div class="card-label">Total contrôles</div>
                        </div>
                        <div class="summary-card ${stats.tauxConformite >= 80 ? 'success' : 'warning'}">
                            <div class="card-value">${stats.tauxConformite}%</div>
                            <div class="card-label">Taux conformité global</div>
                        </div>
                        <div class="summary-card ${stats.totalAnomaliesMajeures === 0 ? 'success' : 'danger'}">
                            <div class="card-value">${stats.totalAnomaliesMajeures}</div>
                            <div class="card-label">Anomalies majeures</div>
                        </div>
                        <div class="summary-card">
                            <div class="card-value">${stats.controlesMoisActuel}</div>
                            <div class="card-label">Contrôles ce mois-ci</div>
                        </div>
                    </div>
                    
                    <h4>📊 Répartition par type de contrôle</h4>
                    <div class="type-stats" style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
                        ${Object.entries(stats.repartitionTypes).length > 0 ? 
                            Object.entries(stats.repartitionTypes).map(([type, count]) => `
                                <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid #e9ecef;">
                                    <span><strong>${type}</strong></span>
                                    <div>
                                        <span class="badge control-type">${count} contrôle(s)</span>
                                        <span style="margin-left: 10px; color: #6c757d;">${stats.totalControles > 0 ? Math.round((count / stats.totalControles) * 100) : 0}%</span>
                                    </div>
                                </div>
                            `).join('') :
                            '<p style="text-align: center; color: #6c757d;">Aucune donnée de répartition disponible</p>'
                        }
                    </div>
                    
                    <div style="background: #e3f2fd; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
                        <h5>🏆 Type le plus fréquent</h5>
                        <p style="margin: 5px 0;"><strong>${stats.typePlusFrequent}</strong></p>
                        
                        <h5 style="margin-top: 15px;">📈 Évaluation globale</h5>
                        <p style="margin: 5px 0;">
                            ${stats.tauxConformite >= 90 ? '🟢 Excellent niveau de conformité (≥90%)' : 
                            stats.tauxConformite >= 75 ? '🟡 Bon niveau de conformité (75-89%)' : 
                            stats.tauxConformite >= 50 ? '🟠 Niveau de conformité moyen (50-74%)' :
                            '🔴 Niveau de conformité à améliorer (<50%)'}
                        </p>
                    </div>
                    
                    <div style="display: flex; justify-content: space-between; gap: 15px;">
                        <button class="btn btn-primary" onclick="window.historyInterface?.exportComplete()">
                            📊 Exporter historique Excel
                        </button>
                        <button class="btn btn-secondary" onclick="window.historyInterface?.closeStatsModal()">
                            ❌ Fermer
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Ajouter un écouteur pour la touche Échap
        const handleEscape = (e) => {
            if (e.key === 'Escape') {
                this.closeStatsModal();
                document.removeEventListener('keydown', handleEscape);
            }
        };
        document.addEventListener('keydown', handleEscape);
        
        // Stocker la référence pour le nettoyage
        modal.escapeHandler = handleEscape;
    }

    // Effacer l'historique avec confirmation
    clearHistory() {
        if (!window.persistenceManager) {
            Utils.showNotification('Gestionnaire d\'historique non disponible', 'error');
            return;
        }

        const totalControles = window.persistenceManager.getControlsCount();
        
        if (totalControles === 0) {
            Utils.showNotification('L\'historique est déjà vide', 'info');
            return;
        }

        const confirmed = confirm(
            `⚠️ ATTENTION ⚠️\n\n` +
            `Vous êtes sur le point d'effacer DÉFINITIVEMENT tout l'historique.\n\n` +
            `${totalControles} contrôle(s) seront supprimé(s).\n\n` +
            `Cette action est IRRÉVERSIBLE.\n\n` +
            `Voulez-vous continuer ?`
        );

        if (confirmed) {
            const doubleConfirm = confirm(
                `🚨 DERNIÈRE CONFIRMATION 🚨\n\n` +
                `Êtes-vous ABSOLUMENT certain de vouloir effacer tous les contrôles ?\n\n` +
                `Cliquez sur "Annuler" si vous avez un doute.`
            );

            if (doubleConfirm) {
                window.persistenceManager.clearHistory();
                this.loadHistoryData();
                Utils.showNotification('Historique effacé définitivement', 'success');
            } else {
                Utils.showNotification('Suppression annulée', 'info');
            }
        } else {
            Utils.showNotification('Suppression annulée', 'info');
        }
    }

    // Utilitaires
    isHistorySectionActive() {
        const section = document.getElementById('history-section');
        return section && section.classList.contains('active');
    }

    getHistoryData() {
        return window.persistenceManager ? window.persistenceManager.getHistoryData() : { controles: [] };
    }

    getControlsCount() {
        return this.getHistoryData().controles.length;
    }

    // Méthode pour rafraîchir l'interface (utile pour les mises à jour externes)
    refresh() {
        if (this.isHistorySectionActive()) {
            this.loadHistoryData();
            Utils.debugLog('Interface historique rafraîchie');
        }
    }

    // Méthode pour obtenir les statistiques de la vue actuelle
    getCurrentViewStats() {
        const total = this.currentResults.length;
        const conformes = this.currentResults.filter(c => c.conformiteGlobale === 'CONFORME').length;
        const anomalies = this.currentResults.reduce((sum, c) => sum + c.anomaliesMajeures, 0);
        
        return {
            total,
            conformes,
            tauxConformite: total > 0 ? Math.round((conformes / total) * 100) : 0,
            anomalies,
            nonConformes: total - conformes
        };
    }

    // Méthode pour exporter un contrôle spécifique
    exportSingleControl(controleId) {
        if (!window.persistenceManager) return;
        
        const controle = window.persistenceManager.getHistoryData().controles.find(c => c.id == controleId);
        if (!controle) {
            Utils.showNotification('Contrôle non trouvé', 'error');
            return;
        }

        const exportData = [{
            'Date': controle.date.toLocaleDateString('fr-FR'),
            'Type de contrôle': controle.type,
            'Client': controle.client,
            'Code dossier': controle.codeDossier,
            'Conseiller': controle.conseiller,
            'Montant': controle.montant,
            'Domaine': controle.domaine,
            'Nouveau client': controle.nouveauClient,
            'Documents contrôlés': controle.documentsControles,
            'Anomalies majeures': controle.anomaliesMajeures,
            'Conformité': controle.conformiteGlobale
        }];

        try {
            const ws = XLSX.utils.json_to_sheet(exportData);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Controle");
            
            const fileName = `Controle_${controle.client.replace(/[^a-zA-Z0-9]/g, '_')}_${controle.date.toISOString().split('T')[0]}.xlsx`;
            XLSX.writeFile(wb, fileName);
            
            Utils.showNotification(`Contrôle de ${controle.client} exporté`, 'success');
        } catch (error) {
            Utils.showNotification('Erreur lors de l\'export du contrôle', 'error');
            console.error('Erreur export:', error);
        }
    }

    // Fermer une modal spécifique
    closeModal(controleId) {
        const modal = document.getElementById(`modal-details-${controleId}`);
        if (modal) {
            modal.remove();
            Utils.debugLog(`Modal ${controleId} fermée`);
        }
    }

    // Fermer toutes les modals
    closeAllModals() {
        const modals = document.querySelectorAll('.justification-modal');
        modals.forEach(modal => modal.remove());
        if (modals.length > 0) {
            Utils.debugLog(`${modals.length} modal(s) fermée(s)`);
        }
    }

    // Fermer la modal de statistiques
    closeStatsModal() {
        const modal = document.getElementById('modal-statistics');
        if (modal) {
            modal.remove();
            Utils.debugLog('Modal statistiques fermée');
        }
    }

    closeStatsModal() {
        const modal = document.getElementById('modal-statistics');
        if (modal) {
            // Nettoyer l'écouteur d'événement
            if (modal.escapeHandler) {
                document.removeEventListener('keydown', modal.escapeHandler);
            }
            
            // Supprimer la modal
            modal.remove();
            
            Utils.debugLog('Modal statistiques fermée proprement');
        }
    }

    // AJOUTER cette méthode à la fin de la classe pour le nettoyage général
    cleanup() {
        this.closeAllModals();
        
        // Nettoyer les timeouts
        if (this.searchTimeout) {
            clearTimeout(this.searchTimeout);
            this.searchTimeout = null;
        }
        
        Utils.debugLog('HistoryInterface nettoyé');
    }

}