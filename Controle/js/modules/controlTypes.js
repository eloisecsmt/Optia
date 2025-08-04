// controlTypes.js - Version modifiée avec boutons Remplacer et Régénérer échantillon

import { Utils } from './utils.js';

export class ControlTypes {
    constructor() {
        this.controlDefinitions = this.initializeControlDefinitions();
        this.currentControl = null;
        this.availableDossiers = []; // Pool des dossiers éligibles non encore sélectionnés
        this.setupEventListeners();
    }

    initializeControlDefinitions() {
        return {
            'LCB-FT': {
                name: 'LCB-FT',
                description: 'Contrôle Lutte Contre le Blanchiment et Financement du Terrorisme',
                frequency: 'Mensuel',
                sampleSize: 5,
                priority: 'high',
                criteria: {
                    requiredDocuments: [
                        'Pièce d\'identité',
                        'Justificatif de domicile',
                        'Questionnaire KYC',
                        'Déclaration origine des fonds',
                        'Contrôle listes de sanctions'
                    ],
                    montantMinimum: 10000,
                    excludeDomaines: [],
                    includePPE: false,
                    nouveauxClients: false
                },
                checklistItems: [
                    'Vérification identité client',
                    'Contrôle liste de sanctions',
                    'Analyse risque client',
                    'Validation origine des fonds',
                    'Cohérence patrimoine/revenus',
                    'Diligence renforcée si nécessaire',
                    'Déclaration de soupçon si nécessaire'
                    ]
            },
            'FINANCEMENT': {
                name: 'Financement',
                description: 'Contrôle des dossiers de financement et crédits',
                frequency: 'Hebdomadaire',
                sampleSize: 8,
                priority: 'medium',
                criteria: {
                    requiredDocuments: [
                        'Dossier de financement',
                        'Garanties',
                        'Analyse financière'
                    ],
                    montantMinimum: 50000,
                    excludeDomaines: [],
                    includePPE: false,
                    nouveauxClients: false
                },
                checklistItems: [
                    'Analyse de la capacité de remboursement',
                    'Validation des garanties',
                    'Cohérence du projet de financement',
                    'Respect des ratios prudentiels',
                    'Documentation complète'
                ]
            },
            'CARTO_CLIENT': {
                name: 'Carto Client',
                description: 'Cartographie et classification des clients',
                frequency: 'Trimestriel',
                sampleSize: 10,
                priority: 'medium',
                criteria: {
                    requiredDocuments: [
                        'Fiche client',
                        'Questionnaire risque',
                        'Classification'
                    ],
                    montantMinimum: 0,
                    excludeDomaines: [],
                    includePPE: false,
                    nouveauxClients: false
                },
                checklistItems: [
                    'Mise à jour des informations client',
                    'Classification risque appropriée',
                    'Cohérence du profil',
                    'Suivi des évolutions',
                    'Documentation à jour'
                ]
            },
            'OPERATION': {
                name: 'Opération',
                description: 'Contrôle des opérations et transactions clients',
                frequency: 'Hebdomadaire',
                sampleSize: 12,
                priority: 'high',
                criteria: {
                    requiredDocuments: [
                        'Fiche de renseignements',
                        'Profil de risques',
                        'Cartographie client (Harvest)',
                        'Lettre de mission',
                        'RIB client',
                        'Convention RTO',
                        'Cartographie opération',
                        'Origine/Destination des fonds',
                        'Archivage Zeendoc'
                    ],
                    montantMinimum: 5000,
                    excludeDomaines: [],
                    includePPE: false,
                    nouveauxClients: false
                },
                checklistItems: [
                    'Conformité de l\'opération',
                    'Vérification des montants et frais',
                    'Cohérence du type d\'opération',
                    'Validation des références bancaires',
                    'Justification des mouvements (origine/destination)',
                    'Respect des procédures internes',
                    'Contrôle des délais de traitement',
                    'Traçabilité complète dans Harvest',
                    'Validation des motifs de rachat',
                    'Archivage des pièces justificatives'
                ]
            },
            'NOUVEAU_CLIENT': {
                name: 'Nouveau Client',
                description: 'Contrôle spécifique des nouveaux clients',
                frequency: 'Hebdomadaire',
                sampleSize: 6,
                priority: 'high',
                criteria: {
                    requiredDocuments: [
                        'Dossier d\'ouverture',
                        'KYC complet',
                        'Documents d\'identité'
                    ],
                    montantMinimum: 0,
                    excludeDomaines: [],
                    includePPE: false,
                    nouveauxClients: true // OBLIGATOIRE : Seulement les nouveaux clients
                },
                checklistItems: [
                    'Complétude du dossier d\'ouverture',
                    'Vérification d\'identité approfondie',
                    'Cohérence des informations',
                    'Première opération conforme',
                    'Classification risque initiale'
                ]
            }
        };
    }

