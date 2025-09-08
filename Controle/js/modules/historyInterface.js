// historyInterface.js - Version complète enrichie avec export détaillé

import { Utils } from './utils.js';

export class HistoryInterface {
    constructor() {
        this.currentResults = [];
        this.searchTimeout = null;
        this.sortField = 'date';
        this.sortDirection = 'desc';
        this.showSuspended = false;
        this.init();
    }

    init() {
        this.createHistorySection();
        this.addTabStyles();
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
            
            <!-- Input caché pour import JSON -->
            <input type="file" id="import-backup" style="display:none" accept=".json" 
                   onchange="window.persistenceManager?.importBackupJSON(this.files[0])">
            
            <!-- NOUVEAU : Header avec onglets et bouton mail -->
            <div class="history-header">
                <div class="history-tabs">
                    <button class="tab-btn ${!this.showSuspended ? 'active' : ''}" 
                            onclick="window.historyInterface?.switchTab(false)">
                        ✅ Contrôles terminés
                    </button>
                    <button class="tab-btn ${this.showSuspended ? 'active' : ''}" 
                            onclick="window.historyInterface?.switchTab(true)">
                        ⏸️ Contrôles suspendus <span class="tab-badge" id="suspended-count-badge">0</span>
                    </button>
                </div>
                
                <!-- Bouton mail unifié et élégant -->
                <div class="history-mail-actions">
                    <button class="btn btn-mail" 
                            id="history-mail-btn"
                            onclick="window.historyInterface?.handleMailAction()"
                            title="Envoyer un email au conseiller">
                        📧 Email conseiller
                    </button>
                </div>
            </div>
            
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
                               placeholder="Nom du conseiller..." autocomplete="off">
                    </div>
                    <div class="filter-group">
                        <label class="filter-label">👤 Client</label>
                        <input type="text" id="history-client" class="filter-input" 
                               placeholder="Nom du client..." autocomplete="off">
                    </div>
                    <div class="filter-group">
                        <label class="filter-label">${this.showSuspended ? '⏰ Durée suspension' : '✅ Conformité'}</label>
                        <select id="history-conformite" class="filter-select">
                            ${this.showSuspended ? `
                                <option value="">⏰ Toutes durées</option>
                                <option value="recent">📅 Récents (-7j)</option>
                                <option value="old">⚠️ Anciens (14j+)</option>
                                <option value="very-old">🚨 Très anciens (30j+)</option>
                            ` : `
                                <option value="">📊 Toutes</option>
                                <option value="CONFORME">✅ Conforme</option>
                                <option value="NON CONFORME">❌ Non conforme</option>
                            `}
                        </select>
                    </div>
                </div>
                
                <div class="btn-group">
                    <button class="btn btn-primary" onclick="window.historyInterface?.searchHistory()">
                        🔍 Rechercher
                    </button>
                    <button class="btn btn-secondary" onclick="window.historyInterface?.clearFilters()">
                        🗑️ Effacer filtres
                    </button>
                    <button class="btn btn-info" onclick="window.historyInterface?.showAll()">
                        📋 Afficher tout
                    </button>
                    ${this.showSuspended ? `
                        <button class="btn btn-warning" onclick="window.historyInterface?.cleanOldSuspended()">
                            🧹 Nettoyer anciens
                        </button>
                    ` : `
                        <button class="btn btn-warning" onclick="window.historyInterface?.setDatePreset('thisMonth')">
                            📅 Ce mois
                        </button>
                    `}
                </div>
            </div>
            
            <!-- Statistiques détaillées -->
            <div class="history-summary" id="history-stats">
                <div class="summary-cards" id="summary-cards-container">
                    <!-- Statistiques générées dynamiquement -->
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
            
            <!-- Actions de gestion -->
            <div class="history-management-actions" style="
                background: #f8f9fa;
                padding: 20px;
                border-radius: 10px;
                margin-bottom: 25px;
                border-left: 4px solid #6c757d;
            ">
                <h4 style="margin: 0 0 15px 0; color: #1a1a2e; font-size: 1.1rem;">⚙️ Gestion de l'historique</h4>
                <div class="btn-group">
                    <button class="btn btn-secondary" onclick="window.persistenceManager?.exportBackupJSON()">
                        💾 Sauvegarder
                    </button>
                    <button class="btn btn-secondary" onclick="document.getElementById('import-backup').click()">
                        📂 Restaurer
                    </button>
                    <button class="btn btn-third" onclick="window.historyInterface?.clearHistory()">
                        🗑️ Effacer tout
                    </button>
                </div>
            </div>

            <!-- Actions d'export et consultation -->
            <div class="history-actions">
                <div class="btn-group">
                    <button class="btn btn-primary" onclick="window.historyInterface?.exportComplete()">
                        📊 Exporter Historique
                    </button>
                    <button class="btn btn-primary" onclick="window.historyInterface?.exportFiltered()">
                        📋 Exporter Résultats (<span id="filtered-count">0</span>)
                    </button>
                    ${this.showSuspended ? `
                        <button class="btn btn-warning" onclick="window.persistenceManager?.exportSuspendedControls()">
                            ⏸️ Exporter Suspendus
                        </button>
                    ` : `
                        <button class="btn btn-primary" onclick="window.historyInterface?.showStatistics()">
                            📈 Statistiques
                        </button>
                    `}
                </div>
                
                <div class="btn-group">
                    <button class="btn btn-secondary" onclick="showAutomaticControls()">
                        ⬅️ Retour aux contrôles
                    </button>
                </div>
            </div>
        `;
        
        const container = document.querySelector('.container');
    if (container) {
        container.appendChild(section);
        
        // AJOUTER CES LIGNES pour initialiser le bouton mail :
        this.updateMailButton();
        this.updateSuspendedBadge();
        
        }
    }

    generateGlobalStats(stats) {
        return `
            <div class="global-stats-container">
                <div class="summary-cards" style="margin-bottom: 25px;">
                    <div class="summary-card">
                        <div class="card-value">${stats.totalControles}</div>
                        <div class="card-label">Total contrôles</div>
                    </div>
                    <div class="summary-card ${stats.tauxConformite >= 80 ? 'success' : stats.tauxConformite >= 60 ? 'warning' : 'danger'}">
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
                
                <h4>Répartition par type de contrôle</h4>
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
                    <h5>Type le plus fréquent</h5>
                    <p style="margin: 5px 0;"><strong>${stats.typePlusFrequent}</strong></p>
                    
                    <h5 style="margin-top: 15px;">Évaluation globale</h5>
                    <p style="margin: 5px 0;">
                        ${stats.tauxConformite >= 90 ? 'Excellent niveau de conformité (≥90%)' : 
                        stats.tauxConformite >= 75 ? 'Bon niveau de conformité (75-89%)' : 
                        stats.tauxConformite >= 50 ? 'Niveau de conformité moyen (50-74%)' :
                        'Niveau de conformité à améliorer (<50%)'}
                    </p>
                </div>
            </div>
        `;
    }

    // À ajouter dans la classe HistoryInterface
    getCompletedControlsCount(type, month, year) {
        if (!window.persistenceManager) return 0;
        
        const controls = window.persistenceManager.getHistoryData().controles;
        return controls.filter(control => {
            const controlDate = new Date(control.date);
            return control.type === type && 
                   controlDate.getMonth() === month && 
                   controlDate.getFullYear() === year;
        }).length;
    }
    
    generateObjectivesPanel(objectives) {
        const currentYear = new Date().getFullYear();
        
        // Récupérer les données comme dans l'onglet Global
        const controls = window.persistenceManager ? window.persistenceManager.getHistoryData().controles : [];
        
        // DEBUG : Afficher les données
        console.log('=== DEBUG OBJECTIFS ===');
        console.log('Nombre total de contrôles:', controls.length);
        console.log('Types dans objectives:', Object.keys(objectives.controlTargets));
        
        // Voir tous les types de contrôles existants
        const existingTypes = [...new Set(controls.map(c => c.type))];
        console.log('Types existants dans les contrôles:', existingTypes);
        console.log('Premier contrôle exemple:', controls[0]); // Pour voir un exemple complet

        
        // Voir les contrôles de cette année
        const thisYearControls = controls.filter(c => new Date(c.date).getFullYear() === currentYear);
        console.log('Contrôles de cette année:', thisYearControls.length);
        
        return `
            <div class="objectives-container">
                <h4>Suivi des objectifs annuels ${currentYear}</h4>
                <div class="objectives-grid">
                    ${Object.entries(objectives.controlTargets).map(([type, targets]) => {
                        // DEBUG pour chaque type
                        const completed = controls.filter(control => {
                            const controlYear = new Date(control.date).getFullYear();
                            const match = control.type === type && controlYear === currentYear;
                            return match;
                        }).length;
                        
                        console.log(`Type "${type}": ${completed} contrôles trouvés`);
                        
                        const percentage = targets.yearly > 0 ? Math.round((completed / targets.yearly) * 100) : 0;
                        const progressClass = percentage >= 100 ? 'complete' : percentage >= 75 ? 'good' : percentage >= 50 ? 'warning' : 'danger';
                        
                        return `
                            <div class="objective-card">
                                <div class="objective-header">
                                    <h5>${type}</h5>
                                    <span class="objective-percentage ${progressClass}">${percentage}%</span>
                                </div>
                                <div class="objective-progress">
                                    <div class="progress-bar">
                                        <div class="progress-fill ${progressClass}" style="width: ${Math.min(percentage, 100)}%"></div>
                                    </div>
                                    <div class="progress-text">
                                        ${completed} / ${targets.yearly} contrôles
                                        ${completed >= targets.yearly ? ' ✓ Objectif atteint' : ` (${targets.yearly - completed} restants)`}
                                    </div>
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        `;
    }

    getCompletedControlsForYear(type, year) {
        if (!window.persistenceManager) return 0;
        
        const controls = window.persistenceManager.getHistoryData().controles;
        return controls.filter(control => {
            const controlDate = new Date(control.date);
            return control.type === type && controlDate.getFullYear() === year;
        }).length;
    }
    
    // Méthode pour afficher le détail d'un CGP
    showCGPDetail(cgpName) {
        const statsByCGP = window.persistenceManager.getStatisticsByCGP();
        const cgpStats = statsByCGP[cgpName];
        
        if (!cgpStats) return;
        
        const detailModal = document.createElement('div');
        detailModal.className = 'justification-modal';
        detailModal.innerHTML = `
            <div class="modal-overlay" onclick="this.parentElement.remove()">
                <div class="modal-content" onclick="event.stopPropagation()">
                    <div class="modal-header">
                        <h3>Détail du calcul - ${cgpName}</h3>
                        <button class="btn btn-sm btn-secondary" onclick="this.closest('.justification-modal').remove()">✕</button>
                    </div>
                    
                    <div class="cgp-detail-content">
                        <div class="cgp-summary">
                            <div class="summary-item">
                                <span>Total contrôles:</span>
                                <span>${cgpStats.totalControles}</span>
                            </div>
                            <div class="summary-item">
                                <span>Taux conformité:</span>
                                <span class="${this.getConformityClass(cgpStats.tauxConformite)}">${cgpStats.tauxConformite}%</span>
                            </div>
                            <div class="summary-item">
                                <span>Points obtenus:</span>
                                <span>${cgpStats.pointsTotal} / ${cgpStats.pointsMax}</span>
                            </div>
                            <div class="summary-item">
                                <span>Commission:</span>
                                <span class="${cgpStats.eligibleCommission ? 'eligible' : 'not-eligible'}">
                                    ${cgpStats.eligibleCommission ? 'Éligible' : 'Non éligible'}
                                </span>
                            </div>
                        </div>
                        
                        <h5>Détail des points par contrôle:</h5>
                        <div class="calcul-details" style="max-height: 300px; overflow-y: auto;">
                            <table class="detail-table">
                                <thead>
                                    <tr>
                                        <th>Client</th>
                                        <th>Date</th>
                                        <th>Question</th>
                                        <th>Niveau</th>
                                        <th>Points</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${cgpStats.calculDetails.map(detail => `
                                        <tr>
                                            <td>${detail.client}</td>
                                            <td>${new Date(detail.date).toLocaleDateString('fr-FR')}</td>
                                            <td style="max-width: 200px; overflow: hidden; text-overflow: ellipsis;">${detail.question}</td>
                                            <td><span class="level-badge ${detail.niveau}">${detail.niveau}</span></td>
                                            <td>${detail.points}</td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                    </div>
                    
                    <div class="modal-footer">
                        <button class="btn btn-secondary" onclick="this.closest('.justification-modal').remove()">
                            Fermer
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(detailModal);
    }
    
    getConformityClass(rate) {
        if (rate >= 80) return 'high';
        if (rate >= 60) return 'medium';
        return 'low';
    }

    // NOUVEAU : Méthode pour mettre à jour le bouton mail
    updateMailButton() {
         const mailButton = document.getElementById('history-mail-btn');
            if (!mailButton) {
                console.log('Bouton mail non trouvé');
                return;
            }
            
            // Juste mettre à jour le titre et l'indicateur visuel
            mailButton.title = this.showSuspended ? 
                'Envoyer un email de relance pour les contrôles suspendus' : 
                'Envoyer un email concernant les dossiers non conformes';
            
            // Ajouter/retirer la classe pour l'indicateur discret
            if (this.showSuspended) {
                mailButton.classList.add('for-suspended');
            } else {
                mailButton.classList.remove('for-suspended');
            }
            
            console.log(`Bouton mail mis à jour pour: ${this.showSuspended ? 'suspendus' : 'terminés'}`);
        }

    // Navigation vers l'historique
    show() {
         Utils.debugLog('Affichage interface historique avec suspendus');
        
        if (!window.persistenceManager) {
            Utils.showNotification('Gestionnaire d\'historique non disponible', 'error');
            return;
        }
        
        Utils.showSection('history-section');
        this.updateSuspendedBadge();
        this.loadHistoryData();
    }

    // Chargement des données avec tri
    loadHistoryData() {
         if (!window.persistenceManager) {
            Utils.showNotification('Gestionnaire d\'historique non disponible', 'error');
            return;
        }
        
        if (this.showSuspended) {
            // Charger les contrôles suspendus
            const suspendedControls = window.persistenceManager.getSuspendedControls();
            this.currentResults = this.formatSuspendedForDisplay(suspendedControls);
        } else {
            // Charger les contrôles terminés
            const allControles = window.persistenceManager.getHistoryData().controles;
            this.currentResults = this.sortControles(allControles);
        }
        
        this.displayResults(this.currentResults);
        this.updateStats();
        this.hideResultsInfo();
        
        // Mettre à jour le badge du nombre de suspendus
        this.updateSuspendedBadge();
        
        Utils.debugLog(`Historique chargé (${this.showSuspended ? 'suspendus' : 'terminés'}): ${this.currentResults.length} contrôles`);
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
            if (this.sortField === 'anomaliesMajeures' || this.sortField === 'daysSuspended') {
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
        
        if (this.showSuspended) {
            criteria.includeSuspended = true;
            const results = window.persistenceManager.searchControls(criteria)
                .filter(result => result.isSuspended);

                // Appliquer les filtres spéciaux pour les suspendus
            this.currentResults = this.applySuspendedFilters(results, criteria);
        } else {
            const results = window.persistenceManager.searchControls(criteria);
            this.currentResults = this.sortControles(results.filter(result => !result.isSuspended));
        }
        
        this.displayResults(this.currentResults);
        this.updateResultsInfo(this.currentResults.length, criteria);
        
        Utils.showNotification(`${this.currentResults.length} résultat(s) trouvé(s)`, 'info');
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
        const statsContainer = document.getElementById('summary-cards-container');
        
        if (statsContainer) {
            if (this.showSuspended) {
                // Statistiques pour les suspendus (inchangées)
                const suspended = window.persistenceManager.getSuspendedControls();
                const oldSuspended = suspended.filter(s => {
                    const days = Math.floor((new Date() - new Date(s.suspendedAt)) / (1000 * 60 * 60 * 24));
                    return days >= 14;
                }).length;
                const veryOldSuspended = suspended.filter(s => {
                    const days = Math.floor((new Date() - new Date(s.suspendedAt)) / (1000 * 60 * 60 * 24));
                    return days >= 30;
                }).length;
                
                statsContainer.innerHTML = `
                    <div class="summary-card ${suspended.length === 0 ? 'empty' : 'warning'}">
                        <div class="card-value">${suspended.length}</div>
                        <div class="card-label">Total suspendus</div>
                    </div>
                    <div class="summary-card ${oldSuspended === 0 ? 'success' : 'warning'}">
                        <div class="card-value">${oldSuspended}</div>
                        <div class="card-label">Anciens (14j+)</div>
                    </div>
                    <div class="summary-card ${veryOldSuspended === 0 ? 'success' : 'danger'}">
                        <div class="card-value">${veryOldSuspended}</div>
                        <div class="card-label">Très anciens (30j+)</div>
                    </div>
                    <div class="summary-card">
                        <div class="card-value">${suspended.length > 0 ? Math.round(suspended.reduce((sum, s) => {
                            const days = Math.floor((new Date() - new Date(s.suspendedAt)) / (1000 * 60 * 60 * 24));
                            return sum + days;
                        }, 0) / suspended.length) : 0}j</div>
                        <div class="card-label">Durée moyenne</div>
                    </div>
                `;
            } else {
                // NOUVEAU : Statistiques étendues avec révisions
                const revisionSummary = window.persistenceManager.getRevisionSummary();
                
                statsContainer.innerHTML = `
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
                    
                    <!-- NOUVEAU : Statistiques de révisions -->
                    ${revisionSummary.totalRevisions > 0 ? `
                        <div class="summary-card revision-card">
                            <div class="card-value">${revisionSummary.totalRevisions}</div>
                            <div class="card-label">Révisions C2R</div>
                        </div>
                        <div class="summary-card ${revisionSummary.improvedCompliance > 0 ? 'success' : 'neutral'}">
                            <div class="card-value">${revisionSummary.improvedCompliance}</div>
                            <div class="card-label">Améliorées</div>
                        </div>
                    ` : ''}
                    
                    <!-- NOUVEAU : Répartition par type -->
                    <div class="summary-card-wide" style="grid-column: 1 / -1; margin-top: 15px;">
                        <div class="completion-breakdown">
                            <h5 style="margin: 0 0 10px 0; color: #1a1a2e;">Répartition des finalisations</h5>
                            <div style="display: flex; gap: 20px; justify-content: center; flex-wrap: wrap;">
                                <div class="completion-stat">
                                    <span class="badge direct-completion">C1: ${stats.c1Controls}</span>
                                    <div style="font-size: 0.8rem; color: #6c757d;">Direct</div>
                                </div>
                                <div class="completion-stat">
                                    <span class="badge suspended-completion">C1S: ${stats.c1sControls}</span>
                                    <div style="font-size: 0.8rem; color: #6c757d;">Après suspension</div>
                                </div>
                                ${stats.c2rControls > 0 ? `
                                    <div class="completion-stat">
                                        <span class="badge revision-completion">C2R: ${stats.c2rControls}</span>
                                        <div style="font-size: 0.8rem; color: #6c757d;">Révisions</div>
                                    </div>
                                ` : ''}
                            </div>
                        </div>
                    </div>
                `;
            }
        }
    }
    // Affichage des résultats avec tri cliquable et actions enrichies
    displayResults(controles) {
        const resultsContainer = document.getElementById('history-results');
        
        if (!resultsContainer) return;
        
        const filteredCountSpan = document.getElementById('filtered-count');
        if (filteredCountSpan) {
            filteredCountSpan.textContent = controles.length;
        }
        
        if (controles.length === 0) {
            const emptyMessage = this.showSuspended ? 
                '❌ Aucun contrôle suspendu trouvé' : 
                '❌ Aucun contrôle terminé trouvé';
            const emptyDescription = this.showSuspended ?
                'Aucun contrôle suspendu ne correspond aux critères.' :
                'Aucun contrôle terminé ne correspond aux critères.';
                
            resultsContainer.innerHTML = `
                <div style="text-align: center; padding: 40px; color: #6c757d;">
                    <h3>${emptyMessage}</h3>
                    <p>${emptyDescription}</p>
                    <button class="btn btn-secondary" onclick="window.historyInterface?.clearFilters()">
                        🗑️ Effacer les filtres
                    </button>
                </div>
            `;
            return;
        }
        
        const tableHtml = `
            <table class="data-table ${this.showSuspended ? 'suspended-history-table' : ''}">
                <thead>
                    <tr>
                        <th onclick="window.historyInterface?.sortBy('date')" style="cursor: pointer;" title="Trier par date">
                            📅 ${this.showSuspended ? 'Suspendu le' : 'Date'} ${this.getSortIcon('date')}
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
                        
                        ${!this.showSuspended ? `
                            <!-- NOUVELLE COLONNE pour les contrôles terminés -->
                            <th onclick="window.historyInterface?.sortBy('completionType')" style="cursor: pointer;" title="Trier par type de finalisation">
                                🔄 Finalisation ${this.getSortIcon('completionType')}
                            </th>
                        ` : ''}
                        
                        ${this.showSuspended ? `
                            <th onclick="window.historyInterface?.sortBy('daysSuspended')" style="cursor: pointer;" title="Trier par durée">
                                ⏰ Durée ${this.getSortIcon('daysSuspended')}
                            </th>
                            <th>📝 Raison</th>
                        ` : `
                            <th onclick="window.historyInterface?.sortBy('anomaliesMajeures')" style="cursor: pointer;" title="Trier par anomalies">
                                ⚠️ Anomalies ${this.getSortIcon('anomaliesMajeures')}
                            </th>
                            <th onclick="window.historyInterface?.sortBy('conformiteGlobale')" style="cursor: pointer;" title="Trier par conformité">
                                ✅ Conformité ${this.getSortIcon('conformiteGlobale')}
                            </th>
                        `}
                        <th>🔧 Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${this.generateHistoryRows(controles)}
                </tbody>
            </table>
        `;
        
        resultsContainer.innerHTML = tableHtml;
    }

    // Génération des lignes d'historique avec boutons export détaillé
    generateHistoryRows(controles) {
        return controles.map((controle, index) => {
            const rowClass = index % 2 === 0 ? 'even' : 'odd';
            let conformityClass = '';
            
            if (this.showSuspended) {
                if (controle.daysSuspended >= 30) conformityClass = 'row-very-old-suspended';
                else if (controle.daysSuspended >= 14) conformityClass = 'row-old-suspended';
                else conformityClass = 'row-suspended';
                
                return `
                    <tr class="${rowClass} ${conformityClass}">
                        <td><strong>${controle.date.toLocaleDateString('fr-FR')}</strong></td>
                        <td><span class="badge control-type">${controle.type}</span></td>
                        <td><strong>${controle.client}</strong></td>
                        <td>${controle.codeDossier || 'N/A'}</td>
                        <td>${controle.conseiller || 'N/A'}</td>
                        <td>${controle.montant || 'N/A'}</td>
                        <td><span class="badge secondary">${controle.documentsControles}</span></td>
                        <td><span class="badge duration ${this.getDurationClass(controle.daysSuspended)}">${controle.daysSuspended}j</span></td>
                        <td class="reason-cell">${controle.suspendReason || 'Non spécifiée'}</td>
                        <td>
                            <div style="display: flex; gap: 5px; flex-wrap: wrap; justify-content: center;">
                                <button class="btn btn-sm btn-primary" 
                                        onclick="window.historyInterface?.resumeSuspended('${controle.id}')"
                                        title="Reprendre le contrôle suspendu">
                                    🔄 Reprendre
                                </button>
                                <button class="btn btn-sm btn-danger" 
                                        onclick="window.historyInterface?.deleteSuspended('${controle.id}')"
                                        title="Supprimer définitivement">
                                    🗑️
                                </button>
                            </div>
                        </td>
                    </tr>
                `;
            } else {
                conformityClass = controle.conformiteGlobale === 'CONFORME' ? 'row-conforme' : 'row-non-conforme';
                
                // NOUVEAU : Identifier si c'est une révision pour l'affichage
                const isRevision = controle.completionType === 'C2R';
                const canBeRevised = window.persistenceManager?.canBeRevised(controle.id) || false;
                
                return `
                    <tr class="${rowClass} ${conformityClass} ${isRevision ? 'revision-row' : ''}">
                        <td><strong>${controle.date.toLocaleDateString('fr-FR')}</strong></td>
                        <td><span class="badge control-type">${controle.type}</span></td>
                        <td>
                            <strong>${controle.client}</strong>
                            ${isRevision ? '<span class="revision-indicator" title="Révision C2R">📝</span>' : ''}
                        </td>
                        <td>${controle.codeDossier || 'N/A'}</td>
                        <td>${controle.conseiller || 'N/A'}</td>
                        <td>${controle.montant || 'N/A'}</td>
                        <td><span class="badge secondary">${controle.documentsControles}</span></td>
                        
                        <td>
                            <span class="badge completion-type ${controle.completionType === 'C2R' ? 'revision-completion' : controle.completionType === 'C1S' ? 'suspended-completion' : 'direct-completion'}" 
                                  title="${this.getCompletionTypeTitle(controle.completionType, controle)}">
                                ${controle.completionType || 'C1'}
                            </span>
                        </td>
                        
                        <td><span class="badge ${controle.anomaliesMajeures > 0 ? 'non' : 'oui'}">${controle.anomaliesMajeures}</span></td>
                        <td><span class="badge ${controle.conformiteGlobale === 'CONFORME' ? 'oui' : 'non'}">${controle.conformiteGlobale}</span></td>
                        <td>
                            <div style="display: flex; gap: 5px; flex-wrap: wrap; justify-content: center;">
                                <button class="btn btn-sm btn-secondary" 
                                        onclick="window.historyInterface?.showDetails('${controle.id}')"
                                        title="Voir les détails complets">
                                    📋 Détails
                                </button>
                                
                                ${canBeRevised ? `
                                    <!-- NOUVEAU : Bouton Réviser à la place d'Export -->
                                    <button class="btn btn-sm btn-warning" 
                                            onclick="window.historyInterface?.startRevision('${controle.id}')"
                                            title="Créer une révision C2R">
                                        📝 Réviser
                                    </button>
                                ` : `
                                    <!-- NOUVEAU : Bouton Export pour les révisions ou contrôles non révisables -->
                                    <button class="btn btn-sm btn-primary" 
                                            onclick="window.persistenceManager?.exportDetailedControl('${controle.id}')"
                                            title="Export Excel détaillé">
                                        📊 Export
                                    </button>
                                `}
                                
                                ${isRevision ? `
                                    <!-- NOUVEAU : Bouton pour voir les différences -->
                                    <button class="btn btn-sm btn-info" 
                                            onclick="window.historyInterface?.showRevisionDifferences('${controle.id}')"
                                            title="Voir les modifications apportées">
                                        🔍 Différences
                                    </button>
                                ` : ''}
                            </div>
                        </td>
                    </tr>
                `;
            }
        }).join('');
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

    // Modal détails enrichie avec boutons export détaillé
    showDetails(controleId) {
        if (!window.persistenceManager) return;
        
        const controle = window.persistenceManager.getHistoryData().controles.find(c => c.id == controleId);
        if (!controle) {
            Utils.showNotification('Contrôle non trouvé', 'error');
            return;
        }

        // NOUVEAU : Obtenir les contrôles liés (parent/révision)
        const linkedControls = window.persistenceManager.getLinkedControls(controleId);
        const hasLinkedControls = linkedControls.length > 1;

        this.closeAllModals();

        const modal = document.createElement('div');
        modal.className = 'justification-modal';
        modal.id = `modal-details-${controleId}`;
        
        modal.innerHTML = `
            <div class="modal-overlay" onclick="window.historyInterface?.closeModal('details-${controleId}')">
                <div class="modal-content" style="max-width: 95vw; max-height: 90vh; width: 1200px; overflow-y: auto;" onclick="event.stopPropagation();">
                    
                    <div style="background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); color: white; padding: 25px; display: flex; justify-content: space-between; align-items: center; border-radius: 15px 15px 0 0;">
                        <h3 style="margin: 0; font-size: 1.3rem;">
                            📋 Détails du contrôle - ${controle.client}
                            ${controle.completionType === 'C2R' ? ' <span style="background: #ff9800; color: white; padding: 4px 8px; border-radius: 4px; font-size: 0.8rem;">RÉVISION</span>' : ''}
                        </h3>
                        <button class="btn btn-sm" onclick="window.historyInterface?.closeModal('details-${controleId}')" 
                                style="background: white; color: #1a1a2e; padding: 8px 12px; font-weight: 600;">❌ Fermer</button>
                    </div>
                    
                    <div style="padding: 25px;">
                        
                        ${hasLinkedControls ? this.generateLinkedControlsSection(linkedControls, controleId) : ''}
                        
                        <!-- Informations principales -->
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
                            
                            <!-- Conformité globale -->
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
                        </div>
                        
                        ${controle.details && controle.details.length > 0 ? `
                            <!-- Détails des vérifications -->
                            <div style="margin-bottom: 25px;">
                                <h4 style="color: #1a1a2e; margin-bottom: 15px;">📄 Détail des vérifications (${controle.details.length} points de contrôle)</h4>
                                
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
                                                            <span class="badge ${detail.conforme ? 'oui' : 'non'}" style="padding: 6px 12px;">
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
                    
                    <div style="background: #f8f9fa; padding: 20px 25px; border-top: 1px solid #e9ecef; display: flex; justify-content: space-between; gap: 15px; border-radius: 0 0 15px 15px; flex-wrap: wrap;">
                        <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                            <button class="btn btn-primary" onclick="window.persistenceManager?.exportDetailedControl('${controle.id}')" 
                                    title="Export Excel détaillé">
                                📋 Export Détaillé
                            </button>
                            ${controle.completionType === 'C2R' && controle.parentControlId ? `
                                <button class="btn btn-warning" onclick="window.historyInterface?.showRevisionDifferences('${controle.id}')" 
                                        title="Voir les modifications">
                                    🔍 Voir Différences
                                </button>
                            ` : ''}
                            ${window.persistenceManager?.canBeRevised(controle.id) ? `
                                <button class="btn btn-warning" onclick="window.historyInterface?.startRevision('${controle.id}')" 
                                        title="Créer une révision">
                                    📝 Réviser
                                </button>
                            ` : ''}
                        </div>
                        <button class="btn btn-secondary" onclick="window.historyInterface?.closeModal('details-${controleId}')">
                            ❌ Fermer
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
    }

    // NOUVEAU : Générer la section des contrôles liés
    generateLinkedControlsSection(linkedControls, currentId) {
        if (linkedControls.length <= 1) return '';

        return `
            <div class="linked-controls-section" style="background: #e3f2fd; padding: 20px; border-radius: 12px; margin-bottom: 25px; border-left: 4px solid #2196f3;">
                <h4 style="margin: 0 0 15px 0; color: #1565c0;">🔗 Historique de révision</h4>
                <div style="display: flex; gap: 15px; flex-wrap: wrap;">
                    ${linkedControls.map(control => `
                        <div class="linked-control-card" style="
                            background: ${control.id == currentId ? '#fff3e0' : 'white'}; 
                            border: 2px solid ${control.id == currentId ? '#ff9800' : '#e9ecef'}; 
                            border-radius: 8px; 
                            padding: 15px; 
                            flex: 1; 
                            min-width: 250px;
                            ${control.id == currentId ? 'box-shadow: 0 4px 12px rgba(255, 152, 0, 0.3);' : ''}
                        ">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                                <span class="badge completion-type ${control.completionType === 'C2R' ? 'revision-completion' : control.completionType === 'C1S' ? 'suspended-completion' : 'direct-completion'}">
                                    ${control.completionType || 'C1'}
                                </span>
                                ${control.id == currentId ? '<span style="font-size: 0.8rem; color: #f57c00; font-weight: 600;">◀ ACTUEL</span>' : ''}
                            </div>
                            <div style="font-size: 0.9rem; color: #495057;">
                                <div><strong>Date:</strong> ${control.date.toLocaleDateString('fr-FR')}</div>
                                <div><strong>Statut:</strong> <span class="badge ${control.conformiteGlobale === 'CONFORME' ? 'oui' : 'non'}">${control.conformiteGlobale}</span></div>
                                ${control.totalModifications ? `<div><strong>Modifications:</strong> ${control.totalModifications}</div>` : ''}
                            </div>
                            ${control.id != currentId ? `
                                <div style="margin-top: 10px;">
                                    <button class="btn btn-sm btn-secondary" onclick="window.historyInterface?.showDetails('${control.id}')" 
                                            title="Voir les détails">
                                        📋 Voir
                                    </button>
                                </div>
                            ` : ''}
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }


    // Génération du résumé des anomalies
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
                    <p style="margin: 10px 0 0 0; color: #155724; font-weight: 600;"></p>
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

    getObjectives() {
        const defaults = {
            cgpCommissionThreshold: 75,
            controlTargets: {
                'LCB-FT': { yearly: 600 },        // Au lieu de monthly: 50
                'FINANCEMENT': { yearly: 360 },   // Au lieu de monthly: 30
                'CARTO_CLIENT': { yearly: 480 },  // Au lieu de monthly: 40
                'OPERATION': { yearly: 420 },     // Au lieu de monthly: 35
                'NOUVEAU_CLIENT': { yearly: 300 } // Au lieu de monthly: 25
            }
        };
        
        const saved = localStorage.getItem('app_objectives');
        return saved ? { ...defaults, ...JSON.parse(saved) } : defaults;
    }

    // Modal statistiques enrichie
    showStatistics() {
        if (!window.persistenceManager) {
            Utils.showNotification('Gestionnaire d\'historique non disponible', 'error');
            return;
        }
    
        const stats = window.persistenceManager.getStatistics();
        const statsByCGP = window.persistenceManager.getStatisticsByCGP();
        const objectives = window.persistenceManager.getObjectives();
        
        this.closeAllModals();
        
        const modal = document.createElement('div');
        modal.className = 'justification-modal';
        modal.id = 'modal-statistics';
        
        modal.innerHTML = `
            <div class="modal-overlay" onclick="window.historyInterface?.closeStatsModal()">
                <div class="modal-content stats-modal" onclick="event.stopPropagation()">
                    <div class="stats-header">
                        <h3>Statistiques et analyses</h3>
                        <button class="btn btn-sm btn-secondary" onclick="window.historyInterface?.closeStatsModal()">✕</button>
                    </div>
                    
                    <!-- Onglets de navigation -->
                    <div class="stats-tabs">
                        <button class="stats-tab active" data-tab="global" onclick="window.historyInterface?.switchStatsTab('global')">
                            Global
                        </button>
                        <button class="stats-tab" data-tab="cgp" onclick="window.historyInterface?.switchStatsTab('cgp')">
                            Par CGP
                        </button>
                        <button class="stats-tab" data-tab="objectifs" onclick="window.historyInterface?.switchStatsTab('objectifs')">
                            Objectifs
                        </button>
                        <button class="stats-tab" data-tab="config" onclick="window.historyInterface?.switchStatsTab('config')">
                            Configuration
                        </button>
                    </div>
                    
                    <!-- Contenu des onglets -->
                    <div class="stats-content">
                        <!-- Onglet Global (existant) -->
                        <div class="stats-panel active" id="stats-global">
                            ${this.generateGlobalStats(stats)}
                        </div>
                        
                        <!-- Onglet CGP -->
                        <div class="stats-panel" id="stats-cgp">
                            ${this.generateCGPStats(statsByCGP, objectives)}
                        </div>
                        
                        <!-- Onglet Objectifs -->
                        <div class="stats-panel" id="stats-objectifs">
                            ${this.generateObjectivesPanel(objectives)}
                        </div>
                        
                        <!-- Onglet Configuration -->
                        <div class="stats-panel" id="stats-config">
                            ${this.generateConfigPanel(objectives)}
                        </div>
                    </div>
                    
                    <div class="stats-footer">
                        <button class="btn btn-primary" onclick="window.historyInterface?.exportComplete()">
                            Exporter historique Excel
                        </button>
                        <button class="btn btn-secondary" onclick="window.historyInterface?.closeStatsModal()">
                            Fermer
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        this.addStatsModalStyles();

        // AJOUTER AUSSI :
        setTimeout(() => {
            this.initializeStatsInterface();
        }, 100);
    }

    initializeStatsInterface() {
        // S'assurer que les event listeners des onglets sont bien attachés
        const tabs = document.querySelectorAll('.stats-tab');
        tabs.forEach(tab => {
            tab.addEventListener('click', (e) => {
                const tabName = e.target.getAttribute('data-tab');
                if (tabName) {
                    this.switchStatsTab(tabName);
                }
            });
        });
    }
    
    // Gestion des onglets
    switchStatsTab(tabName) {
        console.log('Switching to:', tabName);

        const tabs = document.querySelectorAll('.stats-tab');
        const panels = document.querySelectorAll('.stats-panel');
        
        console.log('Found tabs:', tabs.length);
        console.log('Found panels:', panels.length);

        // Désactiver tous les onglets et panneaux
        document.querySelectorAll('.stats-tab').forEach(tab => tab.classList.remove('active'));
        document.querySelectorAll('.stats-panel').forEach(panel => panel.classList.remove('active'));
        
        // Activer l'onglet et panneau sélectionnés
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
        document.getElementById(`stats-${tabName}`).classList.add('active');
    }
    
    // Génération des statistiques CGP
    generateCGPStats(statsByCGP, objectives) {
        const cgpEntries = Object.entries(statsByCGP);
        
        return `
            <div class="cgp-stats-container">
                <h4>Statistiques par conseiller (méthode pondérée)</h4>
                <div class="cgp-summary">
                    <div class="cgp-metric">
                        <span class="metric-value">${cgpEntries.length}</span>
                        <span class="metric-label">CGP actifs</span>
                    </div>
                    <div class="cgp-metric">
                        <span class="metric-value">${cgpEntries.filter(([,stats]) => stats.eligibleCommission).length}</span>
                        <span class="metric-label">Éligibles commission (≥${objectives.cgpCommissionThreshold}%)</span>
                    </div>
                </div>
                
                <div class="cgp-table-container">
                    <table class="cgp-table">
                        <thead>
                            <tr>
                                <th>CGP</th>
                                <th>Contrôles</th>
                                <th>Taux conformité</th>
                                <th>Commission</th>
                                <th>Détail</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${cgpEntries.map(([cgp, stats]) => `
                                <tr class="cgp-row ${stats.eligibleCommission ? 'eligible' : 'not-eligible'}">
                                    <td class="cgp-name">${cgp}</td>
                                    <td>${stats.totalControles}</td>
                                    <td class="conformity-cell">
                                        <span class="conformity-rate ${this.getConformityClass(stats.tauxConformite)}">${stats.tauxConformite}%</span>
                                        <div class="points-detail">(${stats.pointsTotal}/${stats.pointsMax} pts)</div>
                                    </td>
                                    <td class="commission-cell">
                                        <span class="commission-status ${stats.eligibleCommission ? 'eligible' : 'not-eligible'}">
                                            ${stats.eligibleCommission ? '✓ Oui' : '✗ Non'}
                                        </span>
                                    </td>
                                    <td class="color-breakdown">
                                        <span class="color-badge green">${stats.repartition.vert}</span>
                                        <span class="color-badge orange">${stats.repartition.orange}</span>
                                        <span class="color-badge red">${stats.repartition.rouge}</span>
                                        <span class="color-badge black">${stats.repartition.noir}</span>
                                    </td>
                                    <td>
                                        <button class="btn btn-sm btn-info" onclick="window.historyInterface?.showCGPDetail('${cgp}')">
                                            Détail calcul
                                        </button>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    }
    
    // Génération du panneau de configuration
   generateConfigPanel(objectives) {
        return `
            <div class="config-container">
                <h4>Configuration des seuils et objectifs annuels</h4>
                <form id="objectives-form">
                    <div class="config-section">
                        <label>Seuil commission CGP (%) :</label>
                        <input type="number" id="cgp-threshold" value="${objectives.cgpCommissionThreshold}" min="0" max="100">
                        <small>Taux de conformité minimum pour percevoir la commission</small>
                    </div>
                    
                    <div class="config-section">
                        <h5>Objectifs annuels par type de contrôle :</h5>
                        ${Object.entries(objectives.controlTargets).map(([type, targets]) => `
                            <div class="objective-row">
                                <label>${type} :</label>
                                <input type="number" data-type="${type}" value="${targets.yearly}" min="0">
                                <small>contrôles par an</small>
                            </div>
                        `).join('')}
                    </div>
                    
                    <div class="config-actions">
                        <button type="button" class="btn btn-primary" onclick="window.historyInterface?.saveObjectivesConfig()">
                            Sauvegarder les modifications
                        </button>
                        <button type="button" class="btn btn-secondary" onclick="window.historyInterface?.resetObjectivesConfig()">
                            Rétablir par défaut
                        </button>
                    </div>
                </form>
            </div>
        `;
    }
    
    // Sauvegarder la configuration
   saveObjectivesConfig() {
        const cgpThreshold = document.getElementById('cgp-threshold')?.value;
        const controlInputs = document.querySelectorAll('[data-type]');
        
        const objectives = {
            cgpCommissionThreshold: parseInt(cgpThreshold) || 75,
            controlTargets: {}
        };
        
        controlInputs.forEach(input => {
            const type = input.dataset.type;
            objectives.controlTargets[type] = {
                yearly: parseInt(input.value) || 0  // yearly au lieu de monthly
            };
        });
        
        window.persistenceManager.updateObjectives(objectives);
        
        // Rafraîchir l'affichage
        setTimeout(() => {
            this.closeStatsModal();
            this.showStatistics();
        }, 500);
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

    // Méthode pour exporter un contrôle spécifique (export simple)
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
            
            const fileName = `Controle_Simple_${controle.client.replace(/[^a-zA-Z0-9]/g, '_')}_${controle.date.toISOString().split('T')[0]}.xlsx`;
            XLSX.writeFile(wb, fileName);
            
            Utils.showNotification(`Contrôle simple de ${controle.client} exporté`, 'success');
        } catch (error) {
            Utils.showNotification('Erreur lors de l\'export du contrôle', 'error');
            console.error('Erreur export:', error);
        }
    }

     // NOUVEAU : Appliquer les filtres spéciaux pour les suspendus
    applySuspendedFilters(results, criteria) {
        if (criteria.conformite) {
            const now = new Date();
            results = results.filter(result => {
                const daysSuspended = Math.floor((now - result.date) / (1000 * 60 * 60 * 24));
                
                switch(criteria.conformite) {
                    case 'recent':
                        return daysSuspended <= 7;
                    case 'old':
                        return daysSuspended >= 14 && daysSuspended < 30;
                    case 'very-old':
                        return daysSuspended >= 30;
                    default:
                        return true;
                }
            });
        }
        
        return this.sortControles(results);
    }

    // NOUVEAU : Obtenir la classe CSS selon la durée de suspension
    getDurationClass(daysSuspended) {
        if (daysSuspended >= 30) return 'very-old';
        if (daysSuspended >= 14) return 'old';
        return 'recent';
    }

    // NOUVEAU : Reprendre un contrôle suspendu depuis l'historique
    resumeSuspended(controlId) {
        const suspendedControl = window.persistenceManager?.getSuspendedControlById(controlId);
        if (!suspendedControl) {
            Utils.showNotification('Contrôle suspendu introuvable', 'error');
            return;
        }
        
        const confirmed = confirm(
            `Reprendre le contrôle suspendu ?\n\n` +
            `Client: ${suspendedControl.dossier.client}\n` +
            `Type: ${suspendedControl.type}\n` +
            `Suspendu le: ${new Date(suspendedControl.suspendedAt).toLocaleDateString('fr-FR')}\n` +
            `Progress: ${Object.keys(suspendedControl.responses || {}).length} question(s) répondue(s)`
        );
        
        if (confirmed) {
            // Naviguer vers le contrôle
            if (window.documentController) {
                window.documentController.currentDossier = suspendedControl.dossier;
                window.documentController.currentControl = suspendedControl.control;
                window.documentController.resumeControl(controlId);
            } else {
                Utils.showNotification('DocumentController non disponible', 'error');
            }
        }
    }

    // NOUVEAU : Supprimer un contrôle suspendu depuis l'historique
    deleteSuspended(controlId) {
        const suspendedControl = window.persistenceManager?.getSuspendedControlById(controlId);
        if (!suspendedControl) {
            Utils.showNotification('Contrôle suspendu introuvable', 'error');
            return;
        }
        
        const confirmed = confirm(
            `Supprimer définitivement ce contrôle suspendu ?\n\n` +
            `Client: ${suspendedControl.dossier.client}\n` +
            `Type: ${suspendedControl.type}\n` +
            `Suspendu le: ${new Date(suspendedControl.suspendedAt).toLocaleDateString('fr-FR')}\n\n` +
            `⚠️ Cette action est irréversible !`
        );
        
        if (confirmed) {
            const dossierKey = window.documentController?.generateDossierKey(suspendedControl.dossier);
            if (dossierKey && window.persistenceManager?.removeSuspendedControl(dossierKey, suspendedControl.type)) {
                Utils.showNotification('Contrôle suspendu supprimé', 'success');
                this.loadHistoryData();
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
            '⚠️ Cette action est irréversible !'
        );
        
        if (confirmed) {
            const cleanedCount = window.persistenceManager.cleanOldSuspendedControls(90);
            
            if (cleanedCount > 0) {
                Utils.showNotification(`${cleanedCount} ancien(s) contrôle(s) suspendu(s) supprimé(s)`, 'success');
                this.loadHistoryData();
            } else {
                Utils.showNotification('Aucun contrôle ancien à supprimer', 'info');
            }
        }
    }
    // NOUVEAU : Changer d'onglet (terminés/suspendus)
    switchTab(showSuspended) {
      this.showSuspended = showSuspended;
    
        // Mettre à jour les onglets
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        
        // Activer le bon onglet
        const buttons = document.querySelectorAll('.tab-btn');
        if (showSuspended && buttons[1]) {
            buttons[1].classList.add('active');
        } else if (!showSuspended && buttons[0]) {
            buttons[0].classList.add('active');
        }
        
        // Mettre à jour le bouton mail (juste l'indicateur)
        this.updateMailButton();
        
        // Mettre à jour les filtres et recharger
        this.updateFiltersForCurrentTab();
        this.loadHistoryData();
        
        Utils.debugLog(`Onglet changé: ${showSuspended ? 'suspendus' : 'terminés'}`);
    }

// 4. S'assurer que updateMailButton() est bien appelée :
updateMailButton() {
    const mailButton = document.querySelector('.btn-mail');
        if (!mailButton) {
            console.log('Bouton mail non trouvé'); // Debug
            return;
        }
        
        // Mettre à jour la classe CSS
        mailButton.className = `btn btn-mail ${this.showSuspended ? 'btn-mail-suspended' : 'btn-mail-history'}`;
        
        // Mettre à jour l'onclick
        mailButton.onclick = () => {
            if (this.showSuspended) {
                window.mailManager?.showMailFromSuspended();
            } else {
                window.mailManager?.showMailFromHistory();
            }
        };
        
        // Mettre à jour le title
        mailButton.title = this.showSuspended ? 
            'Envoyer un email de relance pour les contrôles suspendus' : 
            'Envoyer un email concernant les dossiers non conformes';
        
        // Mettre à jour le texte du bouton
        mailButton.textContent = '📧 Email conseiller';
        
        console.log(`Bouton mail mis à jour: ${mailButton.className}`); // Debug
    }

    handleMailAction() {
        if (this.showSuspended) {
            window.mailManager?.showMailFromSuspended();
        } else {
            window.mailManager?.showMailFromHistory();
        }
    }

    // NOUVEAU : Mettre à jour les filtres selon l'onglet actif
    updateFiltersForCurrentTab() {
        const conformiteSelect = document.getElementById('history-conformite');
        const conformiteLabel = conformiteSelect.parentNode.querySelector('.filter-label');
        
        if (this.showSuspended) {
            conformiteLabel.textContent = '⏰ Durée suspension';
            conformiteSelect.innerHTML = `
                <option value="">⏰ Toutes durées</option>
                <option value="recent">📅 Récents (-7j)</option>
                <option value="old">⚠️ Anciens (14j+)</option>
                <option value="very-old">🚨 Très anciens (30j+)</option>
            `;
        } else {
            conformiteLabel.textContent = '✅ Conformité';
            conformiteSelect.innerHTML = `
                <option value="">📊 Toutes</option>
                <option value="CONFORME">✅ Conforme</option>
                <option value="NON CONFORME">❌ Non conforme</option>
            `;
        }
    }

    // NOUVEAU : Formater les contrôles suspendus pour l'affichage
    formatSuspendedForDisplay(suspendedControls) {
        return suspendedControls.map(suspended => ({
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
            daysSuspended: Math.floor((new Date() - new Date(suspended.suspendedAt)) / (1000 * 60 * 60 * 24)),
            isSuspended: true,
            suspendedData: suspended
        }));
    }

    // NOUVEAU : Mettre à jour le badge du nombre de suspendus
    updateSuspendedBadge() {
        const badge = document.getElementById('suspended-count-badge');
        if (badge && window.persistenceManager) {
            const suspendedCount = window.persistenceManager.getSuspendedControls().length;
            badge.textContent = suspendedCount;
            badge.style.display = suspendedCount > 0 ? 'inline' : 'none';
        }
    }

    // NOUVEAU : CSS supplémentaire pour les onglets
    addTabStyles() {
        if (document.getElementById('history-tabs-styles')) return;
    
        const style = document.createElement('style');
        style.id = 'history-tabs-styles';
        style.textContent = `
            /* Styles existants inchangés... */
            .history-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 30px;
                gap: 20px;
                width: 100%;
            }

            .history-tabs {
                display: flex;
                border-radius: 10px;
                overflow: hidden;
                background: #e9ecef;
                padding: 4px;
                flex: 0 1 auto;
                max-width: 400px;
                min-width: 300px;
            }

            .history-mail-actions {
                flex-shrink: 0;
                margin-left: auto;
            }

            .btn-mail {
                padding: 12px 24px;
                border-radius: 12px;
                font-weight: 600;
                font-size: 1rem;
                border: none;
                cursor: pointer;
                transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                display: flex;
                align-items: center;
                gap: 10px;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
                position: relative;
                overflow: hidden;
                white-space: nowrap;
                text-decoration: none;
                background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 50%, #1e40af 100%);
                color: white;
                background-size: 200% 200%;
                animation: subtleShine 3s ease-in-out infinite;
            }

            @keyframes subtleShine {
                0%, 100% { background-position: 0% 50%; }
                50% { background-position: 100% 50%; }
            }

            .btn-mail:hover {
                transform: translateY(-2px) scale(1.02);
                box-shadow: 0 8px 25px rgba(37, 99, 235, 0.4);
                background: linear-gradient(135deg, #1d4ed8 0%, #1e40af 50%, #1e3a8a 100%);
                animation: none;
            }

            .tab-btn {
                flex: 1;
                padding: 12px 20px;
                border: none;
                background: transparent;
                color: #6c757d;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.3s ease;
                position: relative;
                font-size: 1rem;
            }

            .tab-btn.active {
                background: white;
                color: #1a1a2e;
                border-radius: 6px;
                box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            }

            .tab-badge {
                background: #dc3545;
                color: white;
                padding: 2px 6px;
                border-radius: 10px;
                font-size: 0.75rem;
                margin-left: 6px;
                font-weight: 700;
            }

            /* NOUVEAU : Styles pour les révisions */
            .revision-row {
                border-left: 4px solid #ff9800 !important;
                background: rgba(255, 152, 0, 0.05) !important;
            }

            .revision-indicator {
                margin-left: 8px;
                font-size: 1.2rem;
                opacity: 0.8;
            }

            .badge.revision-completion {
                background-color: #fff3e0;
                color: #f57c00;
                border: 1px solid #ffcc02;
                position: relative;
            }

            .badge.revision-completion::after {
                content: "📝";
                margin-left: 4px;
                font-size: 0.7rem;
            }

            .summary-card.revision-card {
                background: linear-gradient(135deg, #fff3e0 0%, #ffe0b2 100%);
                border-left: 4px solid #ff9800;
            }

            .summary-card-wide {
                background: #f8f9fa;
                border: 1px solid #dee2e6;
                border-radius: 12px;
                padding: 15px;
                margin-top: 15px;
            }

            .completion-breakdown {
                text-align: center;
            }

            .completion-stat {
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 5px;
            }

            .completion-stat .badge {
                font-weight: 600;
                padding: 6px 12px;
                border-radius: 6px;
                font-size: 0.9rem;
            }

            /* Responsive */
            @media (max-width: 768px) {
                .history-header {
                    flex-direction: column;
                    align-items: stretch;
                    gap: 15px;
                }
                
                .history-tabs {
                    max-width: none;
                    min-width: auto;
                    order: 1;
                }
                
                .history-mail-actions {
                    order: 2;
                    margin-left: 0;
                }
                
                .btn-mail {
                    width: 100%;
                    justify-content: center;
                }
                
                .summary-card-wide {
                    margin-top: 10px;
                }
                
                .completion-breakdown .completion-stat {
                    min-width: 80px;
                }
            }
        `;
        
        document.head.appendChild(style);
    }
    
    // NOUVEAU : Obtenir le titre du type de finalisation
    getCompletionTypeTitle(completionType, controle) {
        switch(completionType) {
            case 'C1':
                return 'Contrôle finalisé directement';
            case 'C1S':
                return 'Contrôle finalisé après suspension';
            case 'C2R':
                return `Révision effectuée le ${controle.revisionDate ? new Date(controle.revisionDate).toLocaleDateString('fr-FR') : 'date inconnue'}${controle.totalModifications ? ` (${controle.totalModifications} modification(s))` : ''}`;
            default:
                return 'Type de finalisation inconnu';
        }
    }

    // NOUVEAU : Démarrer une révision depuis l'historique
    startRevision(controleId) {
        if (!window.documentController) {
            Utils.showNotification('DocumentController non disponible', 'error');
            return;
        }

        if (!window.persistenceManager) {
            Utils.showNotification('PersistenceManager non disponible', 'error');
            return;
        }

        const control = window.persistenceManager.getOriginalControl(controleId);
        if (!control) {
            Utils.showNotification('Contrôle introuvable', 'error');
            return;
        }

        if (!window.persistenceManager.canBeRevised(controleId)) {
            Utils.showNotification('Ce contrôle ne peut pas être révisé', 'warning');
            return;
        }

        const confirmed = confirm(
            `Démarrer une révision (C2R) ?\n\n` +
            `Client: ${control.client}\n` +
            `Type: ${control.type}\n` +
            `Contrôlé le: ${control.date.toLocaleDateString('fr-FR')}\n` +
            `Statut actuel: ${control.conformiteGlobale}\n\n` +
            `Les réponses seront pré-remplies et vous pourrez les modifier.`
        );

        if (confirmed) {
            // Basculer vers l'interface de contrôle en mode révision
            window.documentController.startRevision(controleId);
            Utils.showSection('document-control-section');
        }
    }

    // NOUVEAU : Afficher les différences d'une révision
    showRevisionDifferences(revisionId) {
        if (!window.persistenceManager) {
            Utils.showNotification('PersistenceManager non disponible', 'error');
            return;
        }

        const revision = window.persistenceManager.getOriginalControl(revisionId);
        const parent = window.persistenceManager.getParentControl(revisionId);

        if (!revision || !parent) {
            Utils.showNotification('Impossible de charger les données de révision', 'error');
            return;
        }

        this.closeAllModals();

        const modal = document.createElement('div');
        modal.className = 'justification-modal';
        modal.id = `modal-revision-diff-${revisionId}`;

        modal.innerHTML = `
            <div class="modal-overlay" onclick="window.historyInterface?.closeModal('revision-diff-${revisionId}')">
                <div class="modal-content" style="max-width: 90vw; width: 1000px;" onclick="event.stopPropagation();">
                    
                    <div style="background: linear-gradient(135deg, #ff9800 0%, #f57c00 100%); color: white; padding: 20px; border-radius: 12px 12px 0 0;">
                        <h3 style="margin: 0; display: flex; align-items: center; gap: 10px;">
                            📝 Différences de révision - ${revision.client}
                            <button class="btn btn-sm" onclick="window.historyInterface?.closeModal('revision-diff-${revisionId}')" 
                                    style="background: white; color: #f57c00; margin-left: auto;">❌ Fermer</button>
                        </h3>
                    </div>
                    
                    <div style="padding: 25px;">
                        
                        <!-- Résumé de la révision -->
                        <div class="revision-summary" style="background: #fff3e0; padding: 20px; border-radius: 12px; margin-bottom: 20px; border-left: 4px solid #ff9800;">
                            <h4 style="margin: 0 0 15px 0; color: #e65100;">📊 Résumé de la révision</h4>
                            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px;">
                                <div>
                                    <div style="font-weight: 600; color: #bf360c;">Date de révision</div>
                                    <div>${revision.revisionDate ? new Date(revision.revisionDate).toLocaleDateString('fr-FR') : 'Non disponible'}</div>
                                </div>
                                <div>
                                    <div style="font-weight: 600; color: #bf360c;">Modifications apportées</div>
                                    <div><strong>${revision.totalModifications || 0}</strong></div>
                                </div>
                                <div>
                                    <div style="font-weight: 600; color: #bf360c;">Statut avant</div>
                                    <span class="badge ${parent.conformiteGlobale === 'CONFORME' ? 'oui' : 'non'}">${parent.conformiteGlobale}</span>
                                </div>
                                <div>
                                    <div style="font-weight: 600; color: #bf360c;">Statut après</div>
                                    <span class="badge ${revision.conformiteGlobale === 'CONFORME' ? 'oui' : 'non'}">${revision.conformiteGlobale}</span>
                                </div>
                            </div>
                        </div>
                        
                        ${this.generateComparisonTable(parent, revision)}
                        
                    </div>
                    
                    <div style="background: #f8f9fa; padding: 20px; border-top: 1px solid #e9ecef; display: flex; justify-content: space-between; border-radius: 0 0 12px 12px;">
                        <button class="btn btn-primary" onclick="window.persistenceManager?.exportDetailedControl('${revisionId}')" 
                                title="Export Excel de la révision">
                            📋 Export Révision
                        </button>
                        <button class="btn btn-secondary" onclick="window.historyInterface?.closeModal('revision-diff-${revisionId}')">
                            ❌ Fermer
                        </button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
    }

    // NOUVEAU : Générer le tableau de comparaison
    generateComparisonTable(parent, revision) {
        if (!parent.details || !revision.details) {
            return `
                <div style="text-align: center; padding: 40px; color: #6c757d; background: #f8f9fa; border-radius: 12px;">
                    <h4>Détails de comparaison non disponibles</h4>
                    <p>Les détails nécessaires pour comparer les versions ne sont pas disponibles.</p>
                </div>
            `;
        }

        const changes = this.findDetailedChanges(parent.details, revision.details);
        
        if (changes.length === 0) {
            return `
                <div style="text-align: center; padding: 40px; color: #28a745; background: #f8fff9; border-radius: 12px; border: 2px solid #28a745;">
                    <h4>Aucune différence détectée</h4>
                    <p>Les réponses sont identiques entre les deux versions.</p>
                </div>
            `;
        }

        return `
            <div style="margin-bottom: 20px;">
                <h4 style="color: #bf360c; margin-bottom: 15px;">🔍 Modifications détectées (${changes.length})</h4>
                
                <div style="border: 2px solid #e9ecef; border-radius: 12px; overflow: hidden; background: white;">
                    <table style="width: 100%; border-collapse: collapse; font-size: 0.9rem;">
                        <thead>
                            <tr style="background: #ff9800; color: white;">
                                <th style="padding: 12px; text-align: left;">Document</th>
                                <th style="padding: 12px; text-align: left;">Question</th>
                                <th style="padding: 12px; text-align: center;">Avant</th>
                                <th style="padding: 12px; text-align: center;">Après</th>
                                <th style="padding: 12px; text-align: center;">Impact</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${changes.map(change => `
                                <tr style="border-bottom: 1px solid #e9ecef; ${change.impactType === 'improvement' ? 'background: #f8fff9;' : change.impactType === 'degradation' ? 'background: #fff5f5;' : ''}">
                                    <td style="padding: 12px; font-weight: 600;">${change.document}</td>
                                    <td style="padding: 12px; max-width: 300px;">${change.question}</td>
                                    <td style="padding: 12px; text-align: center;">
                                        <span class="badge ${change.beforeConforme ? 'oui' : 'non'}">${change.before}</span>
                                    </td>
                                    <td style="padding: 12px; text-align: center;">
                                        <span class="badge ${change.afterConforme ? 'oui' : 'non'}">${change.after}</span>
                                    </td>
                                    <td style="padding: 12px; text-align: center;">
                                        ${change.impactType === 'improvement' ? '📈 Amélioration' : 
                                          change.impactType === 'degradation' ? '📉 Dégradation' : 
                                          '🔄 Modification'}
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    }

    // NOUVEAU : Trouver les changements détaillés
    findDetailedChanges(parentDetails, revisionDetails) {
        const changes = [];
        const revisionMap = new Map();
        
        // Créer une map des détails de révision pour faciliter la comparaison
        revisionDetails.forEach(detail => {
            const key = `${detail.document}_${detail.question}`;
            revisionMap.set(key, detail);
        });
        
        // Comparer chaque détail du parent avec la révision
        parentDetails.forEach(parentDetail => {
            const key = `${parentDetail.document}_${parentDetail.question}`;
            const revisionDetail = revisionMap.get(key);
            
            if (revisionDetail) {
                // Vérifier les différences
                const hasAnswerChange = parentDetail.reponse !== revisionDetail.reponse;
                const hasQualityChange = parentDetail.qualite !== revisionDetail.qualite;
                const hasJustificationChange = (parentDetail.justification || '') !== (revisionDetail.justification || '');
                
                if (hasAnswerChange || hasQualityChange || hasJustificationChange) {
                    const change = {
                        document: parentDetail.document,
                        question: parentDetail.question,
                        before: this.formatDetailValue(parentDetail),
                        after: this.formatDetailValue(revisionDetail),
                        beforeConforme: parentDetail.conforme,
                        afterConforme: revisionDetail.conforme,
                        impactType: this.determineImpactType(parentDetail, revisionDetail)
                    };
                    changes.push(change);
                }
            }
        });
        
        return changes;
    }
    
    addStatsModalStyles() {
        // Supprimer l'ancien style s'il existe
        const existingStyle = document.getElementById('stats-modal-styles');
        if (existingStyle) {
            existingStyle.remove();
        }
        
        const style = document.createElement('style');
        style.id = 'stats-modal-styles';
        style.textContent = `
            /* ======================
               MODAL PRINCIPALE
               ====================== */
            .stats-modal {
                max-width: 1200px !important;
                width: 95vw !important;
                max-height: 90vh !important;
                overflow: hidden !important;
                background: white !important;
                border-radius: 15px !important;
                box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3) !important;
            }
            
            /* En-tête de la modal */
            .stats-header {
                display: flex !important;
                justify-content: space-between !important;
                align-items: center !important;
                padding: 25px 30px 20px 30px !important;
                background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%) !important;
                color: white !important;
                margin: 0 !important;
                border-radius: 15px 15px 0 0 !important;
            }
            
            .stats-header h3 {
                margin: 0 !important;
                font-size: 1.4rem !important;
                font-weight: 600 !important;
                color: white !important;
            }
            
            .stats-header .btn {
                background: white !important;
                color: #1a1a2e !important;
                border: none !important;
                padding: 8px 15px !important;
                border-radius: 8px !important;
                font-weight: 600 !important;
                cursor: pointer !important;
                transition: all 0.3s ease !important;
            }
            
            .stats-header .btn:hover {
                background: #f8f9fa !important;
                transform: scale(1.05) !important;
            }
            
            /* ======================
               NAVIGATION ONGLETS
               ====================== */
            .stats-tabs {
                display: flex !important;
                background: #f8f9fa !important;
                margin: 0 !important;
                padding: 0 !important;
                border-bottom: 2px solid #e9ecef !important;
                position: relative !important;
            }
            
            .stats-tab {
                flex: 1 !important;
                padding: 18px 24px !important;
                border: none !important;
                background: transparent !important;
                cursor: pointer !important;
                font-weight: 500 !important;
                font-size: 1rem !important;
                color: #6c757d !important;
                transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
                position: relative !important;
                border-bottom: 3px solid transparent !important;
            }
            
            .stats-tab:hover {
                background: #e9ecef !important;
                color: #495057 !important;
                transform: translateY(-1px) !important;
            }
            
            .stats-tab.active {
                background: white !important;
                color: #1a1a2e !important;
                font-weight: 600 !important;
                border-bottom: 3px solid #1a1a2e !important;
                box-shadow: 0 -2px 8px rgba(26, 26, 46, 0.1) !important;
            }
            
            .stats-tab.active::before {
                content: '' !important;
                position: absolute !important;
                bottom: -2px !important;
                left: 0 !important;
                right: 0 !important;
                height: 2px !important;
                background: white !important;
                z-index: 1 !important;
            }
            
            /* ======================
               CONTENU PRINCIPAL
               ====================== */
            .stats-content {
                background: white !important;
                padding: 30px !important;
                min-height: 500px !important;
                max-height: 600px !important;
                overflow-y: auto !important;
                position: relative !important;
            }
            
            .stats-content::-webkit-scrollbar {
                width: 8px !important;
            }
            
            .stats-content::-webkit-scrollbar-track {
                background: #f1f1f1 !important;
                border-radius: 4px !important;
            }
            
            .stats-content::-webkit-scrollbar-thumb {
                background: #c1c1c1 !important;
                border-radius: 4px !important;
            }
            
            .stats-content::-webkit-scrollbar-thumb:hover {
                background: #a8a8a8 !important;
            }
            
            /* ======================
               PANNEAUX D'ONGLETS
               ====================== */
            .stats-panel {
                display: none !important;
                opacity: 0 !important;
                transform: translateY(20px) !important;
                transition: all 0.4s ease-in-out !important;
            }
            
            .stats-panel.active {
                display: block !important;
                opacity: 1 !important;
                transform: translateY(0) !important;
                animation: slideInUp 0.5s ease-out !important;
            }
            
            @keyframes slideInUp {
                from {
                    opacity: 0;
                    transform: translateY(30px);
                }
                to {
                    opacity: 1;
                    transform: translateY(0);
                }
            }
            
            /* ======================
               ONGLET CGP
               ====================== */
            .cgp-stats-container {
                padding: 0 !important;
            }
            
            .cgp-stats-container h4 {
                color: #1a1a2e !important;
                margin-bottom: 25px !important;
                font-size: 1.3rem !important;
                font-weight: 600 !important;
            }
            
            .cgp-summary {
                display: grid !important;
                grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)) !important;
                gap: 20px !important;
                margin-bottom: 30px !important;
            }
            
            .cgp-metric {
                text-align: center !important;
                padding: 25px 20px !important;
                background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%) !important;
                border-radius: 12px !important;
                border-left: 5px solid #1a1a2e !important;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1) !important;
                transition: transform 0.3s ease !important;
            }
            
            .cgp-metric:hover {
                transform: translateY(-3px) !important;
                box-shadow: 0 8px 20px rgba(0, 0, 0, 0.15) !important;
            }
            
            .metric-value {
                display: block !important;
                font-size: 2.5rem !important;
                font-weight: 700 !important;
                color: #1a1a2e !important;
                margin-bottom: 8px !important;
            }
            
            .metric-label {
                display: block !important;
                color: #6c757d !important;
                font-size: 0.95rem !important;
                font-weight: 500 !important;
            }
            
            .cgp-table-container {
                background: white !important;
                border-radius: 12px !important;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1) !important;
                overflow: hidden !important;
            }
            
            .cgp-table {
                width: 100% !important;
                border-collapse: collapse !important;
                margin: 0 !important;
                font-size: 0.95rem !important;
            }
            
            .cgp-table thead tr {
                background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%) !important;
                color: white !important;
            }
            
            .cgp-table th {
                padding: 18px 15px !important;
                text-align: left !important;
                font-weight: 600 !important;
                font-size: 0.9rem !important;
                text-transform: uppercase !important;
                letter-spacing: 0.5px !important;
                position: sticky !important;
                top: 0 !important;
                z-index: 10 !important;
            }
            
            .cgp-table td {
                padding: 15px !important;
                border-bottom: 1px solid #e9ecef !important;
                vertical-align: middle !important;
            }
            
            .cgp-row {
                transition: all 0.3s ease !important;
            }
            
            .cgp-row:hover {
                background: #f8f9fa !important;
                transform: scale(1.01) !important;
            }
            
            .cgp-row.eligible {
                background: rgba(40, 167, 69, 0.08) !important;
                border-left: 4px solid #28a745 !important;
            }
            
            .cgp-row.not-eligible {
                background: rgba(220, 53, 69, 0.08) !important;
                border-left: 4px solid #dc3545 !important;
            }
            
            .cgp-name {
                font-weight: 600 !important;
                color: #1a1a2e !important;
                font-size: 1rem !important;
            }
            
            .conformity-cell {
                text-align: center !important;
            }
            
            .conformity-rate {
                font-weight: 700 !important;
                font-size: 1.2rem !important;
                display: block !important;
                margin-bottom: 4px !important;
            }
            
            .conformity-rate.high { color: #28a745 !important; }
            .conformity-rate.medium { color: #ffc107 !important; }
            .conformity-rate.low { color: #dc3545 !important; }
            
            .points-detail {
                font-size: 0.8rem !important;
                color: #6c757d !important;
                font-weight: 500 !important;
            }
            
            .commission-cell {
                text-align: center !important;
            }
            
            .commission-status {
                font-weight: 600 !important;
                font-size: 1rem !important;
            }
            
            .commission-status.eligible {
                color: #28a745 !important;
            }
            
            .commission-status.not-eligible {
                color: #dc3545 !important;
            }
            
            .color-breakdown {
                display: flex !important;
                gap: 6px !important;
                justify-content: center !important;
                flex-wrap: wrap !important;
            }
            
            .color-badge {
                display: inline-block !important;
                padding: 4px 8px !important;
                border-radius: 6px !important;
                font-size: 0.8rem !important;
                font-weight: 600 !important;
                min-width: 25px !important;
                text-align: center !important;
                transition: transform 0.2s ease !important;
            }
            
            .color-badge:hover {
                transform: scale(1.1) !important;
            }
            
            .color-badge.green { 
                background: #28a745 !important; 
                color: white !important; 
            }
            .color-badge.orange { 
                background: #ffc107 !important; 
                color: #212529 !important; 
            }
            .color-badge.red { 
                background: #dc3545 !important; 
                color: white !important; 
            }
            .color-badge.black { 
                background: #343a40 !important; 
                color: white !important; 
            }
            
            /* ======================
               ONGLET OBJECTIFS
               ====================== */
            .objectives-container h4 {
                color: #1a1a2e !important;
                margin-bottom: 25px !important;
                font-size: 1.3rem !important;
                font-weight: 600 !important;
            }
            
            .objectives-grid {
                display: grid !important;
                grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)) !important;
                gap: 25px !important;
                margin-top: 25px !important;
            }
            
            .objective-card {
                background: white !important;
                border: 1px solid #e9ecef !important;
                border-radius: 12px !important;
                padding: 25px !important;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1) !important;
                transition: all 0.3s ease !important;
                position: relative !important;
                overflow: hidden !important;
            }
            
            .objective-card:hover {
                transform: translateY(-5px) !important;
                box-shadow: 0 8px 25px rgba(0, 0, 0, 0.15) !important;
            }
            
            .objective-header {
                display: flex !important;
                justify-content: space-between !important;
                align-items: center !important;
                margin-bottom: 20px !important;
            }
            
            .objective-header h5 {
                margin: 0 !important;
                color: #1a1a2e !important;
                font-size: 1.1rem !important;
                font-weight: 600 !important;
            }
            
            .objective-percentage {
                font-weight: 700 !important;
                font-size: 1.4rem !important;
            }
            
            .objective-percentage.complete { 
                color: #28a745 !important; 
            }
            .objective-percentage.good { 
                color: #28a745 !important; 
            }
            .objective-percentage.warning { 
                color: #ffc107 !important; 
            }
            .objective-percentage.danger { 
                color: #dc3545 !important; 
            }
            
            .progress-bar {
                width: 100% !important;
                height: 12px !important;
                background: #e9ecef !important;
                border-radius: 6px !important;
                overflow: hidden !important;
                margin-bottom: 12px !important;
                position: relative !important;
            }
            
            .progress-fill {
                height: 100% !important;
                transition: width 0.8s cubic-bezier(0.4, 0, 0.2, 1) !important;
                border-radius: 6px !important;
                position: relative !important;
            }
            
            .progress-fill::after {
                content: '' !important;
                position: absolute !important;
                top: 0 !important;
                left: 0 !important;
                right: 0 !important;
                bottom: 0 !important;
                background: linear-gradient(45deg, 
                    rgba(255,255,255,0.2) 25%, 
                    transparent 25%, 
                    transparent 50%, 
                    rgba(255,255,255,0.2) 50%, 
                    rgba(255,255,255,0.2) 75%, 
                    transparent 75%, 
                    transparent) !important;
                background-size: 20px 20px !important;
                animation: progressStripes 1s linear infinite !important;
            }
            
            @keyframes progressStripes {
                0% { background-position: 0 0; }
                100% { background-position: 20px 0; }
            }
            
            .progress-fill.complete { 
                background: linear-gradient(135deg, #28a745 0%, #20c997 100%) !important; 
            }
            .progress-fill.good { 
                background: linear-gradient(135deg, #28a745 0%, #20c997 100%) !important; 
            }
            .progress-fill.warning { 
                background: linear-gradient(135deg, #ffc107 0%, #fd7e14 100%) !important; 
            }
            .progress-fill.danger { 
                background: linear-gradient(135deg, #dc3545 0%, #e83e8c 100%) !important; 
            }
            
            .progress-text {
                font-size: 0.9rem !important;
                color: #6c757d !important;
                text-align: center !important;
                font-weight: 500 !important;
            }
            
            /* ======================
               ONGLET CONFIGURATION
               ====================== */
            .config-container {
                max-width: 700px !important;
                margin: 0 auto !important;
            }
            
            .config-container h4 {
                color: #1a1a2e !important;
                margin-bottom: 30px !important;
                font-size: 1.3rem !important;
                font-weight: 600 !important;
                text-align: center !important;
            }
            
            .config-section {
                margin: 25px 0 !important;
                padding: 25px !important;
                background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%) !important;
                border-radius: 12px !important;
                border-left: 5px solid #1a1a2e !important;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1) !important;
            }
            
            .config-section label {
                display: block !important;
                font-weight: 600 !important;
                margin-bottom: 12px !important;
                color: #1a1a2e !important;
                font-size: 1rem !important;
            }
            
            .config-section input[type="number"] {
                width: 120px !important;
                padding: 12px 15px !important;
                border: 2px solid #ced4da !important;
                border-radius: 8px !important;
                font-size: 1rem !important;
                font-weight: 600 !important;
                transition: all 0.3s ease !important;
                background: white !important;
            }
            
            .config-section input[type="number"]:focus {
                outline: none !important;
                border-color: #1a1a2e !important;
                box-shadow: 0 0 0 3px rgba(26, 26, 46, 0.1) !important;
                transform: scale(1.02) !important;
            }
            
            .config-section small {
                display: block !important;
                color: #6c757d !important;
                margin-top: 8px !important;
                font-style: italic !important;
                font-size: 0.9rem !important;
            }
            
            .config-section h5 {
                color: #1a1a2e !important;
                margin: 20px 0 15px 0 !important;
                font-size: 1.1rem !important;
                font-weight: 600 !important;
            }
            
            .objective-row {
                display: flex !important;
                justify-content: space-between !important;
                align-items: center !important;
                margin: 15px 0 !important;
                padding: 15px 0 !important;
                border-bottom: 1px solid #e9ecef !important;
                transition: background 0.3s ease !important;
            }
            
            .objective-row:hover {
                background: rgba(26, 26, 46, 0.05) !important;
                border-radius: 8px !important;
                padding-left: 10px !important;
                padding-right: 10px !important;
            }
            
            .objective-row:last-child {
                border-bottom: none !important;
            }
            
            .objective-row label {
                flex: 1 !important;
                font-weight: 500 !important;
                margin: 0 !important;
                color: #495057 !important;
            }
            
            .config-actions {
                margin-top: 40px !important;
                text-align: center !important;
                padding-top: 25px !important;
                border-top: 2px solid #e9ecef !important;
            }
            
            .config-actions .btn {
                margin: 0 15px !important;
                padding: 12px 25px !important;
                font-weight: 600 !important;
                border-radius: 8px !important;
                transition: all 0.3s ease !important;
            }
            
            .config-actions .btn:hover {
                transform: translateY(-2px) !important;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15) !important;
            }
            
            /* ======================
               PIED DE PAGE
               ====================== */
            .stats-footer {
                background: #f8f9fa !important;
                padding: 20px 30px !important;
                border-top: 1px solid #e9ecef !important;
                display: flex !important;
                justify-content: space-between !important;
                align-items: center !important;
                border-radius: 0 0 15px 15px !important;
                flex-wrap: wrap !important;
                gap: 15px !important;
            }
            
            .stats-footer .btn {
                padding: 12px 20px !important;
                font-weight: 600 !important;
                border-radius: 8px !important;
                transition: all 0.3s ease !important;
            }
            
            .stats-footer .btn:hover {
                transform: translateY(-2px) !important;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15) !important;
            }
            
            /* ======================
               RESPONSIVE
               ====================== */
            @media (max-width: 768px) {
                .stats-modal {
                    width: 98vw !important;
                    max-height: 95vh !important;
                    margin: 1vh auto !important;
                }
                
                .stats-header {
                    padding: 20px 15px !important;
                }
                
                .stats-header h3 {
                    font-size: 1.2rem !important;
                }
                
                .stats-tabs {
                    flex-wrap: wrap !important;
                }
                
                .stats-tab {
                    flex: 1 !important;
                    min-width: 120px !important;
                    padding: 15px 12px !important;
                    font-size: 0.9rem !important;
                }
                
                .stats-content {
                    padding: 20px 15px !important;
                    max-height: 500px !important;
                }
                
                .cgp-summary {
                    grid-template-columns: 1fr !important;
                    gap: 15px !important;
                }
                
                .cgp-metric {
                    padding: 20px 15px !important;
                }
                
                .metric-value {
                    font-size: 2rem !important;
                }
                
                .cgp-table-container {
                    overflow-x: auto !important;
                    font-size: 0.8rem !important;
                }
                
                .cgp-table th,
                .cgp-table td {
                    padding: 10px 8px !important;
                }
                
                .objectives-grid {
                    grid-template-columns: 1fr !important;
                    gap: 20px !important;
                }
                
                .objective-card {
                    padding: 20px !important;
                }
                
                .config-container {
                    max-width: 100% !important;
                }
                
                .config-section {
                    padding: 20px 15px !important;
                }
                
                .objective-row {
                    flex-direction: column !important;
                    align-items: flex-start !important;
                    gap: 10px !important;
                }
                
                .stats-footer {
                    padding: 15px !important;
                    flex-direction: column !important;
                    text-align: center !important;
                }
                
                .stats-footer .btn {
                    width: 100% !important;
                    margin-bottom: 10px !important;
                }
            }
            
            @media (max-width: 480px) {
                .stats-modal {
                    width: 100vw !important;
                    height: 100vh !important;
                    max-height: 100vh !important;
                    border-radius: 0 !important;
                    margin: 0 !important;
                }
                
                .stats-header {
                    border-radius: 0 !important;
                }
                
                .stats-footer {
                    border-radius: 0 !important;
                }
            }
        `;
        
        document.head.appendChild(style);
    }
    
    getConformityClass(rate) {
        if (rate >= 80) return 'high';
        if (rate >= 60) return 'medium';
        return 'low';
    }

    // NOUVEAU : Formater la valeur d'un détail
    formatDetailValue(detail) {
        let value = detail.reponse;
        if (detail.qualite) {
            value += ` (${detail.qualite})`;
        }
        return value;
    }

    // NOUVEAU : Déterminer le type d'impact
    determineImpactType(before, after) {
        if (!before.conforme && after.conforme) {
            return 'improvement';
        } else if (before.conforme && !after.conforme) {
            return 'degradation';
        }
        return 'neutral';
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

    // Méthode pour rafraîchir l'interface
    refresh() {
        if (this.isHistorySectionActive()) {
            this.loadHistoryData();
            Utils.debugLog('Interface historique rafraîchie');
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

    // NOUVEAU : Fermer une modal spécifique de révision
    closeModal(modalType) {
        const modal = document.getElementById(`modal-${modalType}`) || 
                     document.getElementById(`modal-details-${modalType}`) ||
                     document.getElementById(`modal-revision-diff-${modalType}`);
        if (modal) {
            modal.remove();
            Utils.debugLog(`Modal ${modalType} fermée`);
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
            // Nettoyer l'écouteur d'événement
            if (modal.escapeHandler) {
                document.removeEventListener('keydown', modal.escapeHandler);
            }
            
            modal.remove();
            Utils.debugLog('Modal statistiques fermée proprement');
        }
    }

    // Nettoyage général
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

