    setupEventListeners() {
        // Écouter les événements de sélection de contrôle
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('control-type-btn')) {
                const controlType = e.target.dataset.controlType;
                this.selectControlType(controlType);
            }
        });

        // Écouter les données traitées pour activer l'interface
        window.addEventListener('dataProcessed', (e) => {
            this.enableControlInterface(e.detail);
        });
    }

    enableControlInterface(data) {
        this.allDossiers = data.allDossiers;
        this.filteredDossiers = data.filteredDossiers;
        
        // Mettre à jour l'interface des contrôles automatiques
        this.updateControlInterface();
        Utils.debugLog('Interface de contrôle activée avec ' + this.allDossiers.length + ' dossiers');
    }

    updateControlInterface() {
        const controlSection = document.getElementById('automatic-control-section');
        if (!controlSection) return;

        const controlGrid = controlSection.querySelector('.control-types-grid');
        if (!controlGrid) return;

        // Générer les cartes de contrôle
        controlGrid.innerHTML = this.generateControlCards();
    }

    generateControlCards() {
        return Object.entries(this.controlDefinitions).map(([key, control]) => {
            const eligibleCount = this.getEligibleDossiers(key).length;
            const priorityColor = this.getPriorityColor(control.priority);
            
            return `
                <div class="control-card" data-control-type="${key}">
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
                            <span class="stat-value">${control.sampleSize}</span>
                            <span class="stat-label">Échantillon</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-value">${control.frequency}</span>
                            <span class="stat-label">Fréquence</span>
                        </div>
                    </div>
                    
                    <div class="control-criteria">
                        <h4>Critères de sélection :</h4>
                        <ul>
                            ${control.criteria.montantMinimum > 0 ? `<li>Montant ≥ ${control.criteria.montantMinimum.toLocaleString('fr-FR')} €</li>` : ''}
                            ${control.criteria.nouveauxClients ? '<li>Nouveaux clients uniquement</li>' : '<li>Tous types de clients</li>'}
                        </ul>
                    </div>
                    
                    <button class="btn btn-primary control-type-btn" 
                            data-control-type="${key}"
                            ${eligibleCount < control.sampleSize ? 'disabled' : ''}>
                        ${eligibleCount < control.sampleSize ? 
                            `Insuffisant (${eligibleCount}/${control.sampleSize})` : 
                            'Lancer le contrôle'
                        }
                    </button>
                </div>
            `;
        }).join('');
    }

    getPriorityColor(priority) {
        const colors = {
            'high': '#dc3545',
            'medium': '#ffc107',
            'low': '#28a745'
        };
        return colors[priority] || '#6c757d';
    }

    getEligibleDossiers(controlType) {
        const control = this.controlDefinitions[controlType];
        if (!control || !this.allDossiers) return [];

        return this.allDossiers.filter(dossier => {
            // Critère montant minimum
            if (control.criteria.montantMinimum > 0) {
                const montantValue = this.extractNumericAmount(dossier.montant);
                if (montantValue < control.criteria.montantMinimum) return false;
            }

            // Critère domaines exclus
            if (control.criteria.excludeDomaines.length > 0) {
                if (control.criteria.excludeDomaines.includes(dossier.domaine)) return false;
            }

            // Critère nouveaux clients (OBLIGATOIRE pour le contrôle NOUVEAU_CLIENT)
            if (control.criteria.nouveauxClients) {
                if (!dossier.nouveauClient || dossier.nouveauClient.toLowerCase() !== 'oui') return false;
            }

            return true;
        });
    }

    extractNumericAmount(montantString) {
        if (!montantString) return 0;
        
        // Extraire la valeur numérique du montant formaté
        const cleaned = montantString.toString()
            .replace(/[^\d,.-]/g, '')
            .replace(/,/g, '.');
        
        const number = parseFloat(cleaned);
        return isNaN(number) ? 0 : number;
    }

    selectControlType(controlType) {
        const control = this.controlDefinitions[controlType];
        if (!control) {
            Utils.showNotification('Type de contrôle invalide', 'error');
            return;
        }

        Utils.debugLog(`=== LANCEMENT CONTRÔLE ${controlType} ===`);
        
        const eligibleDossiers = this.getEligibleDossiers(controlType);
        
        if (eligibleDossiers.length < control.sampleSize) {
            Utils.showNotification(
                `Pas assez de dossiers éligibles (${eligibleDossiers.length}/${control.sampleSize})`, 
                'error'
            );
            return;
        }

        // Sélection aléatoire de l'échantillon
        const selectedDossiers = this.selectRandomSample(eligibleDossiers, control);
        
        // NOUVEAU : Stocker les dossiers disponibles pour remplacement
        this.availableDossiers = eligibleDossiers.filter(d => 
            !selectedDossiers.some(s => s.originalIndex === d.originalIndex)
        );
        
        Utils.debugLog(`Dossiers sélectionnés pour contrôle ${controlType}: ${selectedDossiers.length}`);
        Utils.debugLog(`Dossiers disponibles pour remplacement: ${this.availableDossiers.length}`);
        
        // Lancer l'interface de contrôle
        this.launchControlInterface(controlType, selectedDossiers);
    }

    selectRandomSample(eligibleDossiers, control) {
        let sample = [];
        
        // Stratégie de sélection selon le type de contrôle
        if (control.criteria.nouveauxClients) {
            // Priorité aux nouveaux clients
            const nouveaux = eligibleDossiers.filter(d => 
                d.nouveauClient && d.nouveauClient.toLowerCase() === 'oui'
            );
            const anciens = eligibleDossiers.filter(d => 
                !d.nouveauClient || d.nouveauClient.toLowerCase() !== 'oui'
            );
            
            // Prendre d'abord les nouveaux, puis compléter avec les anciens
            const nouveauxSelected = Utils.getRandomElements(nouveaux, Math.min(nouveaux.length, control.sampleSize));
            const remaining = control.sampleSize - nouveauxSelected.length;
            const anciensSelected = remaining > 0 ? Utils.getRandomElements(anciens, remaining) : [];
            
            sample = [...nouveauxSelected, ...anciensSelected];
        } else {
            // Sélection aléatoire simple
            sample = Utils.getRandomElements(eligibleDossiers, control.sampleSize);
        }
        
        return sample;
    }

    launchControlInterface(controlType, selectedDossiers) {
        // Stocker les données du contrôle en cours
        this.currentControl = {
            type: controlType,
            definition: this.controlDefinitions[controlType],
            selectedDossiers: selectedDossiers,
            startTime: new Date(),
            results: []
        };

        // Naviguer vers l'interface de sélection d'échantillon
        Utils.showSection('sample-selection-section');
        
        // Mettre à jour l'interface avec l'échantillon
        this.updateSampleSelectionInterface();
        
        // Notifier les autres modules
        window.dispatchEvent(new CustomEvent('controlLaunched', {
            detail: this.currentControl
        }));
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

        // Mettre à jour les informations
        const sampleInfo = section.querySelector('.sample-info p');
        if (sampleInfo) {
            sampleInfo.textContent = `Échantillon de ${this.currentControl.selectedDossiers.length} dossier(s) généré pour le contrôle ${this.currentControl.definition.name}. Choisissez le dossier à contrôler :`;
        }

        // Remplir le tableau de l'échantillon
        this.populateSampleTable();
    }

    populateSampleTable() {
        const tbody = document.getElementById('sample-table-body');
        if (!tbody || !this.currentControl) return;

        tbody.innerHTML = '';

        this.currentControl.selectedDossiers.forEach((dossier, index) => {
            const row = document.createElement('tr');
            const canReplace = this.availableDossiers.length > 0;
            
            row.innerHTML = `
                <td><strong>${dossier.client}</strong></td>
                <td>${dossier.codeDossier || 'N/A'}</td>
                <td>${dossier.conseiller || 'N/A'}</td>
                <td>${dossier.montant || 'N/A'}</td>
                <td>${dossier.domaine || 'N/A'}</td>
                <td class="sample-actions">
                    <button class="btn-control" onclick="window.controlTypes?.startDocumentControl(${index})">
                        Contrôler
                    </button>
                    <button class="btn-replace ${canReplace ? '' : 'disabled'}" 
                            onclick="window.controlTypes?.replaceDossier(${index})"
                            ${canReplace ? '' : 'disabled'}>
                        Remplacer
                    </button>
                </td>
            `;
            tbody.appendChild(row);
        });

        // Ajouter le bouton "Régénérer échantillon" sous le tableau
        this.addRegenerateButton();
    }

    // NOUVELLE MÉTHODE : Ajouter le bouton régénérer
    addRegenerateButton() {
        const section = document.getElementById('sample-selection-section');
        if (!section) return;

        // Chercher s'il existe déjà
        let sampleActions = section.querySelector('.sample-actions-footer');
        
        if (!sampleActions) {
            // Créer la section d'actions
            sampleActions = document.createElement('div');
            sampleActions.className = 'sample-actions-footer';
            
            // L'insérer avant les boutons de navigation existants
            const existingBtnGroup = section.querySelector('.btn-group');
            if (existingBtnGroup) {
                section.insertBefore(sampleActions, existingBtnGroup);
            } else {
                section.appendChild(sampleActions);
            }
        }

        sampleActions.innerHTML = `
            <div class="regenerate-section">
                <p class="regenerate-info">
                    <strong>🔄 Échantillon complet :</strong> 
                    ${this.currentControl.selectedDossiers.length} dossiers sélectionnés, 
                    ${this.availableDossiers.length} dossiers disponibles pour remplacement
                </p>
                <button class="btn btn-warning btn-regenerate" onclick="window.controlTypes?.regenerateSample()">
                    🔄 Régénérer l'échantillon complet
                </button>
            </div>
        `;
    }

    // NOUVELLE MÉTHODE : Remplacer un dossier spécifique
    replaceDossier(index) {
        if (!this.currentControl || index >= this.currentControl.selectedDossiers.length) {
            Utils.showNotification('Erreur: dossier non trouvé', 'error');
            return;
        }

        if (this.availableDossiers.length === 0) {
            Utils.showNotification('Aucun dossier disponible pour le remplacement', 'warning');
            return;
        }

        const oldDossier = this.currentControl.selectedDossiers[index];
        
        // Sélectionner un nouveau dossier aléatoirement
        const randomIndex = Math.floor(Math.random() * this.availableDossiers.length);
        const newDossier = this.availableDossiers[randomIndex];
        
        // Effectuer le remplacement
        this.currentControl.selectedDossiers[index] = newDossier;
        
        // Mettre à jour les listes
        // Ajouter l'ancien dossier aux disponibles
        this.availableDossiers.push(oldDossier);
        // Retirer le nouveau des disponibles
        this.availableDossiers.splice(randomIndex, 1);
        
        // Mettre à jour l'affichage
        this.populateSampleTable();
        
        // Notification
        Utils.showNotification(
            `Dossier remplacé : ${oldDossier.client} → ${newDossier.client}`, 
            'success'
        );
        
        Utils.debugLog(`Remplacement: ${oldDossier.client} → ${newDossier.client}`);
    }

    // NOUVELLE MÉTHODE : Régénérer complètement l'échantillon
    regenerateSample() {
        if (!this.currentControl) {
            Utils.showNotification('Aucun contrôle en cours', 'error');
            return;
        }

        // Confirmation utilisateur
        if (!confirm(`Êtes-vous sûr de vouloir régénérer complètement l'échantillon ?\n\nCela va remplacer tous les ${this.currentControl.selectedDossiers.length} dossiers actuels par de nouveaux dossiers.`)) {
            return;
        }

        const controlType = this.currentControl.type;
        const control = this.currentControl.definition;
        
        // Récupérer tous les dossiers éligibles
        const allEligibleDossiers = this.getEligibleDossiers(controlType);
        
        if (allEligibleDossiers.length < control.sampleSize) {
            Utils.showNotification(
                `Pas assez de dossiers éligibles pour régénérer (${allEligibleDossiers.length}/${control.sampleSize})`, 
                'error'
            );
            return;
        }

        // Sélectionner un nouvel échantillon
        const newSelectedDossiers = this.selectRandomSample(allEligibleDossiers, control);
        
        // Mettre à jour les données
        this.currentControl.selectedDossiers = newSelectedDossiers;
        this.availableDossiers = allEligibleDossiers.filter(d => 
            !newSelectedDossiers.some(s => s.originalIndex === d.originalIndex)
        );
        
        // Mettre à jour l'affichage
        this.populateSampleTable();
        
        // Notification
        Utils.showNotification(
            `Nouvel échantillon généré avec ${newSelectedDossiers.length} dossiers`, 
            'success'
        );
        
        Utils.debugLog(`Échantillon régénéré: ${newSelectedDossiers.length} nouveaux dossiers`);
    }

    startDocumentControl(dossierIndex) {
        if (!this.currentControl || !this.currentControl.selectedDossiers[dossierIndex]) {
            Utils.showNotification('Erreur: dossier non trouvé', 'error');
            return;
        }

        const selectedDossier = this.currentControl.selectedDossiers[dossierIndex];
        
        Utils.debugLog(`Lancement contrôle documentaire pour: ${selectedDossier.client}`);
        
        // Déclencher l'événement pour le DocumentController
        window.dispatchEvent(new CustomEvent('startDocumentControl', {
            detail: {
                dossier: selectedDossier,
                control: this.currentControl
            }
        }));
    }

    updateControlSection() {
        if (!this.currentControl) return;

        const controlSection = document.getElementById('control-section');
        if (!controlSection) return;

        // Mettre à jour le titre
        const title = controlSection.querySelector('.section-title');
        if (title) {
            title.textContent = `Contrôle ${this.currentControl.definition.name}`;
        }

        // Générer l'interface de contrôle détaillée
        const controlContent = controlSection.querySelector('.control-content') || controlSection;
        
        controlContent.innerHTML = `
            <div class="control-summary">
                <h3>Résumé du contrôle</h3>
                <div class="control-info-grid">
                    <div class="control-info-item">
                        <strong>Type:</strong> ${this.currentControl.definition.name}
                    </div>
                    <div class="control-info-item">
                        <strong>Échantillon:</strong> ${this.currentControl.selectedDossiers.length} dossiers
                    </div>
                    <div class="control-info-item">
                        <strong>Priorité:</strong> ${this.currentControl.definition.priority.toUpperCase()}
                    </div>
                    <div class="control-info-item">
                        <strong>Démarré:</strong> ${this.currentControl.startTime.toLocaleString('fr-FR')}
                    </div>
                </div>
            </div>

            <div class="control-checklist">
                <h3>Points de contrôle</h3>
                <ul>
                    ${this.currentControl.definition.checklistItems.map(item => 
                        `<li class="checklist-item">${item}</li>`
                    ).join('')}
                </ul>
            </div>

            <div class="control-dossiers">
                <h3>Dossiers à contrôler</h3>
                <div class="dossiers-list">
                    ${this.generateControlDossiersList()}
                </div>
            </div>

            <div class="btn-group">
                <button class="btn btn-success" onclick="window.controlTypes?.completeControl()">
                    Marquer comme terminé
                </button>
                <button class="btn btn-primary" onclick="window.controlTypes?.exportControlResults()">
                    Exporter les résultats
                </button>
                <button class="btn btn-secondary" onclick="window.controlTypes?.returnToAutomaticControls()">
                    Retour aux contrôles
                </button>
            </div>
        `;
    }

    generateControlDossiersList() {
        return this.currentControl.selectedDossiers.map((dossier, index) => `
            <div class="control-dossier-item">
                <div class="dossier-header">
                    <strong>${index + 1}. ${dossier.client}</strong>
                    <span class="dossier-amount">${dossier.montant}</span>
                </div>
                <div class="dossier-details">
                    <span>Code: ${dossier.codeDossier || 'N/A'}</span>
                    <span>Conseiller: ${dossier.conseiller || 'N/A'}</span>
                    <span>Domaine: ${dossier.domaine || 'N/A'}</span>
                    ${dossier.ppe && dossier.ppe.toLowerCase() === 'oui' ? '<span class="badge oui">PPE</span>' : ''}
                    ${dossier.nouveauClient && dossier.nouveauClient.toLowerCase() === 'oui' ? '<span class="badge nouveau">Nouveau</span>' : ''}
                </div>
            </div>
        `).join('');
    }

    completeControl() {
        if (!this.currentControl) return;

        this.currentControl.endTime = new Date();
        this.currentControl.status = 'completed';
        
        Utils.showNotification('Contrôle marqué comme terminé', 'success');
        Utils.debugLog(`Contrôle ${this.currentControl.type} terminé`);
    }

    exportControlResults() {
        if (!this.currentControl) {
            Utils.showNotification('Aucun contrôle en cours', 'error');
            return;
        }

        const exportData = this.currentControl.selectedDossiers.map((dossier, index) => ({
            'N°': index + 1,
            'Type Contrôle': this.currentControl.definition.name,
            'Client': dossier.client,
            'Code Dossier': dossier.codeDossier,
            'Conseiller': dossier.conseiller,
            'Domaine': dossier.domaine,
            'Montant': dossier.montant,
            'Nouveau Client': dossier.nouveauClient,
            'PPE': dossier.ppe,
            'Date Contrôle': this.currentControl.startTime.toLocaleDateString('fr-FR'),
            'Statut': this.currentControl.status || 'En cours',
            'Remarques': '' // À remplir manuellement
        }));

        const fileName = Utils.generateFileName(`Controle_${this.currentControl.type}`);
        
        // Utiliser le FileHandler pour l'export
        if (window.fileHandler) {
            window.fileHandler.exportToExcel(exportData, fileName);
        }
    }

    returnToAutomaticControls() {
        Utils.showSection('automatic-control-section');
    }

    returnToSampleSelection() {
        if (this.currentControl) {
            Utils.showSection('sample-selection-section');
        } else {
            Utils.showSection('automatic-control-section');
        }
    }

    getCurrentControl() {
        return this.currentControl;
    }

    getControlDefinitions() {
        return this.controlDefinitions;
    }
}
