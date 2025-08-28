// documentController.js - listes des questions pour chaque contrôle
// pourquoi ça fonctionne pas et ça redeploy pas mon code

import { Utils } from './utils.js';

export class DocumentController {
    constructor() {
        this.currentDossier = null;
        this.currentControl = null;
        this.documentsConfig = this.initializeDocumentsConfig();
        this.documentsState = {};
        this.currentDocument = null;
        this.currentQuestionIndex = 0;
        this.documentResponses = {};
        this.setupEventListeners();
        this.manualControlMode = false;
        this.manualSelectedDossiers = [];
        this.currentManualControlType = null;
        this.currentDossierIndex = 0;
        this.manualControlResults = [];
        this.manualControlStartTime = null;
        this.manualControlDefinition = null;
        this.currentControlId = null;
        this.isResumingControl = false;
        this.isRevisionMode = false;
        this.originalControlId = null;
        this.originalResponses = {};
        this.modifiedFields = new Set();
        this.revisionStartTime = null;
    }

    startManualControl(selectedDossiers, controlType) {
        Utils.debugLog('=== DÉBUT CONTRÔLE MANUEL DOCUMENTAIRE ===');
        Utils.debugLog(`Type: ${controlType}, Dossiers: ${selectedDossiers.length}`);
        
        // Initialiser le contrôle manuel
        this.manualControlMode = true;
        this.manualSelectedDossiers = selectedDossiers;
        this.currentManualControlType = controlType;
        this.currentDossierIndex = 0;
        this.manualControlResults = [];
        this.manualControlStartTime = new Date();
        
        // Obtenir la définition du contrôle
        this.manualControlDefinition = this.getControlDefinition(controlType);
        
        if (!this.manualControlDefinition) {
            Utils.showNotification('Erreur: Type de contrôle non reconnu', 'error');
            return;
        }
        
        // Afficher l'interface de progression
        this.showManualProgressInterface();
        
        // Commencer par le premier dossier
        this.startNextDossierControl();
    }

     // Identifier un dossier de manière unique
    generateDossierKey(dossier) {
        return `${dossier.codeDossier || 'NO_CODE'}_${dossier.reference || 'NO_REF'}_${dossier.montant || 'NO_AMOUNT'}`;
    }

    // Vérifier si un dossier est déjà contrôlé pour un type donné
    isDossierControlled(dossier, controlType) {
        if (!window.persistenceManager) return false;
        
        const dossierKey = this.generateDossierKey(dossier);
        return window.persistenceManager.isDossierControlled(dossierKey, controlType);
    }

    // Filtrer les dossiers déjà contrôlés
    filterUncontrolledDossiers(dossiers, controlType) {
        return dossiers.filter(dossier => !this.isDossierControlled(dossier, controlType));
    }

    getControlDefinition(controlType) {
        // Obtenir depuis ControlTypes ou utiliser des définitions par défaut
        if (window.controlTypes) {
            const definitions = window.controlTypes.getControlDefinitions();
            return definitions[controlType];
        }
        
        // Définitions de base
        const defaultDefinitions = {
            'LCB-FT': {
                name: 'LCB-FT',
                description: 'Contrôle Lutte Contre le Blanchiment et Financement du Terrorisme'
            },
            'NOUVEAU_CLIENT': {
                name: 'Nouveau Client',
                description: 'Contrôle spécifique des nouveaux clients'
            },
            'FINANCEMENT': {
                name: 'Financement',
                description: 'Contrôle des dossiers de financement et crédits'
            },
            'CARTO_CLIENT': {
                name: 'Carto Client',
                description: 'Cartographie et classification des clients'
            },
            'MIS_A_JOUR': {
                name: 'Mise à jour',
                description: 'Contrôle de mise à jour documentaire pour clients existants'
            },
            'ADEQUATION': {
                name: 'Adéquation',
                description: 'Contrôle de l\'adéquation des conseils et recommandations clients'
            },
            'ARBITRAGE': {
                name: 'Arbitrage',
                description: 'Contrôle spécifique des opérations d\'arbitrage entre supports'
            }
        };
        
        return defaultDefinitions[controlType];
    }

    filterQuestionsForControlType(questions) {
        const controlType = this.currentControl?.type;
        
        if (!controlType) return questions;
        
        return questions.filter(question => {
            // Exclure les questions marquées pour exclusion
            if (question.excludeFor && question.excludeFor.includes(controlType)) {
                Utils.debugLog(`Question exclue pour ${controlType}: ${question.text.substring(0, 50)}...`);
                return false;
            }
            
            // Inclure seulement les questions spécifiques si définies
            if (question.showOnlyFor && !question.showOnlyFor.includes(controlType)) {
                Utils.debugLog(`Question non applicable pour ${controlType}: ${question.text.substring(0, 50)}...`);
                return false;
            }
            
            return true;
        });
    }

    showManualProgressInterface() {
        Utils.showSection('manual-control-progress-section');
        this.updateManualProgressInterface();
    }

    updateManualProgressInterface() {
        const totalDossiers = this.manualSelectedDossiers.length;
        const currentNumber = this.currentDossierIndex + 1;
        const progressPercent = Math.round((this.currentDossierIndex / totalDossiers) * 100);
        
        // Mise à jour des éléments de progression
        const elements = {
            'current-dossier-number': currentNumber,
            'total-dossiers-count': totalDossiers,
            'progress-percent': progressPercent
        };
        
        Object.entries(elements).forEach(([id, value]) => {
            const element = document.getElementById(id);
            if (element) element.textContent = value;
        });
        
        // Mise à jour de la barre de progression
        const progressFill = document.getElementById('manual-progress-fill');
        if (progressFill) {
            progressFill.style.width = `${progressPercent}%`;
        }
        
        // Mise à jour des informations du dossier actuel
        if (this.currentDossierIndex < this.manualSelectedDossiers.length) {
            const currentDossier = this.manualSelectedDossiers[this.currentDossierIndex];
            this.updateCurrentDossierInfo(currentDossier);
        }
        
        // Mise à jour des dossiers terminés
        this.updateCompletedDossiersList();
    }

    updateCurrentDossierInfo(dossier) {
        const info = {
            'current-dossier-client': dossier.client || 'Non spécifié',
            'current-dossier-code': dossier.codeDossier || 'N/A',
            'current-dossier-conseiller': dossier.conseiller || 'N/A',
            'current-dossier-montant': dossier.montant || 'N/A'
        };
        
        Object.entries(info).forEach(([id, value]) => {
            const element = document.getElementById(id);
            if (element) element.textContent = value;
        });
    }

    updateCompletedDossiersList() {
        const section = document.getElementById('completed-dossiers-section');
        const list = document.getElementById('completed-dossiers-list');
        
        if (!section || !list) return;
        
        if (this.manualControlResults.length === 0) {
            section.style.display = 'none';
            return;
        }
        
        section.style.display = 'block';
        
        list.innerHTML = this.manualControlResults.map(result => {
            const isConforme = (result.obligatoryIssuesCount || 0) === 0;
            return `
                <div class="completed-item ${isConforme ? 'conforme' : 'non-conforme'}">
                    <span class="completed-client">${result.dossier.client}</span>
                    <span class="completed-status ${isConforme ? 'conforme' : 'non-conforme'}">
                        ${isConforme ? '✅ Conforme' : '❌ Non conforme'}
                    </span>
                </div>
            `;
        }).join('');
    }

    startNextDossierControl() {
        if (this.currentDossierIndex >= this.manualSelectedDossiers.length) {
            // Tous les dossiers sont terminés
            this.completeManualControl();
            return;
        }
        
        const currentDossier = this.manualSelectedDossiers[this.currentDossierIndex];
        
        Utils.debugLog(`Démarrage contrôle dossier ${this.currentDossierIndex + 1}/${this.manualSelectedDossiers.length}: ${currentDossier.client}`);
        
        // Créer un contrôle fictif pour ce dossier
        const manualControl = {
            type: this.currentManualControlType,
            definition: this.manualControlDefinition,
            selectedDossiers: [currentDossier]
        };
        
        // Mettre à jour l'interface de progression
        this.updateManualProgressInterface();
        
        // Démarrer le contrôle documentaire classique
        this.startDocumentControl(currentDossier, manualControl);
    }

    // Méthode modifiée pour enlever FR et Profil Risques du contrôle CARTO_CLIENT
    getRequiredDocuments(controlType) {
        const documentSets = {
            'LCB-FT': [1, 4, 7, 8, 12, 99], // FR, Carto Client, CNI, Justificatif Domicile, Zeendoc
            'FINANCEMENT': [4, 5, 13, 15, 16, 17, 18, 99], // Carto Client, Carto Opé, FIL, Mandat de fi, Synthèse + Adéq. Fiche conseil, Bon pour accord, Zeendoc  
            'CARTO_CLIENT': [4 ,7, 8, 99], // Carto Client, CNI, Justif, Zeendoc
            'OPERATION': [22, 4, 6, 10, 11, 13, 19, 20, 99], // FR, Profil Risques, Carto Client, LM Entrée en Relation, Convention RTO, RIB, Carto Opération, Zeendoc
            'NOUVEAU_CLIENT': [1, 2, 4, 5, 7, 8, 9, 10, 21, 23, 24, 99], // FR, Profil Risques, Carto Client, FIL, LM Entrée en Relation, CNI, Justificatif Domicile, RIB, Zeendoc
            'CONTROLE_PPE': [1, 2, 7, 8, 9, 99], // FR, Profil Risques, CNI, Justificatif Domicile, Etude, Zeendoc
            'AUDIT_CIF': [2, 6, 11, 99], // Profil Risques, LM Entrée en Relation, Convention RTO, Zeendoc
            'MIS_A_JOUR': [1, 2, 4, 5, 7, 8, 9, 10,11, 21, 23, 24, 99], // FR, Profil Risques, Carto Client, FIL, LM Entrée en Relation, CNI, Justificatif Domicile, RIB, Zeendoc
            'ADEQUATION': [19, 99], // Déclaration d'adéquation, Zeendoc
            'ARBITRAGE': [22, 6, 11, 19, 20, 99] //
        };

        const result = documentSets[controlType] || [1, 2, 7, 8, 99];
        console.log('Documents retournés:', result);
        return result;

            if (controlType === 'OPERATION') {
            let documents = [22, 4, 6, 10, 11, 13, 19, 20, 99]; // Base + Carto Opération
            
            // Ajouter conditionnellement selon le type d'opération
            // NOTE: Dans une vraie implémentation, on récupérerait le type d'opération du dossier
            // Pour l'instant, on inclut les deux et on gérera dans les questions
            documents.push(12); // Origine des fonds (versement)
            documents.push(14); // Destination des fonds (rachat)
            
            return documents;
        }

        return documentSets[controlType] || [1, 2, 7, 8, 99];
    }

    initializeDocumentsConfig() {
        return {
            1: {
                id: 1,
                name: 'FR',
                fullName: 'Fiche de Renseignements',
                questions: [
                    {
                        text: 'Est-ce que le document est présent ?',
                        type: 'boolean',
                        required: true,
                        help: 'Vérifiez si la Fiche de Renseignements est présente dans le dossier client',
                        skipIfNo: true
                    },
                    {
                        text: 'Quel est le type de document ?',
                        type: 'document_type',
                        required: true,
                        help: 'Vérifiez si c\'est un document papier signé ou un formulaire électronique RIC',
                        options: ['RIC (électronique)', 'Papier signé']
                    },
                    {
                        text: 'Est-ce la bonne version ?',
                        type: 'boolean',
                        required: true,
                        help: 'Vérifiez la date de version en bas du document',
                        qualityCheck: {
                            text: 'La version correspond-elle effectivement aux standards en vigueur ?',
                            help: 'Version récente sans modifications non autorisées'
                        }
                    },
                    {
                        text: 'La FR a-t-elle été mise à jour dans les 24 derniers mois ?',
                        type: 'boolean',
                        required: true,
                        showOnlyFor: ['MIS_A_JOUR'], // NOUVEAU : Question spécifique mise à jour
                        help: 'Vérifier si la FR a été actualisée dans les 24 mois (obligation réglementaire)',
                        followUp: {
                            condition: 'Non',
                            question: {
                                text: 'Cette absence de mise à jour pose-t-elle un problème pour le dossier ?',
                                type: 'boolean',
                                required: true,
                                help: 'Évaluer l\'impact de l\'absence de mise à jour sur la conformité du dossier',
                                qualityCheck: {
                                    text: 'L\'absence de mise à jour constitue-t-elle une anomalie réglementaire ?',
                                    help: 'Considérer les risques, évolutions du profil client, et obligations légales'
                                }
                            }
                        }
                    },
                    {
                        text: 'Est-ce que le document est entièrement complété ?',
                        type: 'boolean',
                        required: true,
                        excludeFor: ['MIS_A_JOUR'],
                        help: 'Aucun champ obligatoire vide, toutes les sections renseignées',
                        qualityCheck: {
                            text: 'Les informations renseignées sont-elles cohérentes et complètes ?',
                            help: 'Pas d\'incohérences dans les dates, montants, statuts ou noms'
                        }
                    },
                    {
                        text: 'Le client est-il mineur ou sous protection juridique ?',
                        type: 'protection_status',
                        required: true,
                        showOnlyFor: ['NOUVEAU_CLIENT', 'MIS_A_JOUR'],
                        help: 'Vérifiez le statut juridique du client',
                        options: [
                            'Non (majeur capable)',
                            'Mineur',
                            'Tutelle',
                            'Curatelle', 
                            'Mandat de protection future (activé)',
                            'Mandat de protection future (non activé)',
                            'Autre'
                        ]
                    },
                    {
                        text: 'Si autre statut, précisez :',
                        type: 'text',
                        required: true,
                        showOnlyFor: ['NOUVEAU_CLIENT', 'MIS_A_JOUR'],
                        help: 'Détaillez le statut de protection particulier',
                        showOnlyIf: {
                            questionIndex: -1,
                            answer: 'Autre'
                        }
                    },
                    {
                        text: 'Les documents de protection juridique requis sont-ils présents ?',
                        type: 'checklist',
                        required: true,
                        showOnlyFor: ['NOUVEAU_CLIENT', 'MIS_A_JOUR'],
                        help: 'Cochez les documents manquants. Si tous sont présents, ne cochez rien.',
                        showOnlyIf: {
                            questionIndex: -2,
                            answerIn: ['Mineur', 'Tutelle', 'Curatelle', 'Mandat de protection future (activé)', 'Mandat de protection future (non activé)', 'Autre']
                        },
                        options: [
                            'Habilitation/Jugement de protection manquant',
                            'Pièce d\'identité du/des tuteurs manquante', 
                            'Justificatif de domicile du/des tuteurs manquant',
                            'Carton de signature du/des tuteurs manquant'
                        ]
                    },
                    {
                        text: 'Par rapport à l\'ancien document, les informations ont-elles évolué ?',
                        type: 'boolean',
                        required: true,
                        showOnlyFor: ['MIS_A_JOUR'],
                        help: 'Comparer avec l\'ancienne version du document pour vérifier les évolutions',
                        qualityCheck: {
                            text: 'Les modifications apportées sont-elles cohérentes et justifiées ?',
                            help: 'Vérifier que les changements reflètent l\'évolution réelle de la situation du client (revenus, patrimoine, situation familiale, etc.)'
                        }
                    },
                    {
                        text: 'Les mentions sont-elles présentes sur le document ?',
                        type: 'boolean',
                        required: true,
                        help: 'Mentions légales obligatoires en bas ou en annexe du document',
                        qualityCheck: {
                            text: 'Les mentions légales sont-elles correctement positionnées et lisibles ?',
                            help: 'Texte complet, pas coupé, police suffisante pour être lu'
                        }
                    },
                    {
                        text: 'La date est-elle présente sur le document ?',
                        type: 'boolean',
                        required: true,
                        help: 'Date de signature ou de création du document',
                        qualityCheck: {
                            text: 'La date indiquée est-elle cohérente avec le dossier ?',
                            help: 'Date postérieure à l\'entretien, dans les 6 derniers mois'
                        }
                    },
                    {
                        text: 'La signature du conseiller est-elle présente ?',
                        type: 'boolean',
                        required: true,
                        help: 'Signature manuscrite ou électronique du conseiller',
                        qualityCheck: {
                            text: 'La signature du conseiller est-elle conforme ?',
                            help: 'Manuscrite lisible OU DocuSign certifiée, nom correct, bien datée',
                            type: 'signature_conseiller'
                        }
                    },
                    {
                        text: 'La signature de tous les clients est-elle présente ?',
                        type: 'boolean',
                        required: true,
                        help: 'Signatures de tous les titulaires et co-titulaires',
                        qualityCheck: {
                            text: 'Toutes les signatures clients sont-elles conformes ?',
                            help: 'Signatures distinctes, lisibles, correspondant aux identités',
                            type: 'signature_clients'
                        }
                    }
                ]
            },
            2: {
                id: 2,
                name: 'Profil Risques',
                fullName: 'Profil de Risques Client',
                questions: [
                    {
                        text: 'Est-ce que le document est présent ?',
                        type: 'boolean',
                        required: true,
                        help: 'Vérifiez si le Profil de Risques Client est présent dans le dossier client',
                        skipIfNo: true
                    },
                    {
                        text: 'Quel est le type de document ?',
                        type: 'document_type',
                        required: true,
                        help: 'Questionnaire papier ou formulaire électronique',
                        options: ['Electronique', 'Papier']
                    },
                    {
                        text: 'Est-ce la bonne version ?',
                        type: 'boolean',
                        required: true,
                        help: 'Version actuelle du questionnaire de profil de risque',
                        qualityCheck: {
                            text: 'La version est-elle conforme aux exigences réglementaires ?',
                            help: 'Questions MiFID conformes, version récente'
                        }
                    },
                    {
                        text: 'Le profil a-t-il été mis à jour dans les 24 derniers mois ?',
                        type: 'boolean',
                        required: true,
                        showOnlyFor: ['MIS_A_JOUR'],
                        help: 'Vérifier la mise à jour du profil de risques (obligation tous les 24 mois)',
                        followUp: {
                            condition: 'Non',
                            question: {
                                text: 'Cette absence de mise à jour du profil pose-t-elle un problème ?',
                                type: 'boolean',
                                required: true,
                                help: 'Évaluer si l\'absence de mise à jour impacte l\'adéquation des conseils',
                                qualityCheck: {
                                    text: 'L\'absence de mise à jour compromet-elle l\'adéquation des recommandations ?',
                                    help: 'Considérer l\'évolution possible du profil de risque du client'
                                }
                            }
                        }
                    },
                    {
                        text: 'Est-ce que le document est entièrement complété ?',
                        type: 'boolean',
                        required: true,
                        excludeFor: ['MIS_A_JOUR'],
                        help: 'Toutes les questions du profil de risque renseignées',
                        qualityCheck: {
                            text: 'Toutes les sections du questionnaire sont-elles cohérentes avec le profil client ?',
                            help: 'Réponses logiques entre expérience, objectifs et horizon'
                        }
                    },
                    {
                        text: 'L\'ancien profil de risques a-t-il été archivé ?',
                        type: 'boolean',
                        required: true,
                        showOnlyFor: ['MIS_A_JOUR'],
                        help: 'Vérifiez si l\'ancien profil de risques a été correctement sauvegardé/archivé avant la mise à jour',
                        showOnlyIf: {
                            questionIndex: -1, // Se réfère à la question précédente sur l'évolution
                            answer: 'Oui'
                        },
                        qualityCheck: {
                            text: 'L\'archivage de l\'ancien profil de risques est-il complet et traçable ?',
                            help: 'Vérifiez que l\'historique des profils de risques est conservé de manière exploitable'
                        }
                    },
                    {
                        text: 'Par rapport à l\'ancien profil, les informations ont-elles évolué ?',
                        type: 'boolean',
                        required: true,
                        showOnlyFor: ['MIS_A_JOUR'],
                        help: 'Comparer avec l\'ancien profil de risques pour vérifier les évolutions',
                        qualityCheck: {
                            text: 'Les modifications du profil reflètent-elles l\'évolution réelle du client ?',
                            help: 'Vérifier cohérence des changements : expérience acquise, évolution des objectifs, changement d\'horizon d\'investissement, nouvelles contraintes'
                        }
                    },
                    {
                        text: 'Les préférences ESG du client sont-elles renseignées dans le document ?',
                        type: 'boolean',
                        required: true,
                        help: 'Vérifiez si la section ESG (Environnementale, Sociale et de Gouvernance) du profil de risques est complétée avec les préférences du client',
                        qualityCheck: {
                            text: 'Les préférences ESG sont-elles clairement exprimées et cohérentes avec le profil client ?',
                            help: 'Vérifiez que les critères ESG sont précisément documentés et correspondent aux valeurs/objectifs exprimés par le client'
                        }
                    },
                    {
                        text: 'La date est-elle présente sur le document ?',
                        type: 'boolean',
                        required: true,
                        help: 'Date de création ou dernière mise à jour',
                        qualityCheck: {
                            text: 'La date de création/mise à jour est-elle documentée ?',
                            help: 'Date claire et traçable des modifications'
                        }
                    },
                    {
                        text: 'Datant de - de 24 mois ?',
                        type: 'boolean',
                        required: true,
                        help: 'Profil de risque valide (moins de 24 mois)',
                        qualityCheck: {
                            text: 'La date est-elle effectivement inférieure à 24 mois ?',
                            help: 'Calcul exact depuis la création jusqu\'aujourd\'hui'
                        }
                    },
                    {
                        text: 'La signature de tous les clients est-elle présente ?',
                        type: 'boolean',
                        required: true,
                        help: 'Accord du client sur son profil de risque',
                        qualityCheck: {
                            text: 'Les clients ont-ils signé en attestant avoir pris connaissance de leur profil ?',
                            help: 'Signatures avec mention explicite d\'accord sur le profil',
                            type: 'signature_clients'
                        }
                    }
                ]
            },
            3: {
                id: 3,
                name: 'Profil ESG',
                fullName: 'Profil ESG Client',
                questions: [
                    {
                        text: 'Est-ce que le document est présent ?',
                        type: 'boolean',
                        required: true,
                        help: 'Vérifiez si le Profil ESG Client est présent dans le dossier client',
                        skipIfNo: true,
                        skipIfNC : true
                    },
                    {
                        text: 'Quel est le type de document ?',
                        type: 'document_type',
                        required: true,
                        help: 'Questionnaire papier ou formulaire électronique',
                        options: ['Electronique', 'Papier']
                    },
                    {
                        text: 'Est-ce la bonne version ?',
                        type: 'boolean',
                        required: true,
                        help: 'Version actuelle du questionnaire ESG',
                        qualityCheck: {
                            text: 'La version est-elle conforme aux exigences ESG ?',
                            help: 'Critères ESG conformes, version récente'
                        }
                    },
                    {
                        text: 'Est-ce que le document est entièrement complété ?',
                        type: 'boolean',
                        required: true,
                        help: 'Toutes les préférences ESG renseignées',
                        qualityCheck: {
                            text: 'Les préférences ESG sont-elles clairement exprimées et documentées ?',
                            help: 'Préférences précises avec exemples concrets'
                        }
                    },
                    {
                        text: 'La date est-elle présente sur le document ?',
                        type: 'boolean',
                        required: true,
                        help: 'Date de création du profil ESG',
                        qualityCheck: {
                            text: 'La date indiquée est-elle cohérente ?',
                            help: 'Date récente et traçable'
                        }
                    },
                    {
                        text: 'La signature du conseiller est-elle présente ?',
                        type: 'boolean',
                        required: true,
                        help: 'Validation ESG par le conseiller',
                        qualityCheck: {
                            text: 'Le conseiller a-t-il validé la prise en compte des critères ESG ?',
                            help: 'Signature avec validation explicite des préférences ESG',
                            type: 'signature_conseiller'
                        }
                    },
                    {
                        text: 'La signature de tous les clients est-elle présente ?',
                        type: 'boolean', 
                        required: true,
                        help: 'Accord du client sur ses préférences ESG',
                        qualityCheck: {
                            text: 'Le client confirme-t-il l\'exactitude de ses préférences ESG ?',
                            help: 'Signature avec confirmation explicite des choix ESG',
                            type: 'signature_clients'
                        }
                    }
                ]
            },
            4: {
                id: 4,
                name: 'Carto Client',
                fullName: 'Cartographie Client & GDA',
                questions: [
                    {
                        text: 'La cartographie client a-t-elle été réalisée ?',
                        type: 'boolean',
                        required: true,
                        help: 'Vérifiez si la cartographie client a été effectuée, que ce soit sur papier ou dans Harvest',
                        skipIfNo: true,
                        skipIfNC : true
                    },
                    {
                        text: 'Comment la cartographie a-t-elle été réalisée ?',
                        type: 'carto_support',
                        required: true,
                        help: 'Indiquez si la cartographie a été faite directement dans Harvest ou sur papier puis saisie',
                        options: ['Harvest', 'Papier']
                    },
                    {
                        text: 'Les informations de la cartographie papier ont-elles bien été reportées dans Harvest ?',
                        type: 'boolean',
                        required: true,
                        help: 'Vérifiez que toutes les informations de la cartographie papier ont été correctement saisies dans Harvest',
                        showOnlyIf: {
                            questionIndex: 1, // Question précédente (index 1)
                            answer: 'Papier'
                        },
                        qualityCheck: {
                            text: 'Le report des informations est-il complet et fidèle ?',
                            help: 'Vérifiez que toutes les données de la cartographie papier sont présentes dans Harvest sans erreur'
                        }
                    },
                    {
                        text: 'Les informations nécessaire à la réalisation de la cartographie sont-elles présente dans Harvest  ?',
                        type: 'boolean',
                        required: true,
                        help: 'Vérifiez que les champs obligatoires du profil client sont complétés dans Harvest',
                        qualityCheck: {
                            text: 'Les informations sont-elles complètes et à jour ?',
                            help: 'Vérifiez la cohérence et l\'exhaustivité des données : nom, prénom, adresse, date de naissance, situation familiale, profession, etc.'
                        }
                    },
                    {
                        text: 'La date est-elle présente ?',
                        type: 'boolean',
                        required: true,
                        help: 'Date de création',
                        qualityCheck: {
                            text: 'La date indiquée est-elle cohérente ?',
                            help: 'Date récente et traçable'
                        }
                    },
                    {
                        text: 'La cartographie client précédente a-t-elle été archivée?',
                        type: 'boolean',
                        required: true,
                        help: 'Présence du fichier archivé',
                    },
                    {
                        text: 'Est-ce que le patrimoine est-il connu ?',
                        type: 'boolean',
                        required: true,
                        help: 'Vérifiez si les informations patrimoniales sont renseignées dans Harvest',
                        followUp: {
                            condition: 'Oui',
                            question: {
                                text: 'Quelle est la tranche de patrimoine ?',
                                type: 'patrimoine_tranche',
                                required: true,
                                help: 'Sélectionnez la tranche correspondant au patrimoine déclaré',
                                options: [
                                    'Inférieur à 100k€',
                                    '100k€ à 300k€', 
                                    '300k€ à 500k€',
                                    '500k€ à 1M€',
                                    '1M€ à 2M€',
                                    '2M€ à 5M€',
                                    '5M€ à 10M€',
                                    'Supérieur à 10M€'
                                ]
                            }
                        }
                    },
                    {
                        text: 'Est-ce que les revenus sont-ils connus ?',
                        type: 'boolean',
                        required: true,
                        help: 'Vérifiez si les informations de revenus sont renseignées dans Harvest',
                        followUp: {
                            condition: 'Oui',
                            question: {
                                text: 'Quelle est la tranche de revenus ?',
                                type: 'revenus_tranche',
                                required: true,
                                help: 'Sélectionnez la tranche correspondant aux revenus déclarés',
                                options: [
                                    'Inférieur à 25k€',
                                    '25k€ à 50k€',
                                    '50k€ à 75k€', 
                                    '75k€ à 100k€',
                                    '100k€ à 150k€',
                                    '150k€ à 300k€',
                                    'Supérieur à 300k€'
                                ]
                            }
                        }
                    },
                    {
                        text: 'Le justificatif de patrimoine requis est-il présent ?',
                        type: 'boolean',
                        required: true,
                        help: 'Vérifiez la présence du justificatif selon le niveau de vigilance : Standard (FR) / Complémentaire ou Renforcée (déclaration d\'impôts)',
                        qualityCheck: {
                            text: 'Le justificatif de patrimoine est-il approprié ?',
                            help: 'Vérifiez que le document fourni correspond bien aux exigences de vigilance'
                        }
                    },
                    {
                        text: 'Quel est le niveau de vigilance client retenu par le conseiller ?',
                        type: 'vigilance_level',
                        required: true,
                        help: 'Information à récupérer depuis le fichier source ou Harvest',
                        options: [
                            'Standard',
                            'Complémentaire',
                            'Renforcée'
                        ]
                    },
                        {
                        text: 'Êtes-vous d\'accord avec la vigilance retenue ?',
                        type: 'boolean',
                        required: true,
                        help: 'Validez si le niveau de vigilance attribué au client vous semble approprié',
                        qualityCheck: {
                            text: 'Le niveau de vigilance est-il justifié au regard du profil client ?',
                            help: 'Vérifiez la cohérence entre le profil de risque du client et le niveau de vigilance appliqué'
                        },
                        followUp: {
                            condition: 'Non',
                            question: {
                                text: 'Quel niveau de vigilance devrait être appliqué ?',
                                type: 'vigilance_level',
                                required: true,
                                help: 'Sélectionnez le niveau de vigilance que vous estimez approprié pour ce client',
                                options: [
                                    'Standard',
                                    'Complémentaire', 
                                    'Renforcée'
                                ]
                            }
                        }
                    },
                    {
                        text: 'Le justificatif patrimoine/revenus correspond-il au niveau de vigilance ?',
                        type: 'boolean',
                        required: true,
                        help: 'Vérifiez la cohérence entre vigilance et justificatifs fournis',
                        qualityCheck: {
                            text: 'Le justificatif fourni est-il conforme au niveau de vigilance ?',
                            help: 'Standard: FR acceptée / Complémentaire: Déclaration d\'impôts obligatoire / Renforcée: Déclaration d\'impôts + justificatifs complémentaires'
                        }
                    },
                    {
                        text: 'Quel est le statut du GDA (Gel des Avoirs) dans Harvest ?',
                        type: 'gda_status',
                        required: true,
                        help: 'Vérifiez le statut du Gel des Avoirs dans la tuile Harvest',
                        options: [
                            'Automatique',
                            'Manuel',
                            'Pas fait'
                        ],
                        followUp: {
                            condition: 'Manuel',
                            question: {
                                text: 'Quelle est la date du GDA manuel ?',
                                type: 'gda_date',
                                required: true,
                                help: 'Saisissez la date du Gel des Avoirs manuel (format JJ/MM/AAAA)'
                            }
                        }
                    }                    
                ]
            },
            5: {
                id: 5,
                name: 'FIL',
                fullName: 'Fiche d\'Information Légale',
                questions: [
                    {
                        text: 'Est-ce que le document est présent ?',
                        type: 'boolean',
                        required: true,
                        help: 'Vérifiez si la Fiche d\'Information Légale est présente dans le dossier client',
                        skipIfNo: true,
                        skipIfNC : true
                    },
                    {
                        text: 'Quel est le type de document ?',
                        type: 'document_type',
                        required: true,
                        help: 'Questionnaire papier ou formulaire électronique',
                        options: ['Electronique', 'Papier']
                    },
                    {
                        text: 'Est-ce la bonne version ?',
                        type: 'boolean',
                        required: true,
                        help: 'Vérifiez que la version de la FIL est à jour selon la réglementation en vigueur',
                        qualityCheck: {
                            text: 'La version de la FIL est-elle conforme aux obligations légales actuelles ?',
                            help: 'Version récente intégrant les dernières évolutions réglementaires et mentions obligatoires'
                        }
                    },
                    {
                        text: 'La date est-elle présente sur le document ?',
                        type: 'boolean',
                        required: true,
                        help: 'Date de création du profil ESG',
                        qualityCheck: {
                            text: 'La date indiquée est-elle cohérente ?',
                            help: 'Date récente et traçable'
                        }
                    },
                    {
                        text: 'La signature du conseiller est-elle présente ?',
                        type: 'boolean',
                        required: true,
                        help: 'Signature du conseiller attestant de la remise de la FIL au client',
                        qualityCheck: {
                            text: 'La signature atteste-t-elle de la remise effective et de l\'information du client ?',
                            help: 'Signature avec date et confirmation de la transmission des informations légales',
                            type: 'signature_conseiller'
                        }
                    },
                    {
                        text: 'La signature de tous les clients est-elle présente ?',
                        type: 'boolean',
                        required: true,
                        help: 'Accusé de réception de la FIL par le client',
                        qualityCheck: {
                            text: 'Le client confirme-t-il avoir reçu et pris connaissance des informations légales ?',
                            help: 'Signature avec mention explicite de réception et prise de connaissance',
                            type: 'signature_clients'
                        }
                    }
                ]
            },
            6: {
                id: 6,
                name: 'Lettre de Mission',
                fullName: 'Lettre de Mission',
                questions: [
                    {
                        text: 'Est-ce que le document est présent ?',
                        type: 'boolean',
                        required: true,
                        help: 'Vérifiez si la Lettre de Mission d\'Entrée en Relation est présente dans le dossier client',
                        skipIfNo: true,
                        skipIfNC : true
                    },
                    {
                        text: 'Quel est le type de document ?',
                        type: 'document_type',
                        required: true,
                        help: 'Questionnaire papier ou formulaire électronique',
                        options: ['Electronique', 'Papier']
                    },
                    {
                        text: 'Est-ce la bonne version ?',
                        type: 'boolean',
                        required: true,
                        help: 'Version actualisée conforme aux obligations réglementaires',
                        qualityCheck: {
                            text: 'La version respecte-t-elle les obligations de transparence et d\'information ?',
                            help: 'Mentions légales à jour, conditions générales conformes, tarification claire'
                        }
                    },
                    {
                        text: 'Est-ce que le document est entièrement complété ?',
                        type: 'boolean',
                        required: true,
                        help: 'Toutes les sections renseignées : services, tarifs, modalités, obligations',
                        qualityCheck: {
                            text: 'Les prestations et modalités sont-elles clairement définies ?',
                            help: 'Services détaillés, fréquence de reporting, modalités de contact précisées'
                        }
                    },
                    {
                        text: 'Les mentions sont-elles présentes sur le document ?',
                        type: 'boolean',
                        required: true,
                        help: 'Mentions légales obligatoires pour l\'entrée en relation bancaire/financière',
                        qualityCheck: {
                            text: 'Toutes les mentions réglementaires sont-elles présentes et conformes ?',
                            help: 'RGPD, droit de rétractation, médiateur, garantie des dépôts, etc.'
                        }
                    },
                    {
                        text: 'La date est-elle présente sur le document ?',
                        type: 'boolean',
                        required: true,
                        help: 'Date d\'entrée en relation et de prise d\'effet de la mission',
                        qualityCheck: {
                            text: 'La date de la lettre de mission est-elle cohérente avec le dossier ?',
                            help: 'Date de signature postérieure à l\'ouverture de compte et aux premiers échanges'
                        }
                    },
                    {
                        text: 'La signature de tous les clients est-elle présente ?',
                        type: 'boolean',
                        required: true,
                        help: 'Acceptation formelle de la mission par le client',
                        qualityCheck: {
                            text: 'Le client confirme-t-il son acceptation des conditions de la mission ?',
                            help: 'Signature avec acceptation explicite des prestations et de la tarification',
                            type: 'signature_clients'
                        }
                    },
                    {
                        text: 'La signature du conseiller est-elle présente ?',
                        type: 'boolean',
                        required: true,
                        help: 'Engagement du conseiller sur les services RTO proposés',
                        qualityCheck: {
                            text: 'Le conseiller atteste-t-il de sa capacité à fournir les services RTO ?',
                            help: 'Signature avec confirmation des habilitations et compétences',
                            type: 'signature_conseiller'
                        }
                    },
                     {
                        text: 'L\'opération concerne-t-elle un produit CIF (Conseiller en Investissements Financiers) ?',
                        type: 'boolean',
                        required: true,
                        help: 'Vérifiez si l\'opération porte sur des instruments financiers nécessitant une habilitation CIF',
                        followUp: {
                            condition: 'Oui',
                            question: {
                                text: 'Est-ce que le conseiller est CIF ?',
                                type: 'boolean',
                                required: true,
                                help: 'Vérifiez si le conseiller du dossier possède la certification CIF (Conseiller en Investissements Financiers)',
                                followUp: {
                                    condition: 'Non',
                                    question: {
                                        text: 'La signature d\'un CIF est-elle présente ?',
                                        type: 'boolean',
                                        required: true,
                                        help: 'Si le conseiller n\'est pas CIF, un CIF habilité doit signer la convention',
                                        followUp: {
                                            condition: 'Oui',
                                            question: {
                                                text: 'Qui est le CIF signataire ?',
                                                type: 'text',
                                                required: true,
                                                help: 'Nom et prénom du CIF qui a signé la convention'
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    },
                    {
                        text: 'Y\'a-t-il un profil risque correspondant ?',
                        type: 'boolean',
                        required: true,
                        help: 'Vérification de l\'existence et de la cohérence du profil de risque client',
                        qualityCheck: {
                            text: 'Le profil de risque est-il cohérent avec la mission proposée ?',
                            help: 'Adéquation entre services proposés et appétence/capacité de risque du client'
                        }
                    }
                ]
            },
            7: {
                id: 7,
                name: 'CNI',
                fullName: 'Carte Nationale d\'Identité',
                questions: [
                    {
                        text: 'Est-ce que le document est présent ?',
                        type: 'boolean',
                        required: true,
                        help: 'Vérifiez si la Carte Nationale d\'Identité est présente dans le dossier client',
                        skipIfNo: true,
                        skipIfNC : true
                    },
                    {
                        text: 'Quel est le type de document ?',
                        type: 'text',
                        required: true,
                        help: 'CNI, passeport, titre de séjour, etc.'
                    },
                    {
                        text: 'Le document est-il valide ?',
                        type: 'boolean',
                        required: true,
                        help: 'Date d\'expiration et état du document',
                        qualityCheck: {
                            text: 'La date d\'expiration est-elle inférieur à 5 ans  et le document en bon état ?',
                            help: 'Document non expiré, lisible et non détérioré'
                        }
                    }
                ]
            },
            8: {
                id: 8,
                name: 'Justificatif de domicile',
                fullName: 'Justificatif de Domicile',
                questions: [
                    {
                        text: 'Est-ce que le document est présent ?',
                        type: 'boolean',
                        required: true,
                        help: 'Vérifiez si le Justificatif de Domicile est présent dans le dossier client',
                        skipIfNo: true,
                        skipIfNC : true
                    },
                    {
                        text: 'Quel est le type de document ?',
                        type: 'text',
                        required: true,
                        help: 'Facture, avis d\'impôts, attestation, etc.'
                    },
                    {
                        text: 'Date de moins de 3 mois ?',
                        type: 'boolean',
                        required: true,
                        help: 'Justificatif récent (moins de 3 mois) sauf pour IRPP',
                        qualityCheck: {
                            text: 'La date du justificatif est-elle effectivement inférieure à 3 mois à la réception ?',
                            help: 'Calcul exact depuis la date du document'
                        }
                    }
                ]
            },
            9: {
                id: 9,
                name: 'Etude',
                fullName: 'Etude Financière Client',
                questions: [
                    {
                        text: 'Est-ce que le document est présent ?',
                        type: 'boolean',
                        required: true,
                        help: 'Vérifiez si l\'Etude Financière Client est présente dans le dossier client',
                        skipIfNo: true,
                        skipIfNC : true
                    },
                    {
                        text: 'Quel est le type de document ?',
                        type: 'document_type',
                        required: true,
                        help: 'Type d\'étude : patrimoniale, fiscale, succession, retraite, investissement',
                        options: ['Etude patrimoniale', 'Etude fiscale', 'Etude succession', 'Etude retraite', 'Etude investissement', 'Autre']
                    },
                    {
                        text: 'Est-ce la bonne version ?',
                        type: 'boolean',
                        required: true,
                        help: 'Version actualisée avec données récentes et réglementation en vigueur',
                        qualityCheck: {
                            text: 'L\'étude intègre-t-elle les dernières évolutions légales et fiscales ?',
                            help: 'Prise en compte lois de finances récentes, évolutions réglementaires'
                        }
                    },
                    {
                        text: 'Est-ce que le document est entièrement complété ?',
                        type: 'boolean',
                        required: true,
                        help: 'Toutes les sections de l\'étude renseignées : diagnostic, préconisations, simulations',
                        qualityCheck: {
                            text: 'L\'étude est-elle exhaustive et les recommandations argumentées ?',
                            help: 'Diagnostic complet, scénarios chiffrés, avantages/inconvénients détaillés'
                        }
                    },
                    {
                        text: 'L\'étude est-elle personnalisée à la situation du client ?',
                        type: 'boolean',
                        required: true,
                        help: 'Adaptation aux objectifs, contraintes et spécificités du client',
                        qualityCheck: {
                            text: 'Les préconisations sont-elles adaptées au profil et aux objectifs client ?',
                            help: 'Cohérence avec situation familiale, professionnelle, patrimoniale et fiscale'
                        }
                    },
                    {
                        text: 'Les simulations et calculs sont-ils présents et cohérents ?',
                        type: 'boolean',
                        required: true,
                        help: 'Présence de simulations chiffrées avec hypothèses explicites',
                        qualityCheck: {
                            text: 'Les hypothèses de calcul sont-elles réalistes et explicites ?',
                            help: 'Taux, durées, évolutions patrimoniales cohérents avec le marché'
                        }
                    },
                    {
                        text: 'La signature du conseiller est-elle présente ?',
                        type: 'boolean',
                        required: true,
                        help: 'Validation de l\'étude par le conseiller auteur',
                        qualityCheck: {
                            text: 'Le conseiller atteste-t-il de la qualité et de la pertinence de l\'étude ?',
                            help: 'Signature avec engagement sur l\'exactitude des analyses et recommandations',
                            type: 'signature_conseiller'
                        }
                    },
                    {
                        text: 'La signature de tous les clients est-elle présente ?',
                        type: 'boolean',
                        required: true,
                        help: 'Prise de connaissance et acceptation de l\'étude par le client',
                        qualityCheck: {
                            text: 'Le client confirme-t-il avoir pris connaissance et accepté l\'étude ?',
                            help: 'Signature avec mention de prise de connaissance des recommandations',
                            type: 'signature_clients'
                        }
                    }
                ]
            },
            10: {
                id: 10,
                name: 'RIB',
                fullName: 'Relevé d\'Identité Bancaire',
                questions: [
                    {
                        text: 'Est-ce que le document est présent ?',
                        type: 'boolean',
                        required: true,
                        help: 'Vérifiez si le Relevé d\'Identité Bancaire est présent dans le dossier client',
                        skipIfNo: true,
                        skipIfNC : true
                    },
                    {
                        text: 'Le RIB correspond t-il bien au client?',
                        type: 'boolean',
                        required: true,
                        help: 'Vérification de la présence et lisibilité du RIB client',
                        qualityCheck: {
                            text: 'Toutes les informations bancaires sont-elles clairement visibles ?',
                            help: 'IBAN, BIC, nom du titulaire, banque domiciliataire lisibles'
                        }
                    }
                ]
            },
            11: {
                id: 11,
                name: 'Convention RTO',
                fullName: 'Convention de Réception et Transmission d\'Ordres',
                questions: [
                    {
                        text: 'Est-ce que le document est présent ?',
                        type: 'boolean',
                        required: true,
                        help: 'Vérifiez si la Convention de Réception et Transmission d\'Ordres est présente dans le dossier client',
                        skipIfNo: true,
                        skipIfNC : true
                    },
                    {
                        text: 'Quel est le type de document ?',
                        type: 'document_type',
                        required: true,
                        help: 'Convention papier signée ou accord électronique pour RTO',
                        options: ['Electronique', 'Papier']
                    },
                    {
                        text: 'Est-ce la bonne version ?',
                        type: 'boolean',
                        required: true,
                        help: 'Version conforme aux obligations MiFID et réglementation française',
                        qualityCheck: {
                            text: 'La convention respecte-t-elle les exigences MiFID et AMF ?',
                            help: 'Clauses conformes, information sur les risques, modalités d\'exécution'
                        }
                    },
                    {
                        text: 'La date est-elle présente sur le document ?',
                        type: 'boolean',
                        required: true,
                        help: 'Date de signature de la convention RTO',
                        qualityCheck: {
                            text: 'La date indiquée est-elle cohérente avec le dossier ?',
                            help: 'Date postérieure à l\'ouverture de compte et aux premiers échanges'
                        }
                    },
                    {
                        text: 'Est-ce que le document est entièrement complété ?',
                        type: 'boolean',
                        required: true,
                        help: 'Toutes les modalités RTO définies : instruments, marchés, conditions d\'exécution',
                        qualityCheck: {
                            text: 'Les modalités d\'exécution et de transmission sont-elles clairement définies ?',
                            help: 'Périmètre d\'intervention, procédures, délais et conditions précisés'
                        }
                    },
                    {
                        text: 'Le document a-t-il été régularisé lors de la mise à jour ?',
                        type: 'boolean',
                        required: true,
                        showOnlyFor: ['MIS_A_JOUR'],
                        help: 'Vérifiez si la convention RTO a été mise à jour/régularisée dans le cadre de la mise à jour du dossier client',
                        followUp: {
                            condition: 'Non',
                            question: {
                                text: 'Cette absence de régularisation pose-t-elle un problème pour le dossier ?',
                                type: 'boolean',
                                required: true,
                                help: 'Évaluer l\'impact de l\'absence de régularisation sur la conformité du dossier',
                                qualityCheck: {
                                    text: 'L\'absence de régularisation constitue-t-elle une anomalie réglementaire ?',
                                    help: 'Considérer l\'évolution du profil client, les nouvelles réglementations, et les obligations de mise à jour'
                                }
                            }
                        }
                    },
                    {
                        text: 'La signature de tous les clients est-elle présente ?',
                        type: 'boolean',
                        required: true,
                        help: 'Acceptation des conditions RTO par le client',
                        qualityCheck: {
                            text: 'Le client confirme-t-il avoir compris les modalités et risques RTO ?',
                            help: 'Signature avec accusé de réception des informations sur les risques',
                            type: 'signature_clients'
                        }
                    },
                    {
                        text: 'La signature du conseiller est-elle présente ?',
                        type: 'boolean',
                        required: true,
                        help: 'Engagement du conseiller sur les services RTO proposés',
                        qualityCheck: {
                            text: 'Le conseiller atteste-t-il de sa capacité à fournir les services RTO ?',
                            help: 'Signature avec confirmation des habilitations et compétences',
                            type: 'signature_conseiller'
                        }
                    },
                    {
                        text: 'Est-ce que le conseiller est CIF ?',
                        type: 'boolean',
                        required: true,
                        help: 'Vérifiez si le conseiller du dossier possède la certification CIF (Conseiller en Investissements Financiers)',
                        followUp: {
                            condition: 'Non',
                            question: {
                                text: 'La signature d\'un CIF est-elle présente ?',
                                type: 'boolean',
                                required: true,
                                help: 'Si le conseiller n\'est pas CIF, un CIF habilité doit signer la convention',
                                followUp: {
                                    condition: 'Oui',
                                    question: {
                                        text: 'Qui est le CIF signataire ?',
                                        type: 'text',
                                        required: true,
                                        help: 'Nom et prénom du CIF qui a signé la convention'
                                    }
                                },
                            }
                        },
                        
                    }
                ]
            },

            12: {
                id: 12,
                name: 'Origine des fonds',
                fullName: 'Déclaration et Justification de l\'Origine des Fonds',
                questions: [
                    {
                        text: 'Est-ce que le document de déclaration d\'origine des fonds est présent ?',
                        type: 'boolean',
                        required: true,
                        help: 'Vérifiez si la déclaration d\'origine des fonds est présente dans le dossier client (obligatoire LCB-FT)',
                        skipIfNo: true
                    },
                    {
                        text: 'Quel est le type de déclaration ?',
                        type: 'origin_type',
                        required: true,
                        help: 'Type de déclaration selon le montant et la complexité de l\'opération',
                        options: [
                            'Déclaration simple (formulaire standard)',
                            'Déclaration détaillée avec justificatifs',
                            'Déclaration complexe (montants importants)',
                            'Déclaration PPE (Personne Politiquement Exposée)'
                        ]
                    },
                    {
                        text: 'La source des fonds est-elle clairement identifiée ?',
                        type: 'boolean',
                        required: true,
                        help: 'Vérification que l\'origine des fonds est précisément documentée',
                        qualityCheck: {
                            text: 'La source des fonds est-elle cohérente et vérifiable ?',
                            help: 'Source précise : salaires, vente immobilière, héritage, épargne, etc. avec éléments de preuve'
                        }
                    },
                    {
                        text: 'Les justificatifs d\'origine des fonds sont-ils présents ?',
                        type: 'boolean',
                        required: true,
                        help: 'Documents prouvant l\'origine : bulletins de salaire, actes de vente, testament, relevés bancaires, etc.',
                        qualityCheck: {
                            text: 'Les justificatifs sont-ils appropriés et récents ?',
                            help: 'Documents officiels, datés, cohérents avec les montants déclarés'
                        }
                    },
                    {
                        text: 'Y a-t-il cohérence entre les revenus déclarés et les montants investis ?',
                        type: 'boolean',
                        required: true,
                        help: 'Vérification que les montants investis sont cohérents avec la capacité financière du client',
                        qualityCheck: {
                            text: 'La cohérence financière est-elle établie et documentée ?',
                            help: 'Ratio investissement/revenus raisonnable, pas de disproportion inexpliquée'
                        }
                    },
                    {
                        text: 'Le client a-t-il été vérifié sur les listes de sanctions ?',
                        type: 'boolean',
                        required: true,
                        help: 'Contrôle obligatoire sur les listes OFAC, UE, ONU, etc.',
                        qualityCheck: {
                            text: 'Le contrôle des listes de sanctions est-il documenté et daté ?',
                            help: 'Preuve du contrôle effectué avec date, résultat et conservation de la trace'
                        }
                    },
                    {
                        text: 'Si montant > 150 000€, une diligence renforcée a-t-elle été effectuée ?',
                        type: 'boolean',
                        required: true,
                        help: 'Vérification spéciale pour les montants importants selon la réglementation',
                        qualityCheck: {
                            text: 'La diligence renforcée est-elle complète et documentée ?',
                            help: 'Enquête approfondie, sources multiples vérifiées, validation hiérarchique'
                        }
                    },
                    {
                        text: 'La déclaration est-elle signée par le client ?',
                        type: 'boolean',
                        required: true,
                        help: 'Signature obligatoire du client attestant de la véracité des informations',
                        qualityCheck: {
                            text: 'La signature atteste-t-elle de la véracité sous peine de sanctions ?',
                            help: 'Signature avec mention explicite d\'engagement sur la véracité des déclarations',
                            type: 'signature_clients'
                        }
                    },
                    {
                        text: 'Le conseiller a-t-il validé et signé l\'analyse d\'origine des fonds ?',
                        type: 'boolean',
                        required: true,
                        help: 'Validation obligatoire par le conseiller de son analyse des éléments fournis',
                        qualityCheck: {
                            text: 'L\'analyse du conseiller est-elle motivée et complète ?',
                            help: 'Analyse écrite des éléments, conclusion motivée, signature avec date',
                            type: 'signature_conseiller'
                        }
                    },
                    {
                        text: 'En cas de doute, une déclaration de soupçon a-t-elle été envisagée/effectuée ?',
                        type: 'suspicion_declaration',
                        required: true,
                        help: 'Vérification de la procédure en cas d\'éléments suspects',
                        options: [
                            'Aucun élément suspect identifié',
                            'Éléments de doute mais analyse concluante',
                            'Déclaration de soupçon envisagée mais non retenue (motivée)',
                            'Déclaration de soupçon effectuée',
                            'Situation non évaluée (anomalie)'
                        ]
                    }
                ]
            },

            13: {
                id: 13,
                name: 'Carto Opération',
                fullName: 'Cartographie et Suivi des Opérations',
                questions: [
                    {
                        text: 'La cartographie de l\'opération a-t-elle été réalisée ?',
                        type: 'boolean',
                        required: true,
                        help: 'Vérifiez si les détails de l\'opération sont correctement saisis dans Harvest',
                        skipIfNo: true
                    },
                    {
                        text: 'Quel est le type d\'opération ?',
                        type: 'operation_type',
                        required: true,
                        help: 'Type d\'opération effectuée par le client',
                        options: [
                            'Versement initial',
                            'Versement complémentaire',
                            'Rachat partiel',
                            'Rachat total',
                            'Arbitrage',
                            'Transfert entrant',
                            'Transfert sortant',
                            'Avance sur contrat'
                        ]
                    },
                    {
                        text: 'Le montant de l\'opération est-il correctement renseigné ?',
                        type: 'boolean',
                        required: true,
                        help: 'Vérification que le montant principal de l\'opération est bien saisi',
                        qualityCheck: {
                            text: 'Le montant correspond-il aux documents justificatifs ?',
                            help: 'Cohérence entre le montant saisi et les pièces jointes (chèque, virement, etc.)'
                        }
                    },
                    {
                        text: 'Les frais appliqués sont-ils détaillés et corrects ?',
                        type: 'boolean',
                        required: true,
                        help: 'Vérification de la présence et exactitude des frais (entrée, gestion, arbitrage, etc.)',
                        qualityCheck: {
                            text: 'Les frais correspondent-ils au barème en vigueur ?',
                            help: 'Application correcte des grilles tarifaires selon le contrat et le type d\'opération'
                        }
                    },
                    {
                        text: 'La date d\'opération est-elle cohérente ?',
                        type: 'boolean',
                        required: true,
                        help: 'Vérification de la cohérence des dates : demande, traitement, valeur',
                        qualityCheck: {
                            text: 'Les dates respectent-elles les délais réglementaires ?',
                            help: 'Respect des délais de traitement et dates de valeur selon la réglementation'
                        }
                    },
                    {
                        text: 'Le support d\'investissement est-il correctement identifié ?',
                        type: 'boolean',
                        required: true,
                        help: 'Vérification que le produit/support de destination est bien renseigné',
                        qualityCheck: {
                            text: 'Le support est-il éligible et autorisé pour ce client ?',
                            help: 'Vérification éligibilité, profil de risque, contraintes réglementaires'
                        }
                    },
                    {
                        text: 'Les références bancaires sont-elles présentes et vérifiées ?',
                        type: 'boolean',
                        required: true,
                        help: 'IBAN, coordonnées bancaires pour virements entrants/sortants',
                        qualityCheck: {
                            text: 'Les coordonnées bancaires sont-elles cohérentes avec le titulaire ?',
                            help: 'Vérification nom titulaire compte, IBAN valide, BIC correct'
                        }
                    },
                    {
                        text: 'Si arbitrage, les modalités sont-elles documentées ?',
                        type: 'boolean',
                        required: true,
                        help: 'Pour les arbitrages : supports source et cible, montants, dates de valeur',
                        qualityCheck: {
                            text: 'L\'arbitrage respecte-t-il les conditions du contrat ?',
                            help: 'Vérification nombre d\'arbitrages gratuits, frais applicables, supports autorisés'
                        }
                    },
                    {
                        text: 'Le statut de traitement de l\'opération est-il à jour ?',
                        type: 'operation_status',
                        required: true,
                        help: 'État actuel du traitement de l\'opération dans Harvest',
                        options: [
                            'En attente de traitement',
                            'En cours de traitement',
                            'Traitée et validée',
                            'Rejetée avec motif',
                            'En attente de pièces',
                            'Annulée à la demande du client'
                        ]
                    },
                    {
                        text: 'Les pièces justificatives sont-elles complètes ?',
                        type: 'boolean',
                        required: true,
                        help: 'Demande signée, chèque/ordre de virement, pièces complémentaires selon le type',
                        qualityCheck: {
                            text: 'Les pièces correspondent-elles au type d\'opération demandée ?',
                            help: 'Exhaustivité et conformité des justificatifs selon la nature de l\'opération'
                        }
                    }
                ]
            },

            14: {
                id: 14,
                name: 'Destination des fonds',
                fullName: 'Destination et Motif des Fonds (Rachats)',
                questions: [
                    {
                        text: 'Est-ce que la destination des fonds est présente ?',
                        type: 'boolean',
                        required: true,
                        help: 'Vérifiez si la destination des fonds de rachat est documentée',
                        skipIfNo: true
                    },
                    {
                        text: 'Quel est le motif du rachat ?',
                        type: 'rachat_motif',
                        required: true,
                        help: 'Raison justifiant le rachat demandé par le client',
                        options: [
                            'Besoin de liquidités personnelles',
                            'Investissement immobilier',
                            'Achat véhicule/équipement',
                            'Frais de scolarité/formation',
                            'Frais médicaux/santé',
                            'Travaux/rénovation',
                            'Autre investissement financier',
                            'Optimisation fiscale',
                            'Situation familiale (mariage, divorce, etc.)',
                            'Retraite/complément de revenus',
                            'Urgence/imprévu',
                            'Autre motif (à préciser)'
                        ]
                    },
                    {
                        text: 'Si "Autre motif", le motif est-il précisé et cohérent ?',
                        type: 'boolean',
                        required: true,
                        help: 'Vérification que le motif libre est détaillé et plausible',
                        qualityCheck: {
                            text: 'Le motif précisé est-il suffisamment détaillé et crédible ?',
                            help: 'Motif explicite, cohérent avec la situation du client, pas de formulation vague'
                        }
                    },
                    {
                        text: 'La destination bancaire est-elle identifiée ?',
                        type: 'boolean',
                        required: true,
                        help: 'Compte de destination pour le virement de rachat',
                        qualityCheck: {
                            text: 'Le compte de destination appartient-il au titulaire du contrat ?',
                            help: 'Vérification nom titulaire, IBAN cohérent, pas de compte tiers sans justification'
                        }
                    },
                    {
                        text: 'Si compte tiers, y a-t-il une procuration ou justification ?',
                        type: 'boolean',
                        required: true,
                        help: 'Vérification des autorisations pour virement sur compte tiers',
                        qualityCheck: {
                            text: 'La procuration ou justification est-elle valide et à jour ?',
                            help: 'Document officiel, signé, dans les délais de validité'
                        }
                    },
                    {
                        text: 'Le montant du rachat est-il cohérent avec le motif ?',
                        type: 'boolean',
                        required: true,
                        help: 'Vérification de la proportionnalité montant/besoin exprimé',
                        qualityCheck: {
                            text: 'Y a-t-il cohérence entre le montant demandé et l\'usage déclaré ?',
                            help: 'Montant adapté au motif, pas de disproportion manifeste'
                        }
                    },
                    {
                        text: 'Des rachats répétés ont-ils été effectués récemment ?',
                        type: 'boolean',
                        required: true,
                        help: 'Vérification de l\'historique des rachats sur les 12 derniers mois',
                        qualityCheck: {
                            text: 'La fréquence des rachats est-elle normale et justifiée ?',
                            help: 'Pas de pattern suspect, motifs cohérents dans le temps'
                        }
                    },
                    {
                        text: 'Le client a-t-il été informé des conséquences fiscales ?',
                        type: 'boolean',
                        required: true,
                        help: 'Information sur les implications fiscales du rachat (plus-values, etc.)',
                        qualityCheck: {
                            text: 'L\'information fiscale est-elle tracée et complète ?',
                            help: 'Document signé, information adaptée au type de contrat et à la durée de détention'
                        }
                    },
                    {
                        text: 'Le conseiller a-t-il validé la cohérence de la demande ?',
                        type: 'boolean',
                        required: true,
                        help: 'Validation par le conseiller de l\'opportunité et de la cohérence du rachat',
                        qualityCheck: {
                            text: 'L\'analyse du conseiller est-elle documentée et motivée ?',
                            help: 'Avis écrit du conseiller sur la pertinence du rachat dans la stratégie du client',
                            type: 'signature_conseiller'
                        }
                    }
                ]
            },
            15: {
            id: 15,
            name: 'Mandat de financ.',
            fullName: 'Mandat de financement',
            questions: [
                {
                    text: 'Est-ce que le document est présent ?',
                    type: 'boolean',
                    required: true,
                    help: 'Vérifiez si le Mandat de financement est présent dans le dossier client',
                    skipIfNo: true
                },
                {
                    text: 'Est-ce la bonne version ?',
                    type: 'boolean',
                    required: true,
                    help: 'Vérifiez que la version du mandat de financement est à jour selon la réglementation en vigueur',
                    qualityCheck: {
                        text: 'La version du mandat est-elle conforme aux obligations légales actuelles ?',
                        help: 'Version récente intégrant les dernières évolutions réglementaires et mentions obligatoires'
                    }
                },
                {
                    text: 'Est-ce que le document est entièrement complété ?',
                    type: 'boolean',
                    required: true,
                    help: 'Toutes les sections du mandat renseignées : objet, modalités, conditions',
                    qualityCheck: {
                        text: 'Toutes les clauses et informations obligatoires sont-elles présentes et complètes ?',
                        help: 'Vérification exhaustive : objet du financement, montant, durée, conditions, garanties'
                    }
                },
                {
                    text: 'Quels éléments sont manquants ou incomplets dans le mandat ?',
                    type: 'checklist',
                    required: true,
                    help: 'Cochez tous les éléments manquants ou incomplets dans le mandat de financement. Si TOUT est complet, ne cochez rien (checklist vide = aucun élément manquant).',
                    showOnlyIf: {
                        questionIndex: 2, // Question précédente (index 2)
                        answer: 'Non'
                    },
                    options: [
                        'Identité du ou des emprunteurs',
                        'Date et lieu de naissance',
                        'La situation familiale',
                        'La profession',
                        'L\'adresse',
                        'Le mail et le téléphone',
                        'La situation financière',
                        'La connaissance des opérations de banque',
                        'Le montant du financement envisagé',
                        'Le type de prêt',
                        'La durée',
                        'Les honoraires',
                        'L\'assurance emprunteur',
                        'Liste des autres prêts'
                    ]
                },
                {
                    text: 'La date est-elle présente sur le document ?',
                    type: 'boolean',
                    required: true,
                    help: 'Date de signature ou de création du mandat',
                    qualityCheck: {
                        text: 'La date indiquée est-elle cohérente avec le dossier ?',
                        help: 'Date postérieure à l\'étude, dans un délai raisonnable'
                    }
                },
                {
                    text: 'La signature du conseiller est-elle présente ?',
                    type: 'boolean',
                    required: true,
                    help: 'Signature manuscrite ou électronique du conseiller',
                    qualityCheck: {
                        text: 'La signature du conseiller est-elle conforme ?',
                        help: 'Manuscrite lisible OU DocuSign certifiée, nom correct, bien datée',
                        type: 'signature_conseiller'
                    }
                },
                {
                    text: 'La signature de tous les clients est-elle présente ?',
                    type: 'boolean',
                    required: true,
                    help: 'Signatures de tous les titulaires et co-titulaires',
                    qualityCheck: {
                        text: 'Toutes les signatures clients sont-elles conformes ?',
                        help: 'Signatures distinctes, lisibles, correspondant aux identités',
                        type: 'signature_clients'
                    }
                },
               {
                text: 'Les mentions sont-elles présentes sur le document ?',
                type: 'boolean',
                required: true,
                help: 'Mentions légales obligatoires en bas ou en annexe du document',
                qualityCheck: {
                    text: 'Les mentions légales sont-elles correctement positionnées et lisibles ?',
                    help: 'Texte complet, pas coupé, police suffisante pour être lu'
                }
            }
        ]
    },
        16: {
            id: 16,
            name: 'Synthèse + Adéq.',
            fullName: 'Synthèse + Adéquation',
            questions: [
                {
                    text: 'Est-ce que le document est présent ?',
                    type: 'boolean',
                    required: true,
                    help: 'Vérifiez si le document Synthèse + Adéquation est présent dans le dossier client',
                    skipIfNo: true
                },
                {
                    text: 'Est-ce la bonne version ?',
                    type: 'boolean',
                    required: true,
                    help: 'Vérifiez que la version du document est à jour selon les standards en vigueur',
                    qualityCheck: {
                        text: 'La version respecte-t-elle le format et les exigences actuelles ?',
                        help: 'Modèle récent, structure conforme, mentions réglementaires présentes'
                    }
                },
                {
                    text: 'Est-ce que le document est entièrement complété ?',
                    type: 'boolean',
                    required: true,
                    help: 'Toutes les sections de la synthèse renseignées',
                    qualityCheck: {
                        text: 'Toutes les informations nécessaires sont-elles présentes et détaillées ?',
                        help: 'Synthèse complète, analyse exhaustive, recommandations argumentées'
                    }
                },
                {
                    text: 'Le modèle a-t-il été respecté ?',
                    type: 'boolean',
                    required: true,
                    help: 'Vérifiez si le document suit le modèle standardisé de l\'établissement',
                    qualityCheck: {
                        text: 'Le document respecte-t-il fidèlement la structure et le contenu du modèle ?',
                        help: 'Sections dans l\'ordre, rubriques complètes, format conforme'
                    }
                },
                {
                    text: 'L\'adéquation a-t-elle été rédigée ?',
                    type: 'boolean',
                    required: true,
                    help: 'Vérifiez la présence d\'une analyse d\'adéquation entre les besoins client et la solution proposée',
                    qualityCheck: {
                        text: 'L\'analyse d\'adéquation est-elle complète et motivée ?',
                        help: 'Justification détaillée, cohérence besoins/solution, alternatives évaluées'
                    }
                }
            ]
        },
        17: {
        id: 17,
        name: 'Fiche conseil',
        fullName: 'Fiche conseil',
        questions: [
            {
                text: 'Est-ce que le document est présent ?',
                type: 'boolean',
                required: true,
                help: 'Vérifiez si la Fiche conseil est présente dans le dossier client',
                skipIfNo: true
            },
            {
                text: 'Est-ce la bonne version ?',
                type: 'boolean',
                required: true,
                help: 'Vérifiez que la version de la fiche conseil est à jour',
                qualityCheck: {
                    text: 'La version de la fiche est-elle conforme aux standards actuels ?',
                    help: 'Version récente, format standardisé, mentions légales à jour'
                }
            },
            {
                text: 'Est-ce que le document est entièrement complété ?',
                type: 'boolean',
                required: true,
                help: 'Toutes les sections de la fiche conseil renseignées',
                qualityCheck: {
                    text: 'Toutes les rubriques sont-elles complètement remplies ?',
                    help: 'Conseils détaillés, recommandations précises, aucune section vide'
                }
            },
            {
                text: 'Quels éléments sont manquants ou incomplets dans la fiche conseil ?',
                type: 'checklist',
                required: true,
                help: 'Cochez tous les éléments manquants ou incomplets dans la fiche conseil. Si TOUT est complet, ne cochez rien (checklist vide = aucun élément manquant).',
                showOnlyIf: {
                    questionIndex: 2, // Question précédente (index 2)
                    answer: 'Non'
                },
                options: [
                    'Identité du ou des emprunteurs',
                    'Adresse',
                    'Montant du prêt',
                    'Caractéristiques du prêt (type, montant, durée, taux)',
                    'Charges financières avant',
                    'Charges financières après',
                    'Montant de la commission bancaire',
                    'Autres informations'
                ]
            },
            {
                text: 'La date est-elle présente sur le document ?',
                type: 'boolean',
                required: true,
                help: 'Date de création ou de signature de la fiche conseil',
                qualityCheck: {
                    text: 'La date indiquée est-elle cohérente avec le dossier ?',
                    help: 'Date logique par rapport au processus de conseil et aux autres documents'
                }
            },
            {
                text: 'La signature de tous les clients est-elle présente ?',
                type: 'boolean',
                required: true,
                help: 'Signatures attestant de la prise de connaissance des conseils',
                qualityCheck: {
                    text: 'Toutes les signatures clients sont-elles conformes ?',
                    help: 'Signatures distinctes, lisibles, correspondant aux identités',
                    type: 'signature_clients'
                }
            },
             {
                    text: 'Les mentions sont-elles présentes sur le document ?',
                    type: 'boolean',
                    required: true,
                    help: 'Mentions légales obligatoires en bas ou en annexe du document',
                    qualityCheck: {
                        text: 'Les mentions légales sont-elles correctement positionnées et lisibles ?',
                        help: 'Texte complet, pas coupé, police suffisante pour être lu'
                    }
                }
            ]
        },
        18: {
            id: 18,
            name: 'Bon pour accord',
            fullName: 'Bon pour accord',
            questions: [
                {
                    text: 'Est-ce que le document est présent ?',
                    type: 'boolean',
                    required: true,
                    help: 'Vérifiez si le Bon pour accord est présent dans le dossier client',
                    skipIfNo: true
                },
                {
                    text: 'Est-ce qu\'il correspond à la proposition retenue ?',
                    type: 'boolean',
                    required: true,
                    help: 'Vérifiez la cohérence entre le bon pour accord et la proposition finale acceptée',
                    qualityCheck: {
                        text: 'Le contenu correspond-il exactement à la solution retenue ?',
                        help: 'Montants, durée, conditions, garanties identiques à la proposition validée'
                    }
                },
                {
                    text: 'La date est-elle présente sur le document ?',
                    type: 'boolean',
                    required: true,
                    help: 'Date de signature du bon pour accord',
                    qualityCheck: {
                        text: 'La date indiquée est-elle cohérente avec le processus ?',
                        help: 'Date postérieure aux conseils et antérieure à la mise en place du financement'
                    }
                },
                {
                    text: 'La signature de tous les clients est-elle présente ?',
                    type: 'boolean',
                    required: true,
                    help: 'Signatures de tous les emprunteurs et co-emprunteurs',
                    qualityCheck: {
                        text: 'Toutes les signatures clients sont-elles conformes ?',
                        help: 'Signatures distinctes, lisibles, correspondant aux identités des emprunteurs',
                        type: 'signature_clients'
                    }
                }
            ]
        },
        19: {
            id: 19,
            name: 'Déclaration d\'adéquation',
            fullName: 'Déclaration d\'adéquation',
            questions: [
                {
                    text: 'Est-ce que le document est présent ?',
                    type: 'boolean',
                    required: true,
                    help: 'Vérifiez si la Déclaration d\'adéquation est présente dans le dossier client',
                    skipIfNo: true
                },
                {
                    text: 'La date est-elle cohérente avec le bulletin de souscription ?',
                    type: 'boolean',
                    required: true,
                    help: 'La date de la déclaration doit être antérieure ou égale à celle du bulletin de souscription',
                    qualityCheck: {
                        text: 'La chronologie des documents est-elle respectée ?',
                        help: 'Vérifiez que la déclaration d\'adéquation précède bien la souscription'
                    }
                },
                {
                    text: 'Quel est le niveau de risque accepté par le client ?',
                    type: 'risque_niveau',
                    required: true,
                    help: 'Sélectionnez le niveau de risque que le client a déclaré accepter (échelle de 1 à 7)',
                    options: ['1', '2', '3', '4', '5', '6', '7']
                },
                {
                    text: 'Quel est le niveau de risque de la proposition ?',
                    type: 'risque_niveau',
                    required: true,
                    help: 'Sélectionnez le niveau de risque de la solution proposée au client (échelle de 1 à 7)',
                    options: ['1', '2', '3', '4', '5', '6', '7'],
                    qualityCheck: {
                        text: 'Le niveau de risque de la proposition est-il cohérent avec celui accepté par le client ?',
                        help: 'Le risque de la proposition ne doit pas dépasser significativement le niveau accepté par le client',
                        type: 'risque_coherence'
                    }
                },
                {
                    text: 'Les montants brut/net et les frais (% et €) sont-ils présents ?',
                    type: 'boolean',
                    required: true,
                    help: 'Vérifiez la présence des montants bruts, nets et détail des frais en pourcentage et en euros',
                    qualityCheck: {
                        text: 'Tous les éléments financiers sont-ils clairement détaillés ?',
                        help: 'Montant brut, net, frais en % et en €, impact sur la performance'
                    }
                },
                {
                    text: 'Le tableau performance et frais des supports est-il présent et complet ?',
                    type: 'boolean',
                    required: true,
                    help: 'Vérifiez la présence et l\'exhaustivité du tableau détaillant les performances et frais de chaque support',
                    qualityCheck: {
                        text: 'Le tableau contient-il toutes les informations obligatoires ?',
                        help: 'Performances historiques, frais de gestion, frais d\'entrée/sortie pour chaque support'
                    }
                },
                {
                    text: 'Le client connaissait-il tous les produits proposés ?',
                    type: 'boolean',
                    required: true,
                    help: 'Vérifiez si le client avait une connaissance préalable de tous les produits de la proposition',
                    followUp: {
                        condition: 'Non',
                        question: {
                            text: 'Le document d\'évolution des connaissances produits a-t-il été rempli et signé ?',
                            type: 'boolean',
                            required: true,
                            help: 'Vérifiez que le document de formation/information sur les nouveaux produits est complété (cases cochées) et signé par le client',
                            qualityCheck: {
                                text: 'Le document de formation est-il complet et correctement signé ?',
                                help: 'Toutes les cases de formation cochées, signature client présente avec date'
                            }
                        }
                    }
                },
                {
                    text: 'Le profil ESG a-t-il été respecté ?',
                    type: 'esg_respect',
                    required: true,
                    help: 'Vérifiez si la proposition respecte les préférences ESG du client',
                    options: ['Oui', 'Non', 'Partiellement']
                },
                {
                    text: 'Tous les DICI (Documents d\'Information Clés pour l\'Investisseur) sont-ils présents ?',
                    type: 'boolean',
                    required: true,
                    help: 'Vérifiez la présence de tous les DICI correspondant aux supports proposés',
                    qualityCheck: {
                        text: 'Les DICI correspondent-ils exactement aux supports proposés ?',
                        help: 'Un DICI par support, versions à jour, informations cohérentes'
                    }
                },
                {
                    text: 'Pour les signatures manuscrites uniquement : tous les DICI sont-ils paraphés par le client ?',
                    type: 'boolean',
                    required: true,
                    help: 'Si la déclaration d\'adéquation est signée manuellement, vérifiez que chaque DICI joint porte les initiales (paraphe) du client. Répondez "N/C" si c\'est une signature électronique.',
                    qualityCheck: {
                        text: 'Le paraphe manuscrit est-il présent et lisible sur chaque DICI ?',
                        help: 'Vérifiez que les initiales sont cohérentes, lisibles et correspondent bien à l\'identité du client signataire'
                    }
                },
                {
                    text: 'La signature du conseiller est-elle présente ?',
                    type: 'boolean',
                    required: true,
                    help: 'Signature du conseiller validant l\'adéquation de la proposition',
                    qualityCheck: {
                        text: 'La signature du conseiller est-elle conforme ?',
                        help: 'Manuscrite lisible OU DocuSign certifiée, nom correct, bien datée',
                        type: 'signature_conseiller'
                    }
                },
                {
                    text: 'La signature de tous les clients est-elle présente ?',
                    type: 'boolean',
                    required: true,
                    help: 'Signatures de tous les clients confirmant avoir pris connaissance de l\'adéquation',
                    qualityCheck: {
                        text: 'Toutes les signatures clients sont-elles conformes ?',
                        help: 'Signatures distinctes, lisibles, correspondant aux identités',
                        type: 'signature_clients'
                    }
                }
            ]
        },
        20: {
            id: 20,
            name: 'Bulletin de souscription',
            fullName: 'Bulletin de souscription',
            questions: [
                {
                    text: 'Est-ce que le document est présent ?',
                    type: 'boolean',
                    required: true,
                    help: 'Vérifiez si le Bulletin de souscription est présent dans le dossier client',
                    skipIfNo: true
                },
                {
                    text: 'La date est-elle cohérente avec la déclaration d\'adéquation ?',
                    type: 'boolean',
                    required: true,
                    help: 'La date du bulletin de souscription doit être postérieure ou égale à celle de la déclaration d\'adéquation',
                    qualityCheck: {
                        text: 'La chronologie des documents est-elle respectée ?',
                        help: 'Vérifiez que le bulletin de souscription suit bien la déclaration d\'adéquation'
                    }
                },
                {
                    text: 'Le niveau de risque mentionné correspond-il à celui de la déclaration d\'adéquation ?',
                    type: 'boolean',
                    required: true,
                    help: 'Vérifiez la cohérence entre le niveau de risque du bulletin et celui validé dans la déclaration d\'adéquation',
                    qualityCheck: {
                        text: 'Le niveau de risque est-il identique dans les deux documents ?',
                        help: 'Aucun écart entre déclaration d\'adéquation et bulletin de souscription'
                    }
                },
                {
                    text: 'Les montants de souscription correspondent-ils à ceux de la déclaration d\'adéquation ?',
                    type: 'boolean',
                    required: true,
                    help: 'Vérifiez la cohérence des montants entre les deux documents',
                    qualityCheck: {
                        text: 'Les montants sont-ils identiques ou justifiés si différents ?',
                        help: 'Montants identiques ou écart documenté et justifié'
                    }
                },
                {
                    text: 'Les supports sélectionnés correspondent-ils exactement à ceux de la déclaration d\'adéquation ?',
                    type: 'boolean',
                    required: true,
                    help: 'Vérifiez que les supports choisis dans le bulletin correspondent à la proposition validée',
                    qualityCheck: {
                        text: 'La répartition des supports est-elle conforme à la déclaration ?',
                        help: 'Supports identiques, répartition respectée, pas de modification non autorisée'
                    }
                },
                {
                    text: 'Les frais mentionnés sont-ils détaillés et cohérents ?',
                    type: 'boolean',
                    required: true,
                    help: 'Vérifiez la présence et la cohérence des frais (entrée, gestion, arbitrage) avec la déclaration d\'adéquation',
                    qualityCheck: {
                        text: 'Tous les frais sont-ils clairement indiqués et cohérents ?',
                        help: 'Frais d\'entrée, de gestion, d\'arbitrage détaillés en % et en € si applicable'
                    }
                },
                {
                    text: 'Les modalités de versement sont-elles clairement indiquées ?',
                    type: 'boolean',
                    required: true,
                    help: 'Vérifiez la présence des modalités : montant, périodicité, mode de prélèvement',
                    qualityCheck: {
                        text: 'Les modalités de versement sont-elles complètes et précises ?',
                        help: 'Montant initial, versements programmés, coordonnées bancaires, dates'
                    }
                },
                {
                    text: 'Les bénéficiaires sont-ils correctement désignés ?',
                    type: 'boolean',
                    required: true,
                    help: 'Vérifiez la désignation des bénéficiaires en cas de décès (contrats d\'assurance vie)',
                    qualityCheck: {
                        text: 'La clause bénéficiaire est-elle claire et conforme aux souhaits du client ?',
                        help: 'Bénéficiaires nommément désignés ou clause type, hiérarchie respectée'
                    }
                },
                {
                    text: 'Le délai de rétractation est-il mentionné ?',
                    type: 'boolean',
                    required: true,
                    help: 'Vérifiez la présence de l\'information sur le délai de rétractation légal',
                    qualityCheck: {
                        text: 'L\'information sur la rétractation est-elle complète et conforme ?',
                        help: 'Délai de 14 jours calendaires, modalités d\'exercice, conséquences'
                    }
                },
                {
                    text: 'Toutes les mentions légales obligatoires sont-elles présentes ?',
                    type: 'boolean',
                    required: true,
                    help: 'Vérifiez la présence de toutes les mentions réglementaires obligatoires',
                    qualityCheck: {
                        text: 'Les mentions légales sont-elles complètes et à jour ?',
                        help: 'Mentions CNIL, médiateur, autorités de contrôle, garanties, fiscalité'
                    }
                },
                {
                    text: 'La signature du conseiller est-elle présente ?',
                    type: 'boolean',
                    required: true,
                    help: 'Signature du conseiller attestant de la conformité du bulletin',
                    qualityCheck: {
                        text: 'La signature du conseiller est-elle conforme ?',
                        help: 'Manuscrite lisible OU DocuSign certifiée, nom correct, bien datée',
                        type: 'signature_conseiller'
                    }
                },
                {
                    text: 'La signature de tous les clients est-elle présente ?',
                    type: 'boolean',
                    required: true,
                    help: 'Signatures de tous les souscripteurs confirmant leur engagement',
                    qualityCheck: {
                        text: 'Toutes les signatures clients sont-elles conformes ?',
                        help: 'Signatures distinctes, lisibles, correspondant aux identités des souscripteurs',
                        type: 'signature_clients'
                    }
                }
            ]
        },
        21: {
            id: 21,
            name: 'Harvest',
            fullName: 'Saisie des informations client dans Harvest',
            questions: [
                {
                    text: 'Le dossier client a-t-il été créé sous Harvest ?',
                    type: 'boolean',
                    required: true,
                    help: 'Vérifiez si le dossier client existe et est accessible dans Harvest',
                    skipIfNo: true
                },
                {
                    text: 'Le dossier a-t-il été complété (ou mis à jour) ?',
                    type: 'boolean',
                    required: true,
                    help: 'Vérifiez si les informations du dossier client sont complètes et à jour dans Harvest',
                    qualityCheck: {
                        text: 'Le niveau de complétude est-il suffisant pour ce type de contrôle ?',
                        help: 'Évaluez si les informations présentes permettent de mener le contrôle de manière satisfaisante'
                    }
                },
                {
                    text: 'Des éléments sont-ils manquants ou incomplets dans Harvest ?',
                    type: 'boolean',
                    required: true,
                    help: 'Vérifiez s\'il manque des informations essentielles ou si certaines sont incomplètes',
                    followUp: {
                        condition: 'Oui',
                        question: {
                            text: 'Quels éléments de la page 1 d\'Harvest sont manquants ou incomplets ?',
                            type: 'checklist',
                            required: true,
                            help: 'Cochez tous les éléments manquants ou incomplets de la page principale d\'Harvest',
                            options: [
                                'N° Client',
                                'US Person',
                                'Résidence Fiscale',
                                'Profession',
                                'Mots Clefs',
                                'Age du départ en retraite',
                                'Tranche de revenus',
                                'Tranche de Patrimoine',
                                'Origine du patrimoine'
                            ]
                        }
                    }
                },
                {
                    text: 'D\'autres informations détaillées sont-elles manquantes ou incomplètes ?',
                    type: 'checklist',
                    required: true,
                    help: 'Sélectionnez les catégories d\'informations qui nécessitent des précisions complémentaires',
                    options: [
                        'Revenus (détails manquants)',
                        'Patrimoine (détails manquants)', 
                        'Charges (détails manquants)',
                        'Immobilier (détails manquants)'
                    ],
                    // Note: followUp conditionnel basé sur checklist sera géré dans la logique du contrôleur
                },
                {
                    text: 'Précisez les informations manquantes pour les catégories sélectionnées ci-dessus',
                    type: 'text',
                    required: false,
                    help: 'Détaillez les informations spécifiques manquantes pour chaque catégorie cochée (ex: montant des revenus locatifs, détail du patrimoine immobilier, etc.)',
                    showOnlyIf: {
                        questionIndex: 3, // Question précédente (checklist détaillée)
                        answer: 'has_selection' // Condition spéciale pour checklist non vide
                    }
                },
                {
                    text: 'L\'onglet Conformité est-il complété ?',
                    type: 'boolean',
                    required: true,
                    help: 'Vérifiez que l\'onglet conformité dans Harvest contient toutes les informations requises',
                    qualityCheck: {
                        text: 'L\'onglet conformité est-il complet et à jour ?',
                        help: 'Vérifiez que toutes les sections de conformité sont renseignées avec des informations récentes'
                    }
                },
                {
                    text: 'Un profil investisseur est-il renseigné ?',
                    type: 'boolean',
                    required: true,
                    help: 'Vérifiez la présence d\'un profil investisseur dans Harvest',
                    followUp: {
                        condition: 'Oui',
                        question: {
                            text: 'Le profil investisseur est-il conforme (version) et daté de moins de 24 mois ?',
                            type: 'boolean',
                            required: true,
                            help: 'Vérifiez que le profil investisseur utilise la bonne version et est daté de moins de 24 mois',
                            qualityCheck: {
                                text: 'Le profil investisseur respecte-t-il les exigences de conformité temporelle ?',
                                help: 'Vérifiez la cohérence temporelle et la validité de la version utilisée'
                            }
                        }
                    }
                },
                {
                    text: 'Le profil complété correspond-il au questionnaire signé par le client ?',
                    type: 'boolean',
                    required: true,
                    help: 'Vérifiez la cohérence entre le profil dans Harvest et le questionnaire signé par le client'
                },
                {
                    text: 'Quelle est l\'origine du profil investisseur ?',
                    type: 'profile_origin',
                    required: true,
                    help: 'Indiquez si le profil provient d\'un questionnaire papier ou électronique',
                    options: ['Papier', 'Electronique'],
                    showOnlyIf: {
                        questionIndex: 7, // Question précédente (Le profil complété correspond-il...)
                        answer: 'Oui'
                    }
                },
                {
                    text: 'Au moins 1 objectif est-il renseigné ?',
                    type: 'boolean',
                    required: true,
                    help: 'Vérifiez qu\'au moins un objectif de placement est défini pour le client dans Harvest',
                    qualityCheck: {
                        text: 'L\'objectif défini est-il cohérent avec le profil client ?',
                        help: 'L\'objectif doit correspondre à l\'âge, la situation et les besoins exprimés du client'
                    }
                },
                {
                    text: 'L\'objectif défini est-il identique à celui(ceux) indiqué(s) dans la FR ?',
                    type: 'boolean',
                    required: true,
                    help: 'Vérifiez la cohérence entre l\'objectif dans Harvest et celui mentionné dans la Fiche de Renseignements',
                    qualityCheck: {
                        text: 'Y a-t-il une parfaite correspondance entre les objectifs FR et Harvest ?',
                        help: 'Les objectifs doivent être strictement identiques entre les deux documents'
                    }
                },
                {
                    text: 'L\'objectif défini est-il cohérent avec le profil du client ?',
                    type: 'boolean',
                    required: true,
                    help: 'Évaluez si l\'objectif de placement correspond bien au profil de risque et à la situation du client',
                    qualityCheck: {
                        text: 'L\'adéquation objectif/profil client est-elle appropriée ?',
                        help: 'Vérifiez que l\'objectif est réaliste par rapport à l\'âge, l\'horizon d\'investissement et la capacité de risque'
                    }
                },
                {
                    text: 'Le niveau de Vigilance client a-t-il été déterminé ?',
                    type: 'boolean',
                    required: true,
                    help: 'Vérifiez que le niveau de vigilance LCB-FT a été évalué et documenté dans Harvest',
                    qualityCheck: {
                        text: 'Le niveau de vigilance attribué est-il approprié au profil client ?',
                        help: 'Vérifiez que le niveau de vigilance correspond aux facteurs de risque identifiés'
                    }
                },
                {
                    text: 'La date de la Vigilance Client est-elle présente ?',
                    type: 'boolean',
                    required: true,
                    help: 'Vérifiez la présence de la date de réalisation de la vigilance client',
                    qualityCheck: {
                        text: 'Cette date est-elle conforme (correspond-elle au RDV client ou a-t-elle été réalisée après) ?',
                        help: 'La vigilance doit être réalisée lors du rendez-vous client ou dans un délai raisonnable après'
                    }
                }
            ]
        },
            22: {
            id: 22,
            name: 'FR + Profil Risques (opération)',
            fullName: 'Mise à jour FR et Profil Risques pour opération client existant',
            questions: [
                {
                    text: 'Est-ce qu\'il y a une FR ?',
                    type: 'boolean',
                    required: true,
                    help: 'Vérifiez si une Fiche de Renseignements est présente dans le dossier client'
                    // Pas de skipIfNo - on continue toujours vers les autres questions
                },
                {
                    text: 'Y a-t-il eu une mise à jour de la FR dans les 24 derniers mois ?',
                    type: 'boolean',
                    required: true,
                    help: 'Vérifiez si la FR a été mise à jour dans les 24 mois précédant la date du contrôle',
                    showOnlyIf: {
                        questionIndex: 0, // Question précédente (présence FR)
                        answer: 'Oui'
                    },
                    qualityCheck: {
                        text: 'La date de mise à jour respecte-t-elle le délai de 24 mois ?',
                        help: 'Calculez la différence entre la date de mise à jour et la date du contrôle'
                    }
                },
                {
                    text: 'La FR mise à jour est-elle signée par le client ?',
                    type: 'boolean',
                    required: true,
                    help: 'Vérifiez la présence de la signature du client sur la FR mise à jour ou récente',
                    showOnlyIf: {
                        questionIndex: 0, // Question sur présence FR
                        answer: 'Oui'
                    },
                    qualityCheck: {
                        text: 'La signature du client sur la FR est-elle conforme ?',
                        help: 'Signature lisible, datée et correspondant à l\'identité du client',
                        type: 'signature_clients'
                    }
                },
                {
                    text: 'Est-ce qu\'il y a un profil investisseur ?',
                    type: 'boolean',
                    required: true,
                    help: 'Vérifiez si un profil investisseur/profil de risques est présent dans le dossier client',
                    skipIfNo: true // Si pas de profil, terminer le contrôle de ce document
                },
                {
                    text: 'Y a-t-il eu une mise à jour du profil investisseur dans les 24 derniers mois ?',
                    type: 'boolean',
                    required: true,
                    help: 'Vérifiez si le profil investisseur a été mis à jour dans les 24 mois précédant la date du contrôle',
                    qualityCheck: {
                        text: 'La date de mise à jour respecte-t-elle le délai de 24 mois ?',
                        help: 'Calculez la différence entre la date de mise à jour et la date du contrôle'
                    }
                },
                {
                    text: 'Le profil investisseur mis à jour est-il signé par le client ?',
                    type: 'boolean',
                    required: true,
                    help: 'Vérifiez la présence de la signature du client sur le profil investisseur mis à jour ou récent',
                    qualityCheck: {
                        text: 'La signature du client sur le profil investisseur est-elle conforme ?',
                        help: 'Signature lisible, datée et correspondant à l\'identité du client',
                        type: 'signature_clients'
                    }
                }
            ]
        },
            23: {
            id: 23,
            name: 'Carton de signature',
            fullName: 'Carton de signature client',
            questions: [
                {
                    text: 'Est-ce que le document est présent ?',
                    type: 'boolean',
                    required: true,
                    help: 'Vérifiez si le Carton de signature est présent dans le dossier client (document optionnel)',
                    skipIfNo: true,
                    skipIfNC: true
                },
                {
                    text: 'Les signatures de référence sont-elles présentes ?',
                    type: 'boolean',
                    required: true,
                    help: 'Vérifiez que les signatures de référence du client sont bien apposées sur le carton',
                    qualityCheck: {
                        text: 'Les signatures de référence sont-elles lisibles et exploitables ?',
                        help: 'Signatures nettes, complètes, suffisamment contrastées pour servir de référence'
                    }
                },
                {
                    text: 'Le carton correspond-il au(x) titulaire(s) du dossier ?',
                    type: 'boolean',
                    required: true,
                    help: 'Vérifiez que l\'identité mentionnée correspond aux clients du dossier en cours'
                },
                {
                    text: 'Y a-t-il une date sur le carton de signature ?',
                    type: 'boolean',
                    required: true,
                    help: 'Présence d\'une date de création ou de mise à jour du carton',
                    qualityCheck: {
                        text: 'La date est-elle cohérente avec l\'ouverture du dossier ?',
                        help: 'Date logique par rapport à la chronologie du dossier client'
                    }
                }
            ]
        },
            24: {
            id: 24,
            name: 'LM Entrée en Relation',
            fullName: 'Lettre de Mission d\'Entrée en Relation',
            questions: [
                {
                    text: 'Est-ce que le document est présent ?',
                    type: 'boolean',
                    required: true,
                    help: 'Vérifiez si la Lettre de Mission d\'Entrée en Relation est présente dans le dossier client',
                    skipIfNo: true
                },
                {
                    text: 'Quel est le type de document ?',
                    type: 'document_type',
                    required: true,
                    help: 'Lettre de mission papier signée ou accord électronique',
                    options: ['Electronique', 'Papier']
                },
                {
                    text: 'Est-ce que le document est entièrement complété ?',
                    type: 'boolean',
                    required: true,
                    excludeFor: ['MIS_A_JOUR'],
                    help: 'Toutes les sections renseignées : services, modalités, conditions d\'entrée en relation',
                    qualityCheck: {
                        text: 'Les modalités d\'entrée en relation sont-elles clairement définies ?',
                        help: 'Services détaillés, conditions précisées, modalités de contact établies'
                    }
                },
                {
                    text: 'La date est-elle présente sur le document ?',
                    type: 'boolean',
                    required: true,
                    help: 'Date d\'entrée en relation et de prise d\'effet de la lettre de mission',
                    qualityCheck: {
                        text: 'La date de la lettre de mission est-elle cohérente avec le dossier ?',
                        help: 'Date de signature postérieure à l\'ouverture de compte et aux premiers échanges'
                    }
                },
                {
                    text: 'Le document a-t-il été régularisé lors de la mise à jour ?',
                    type: 'boolean',
                    required: true,
                    showOnlyFor: ['MIS_A_JOUR'],
                    help: 'Vérifiez si la lettre de mission d\'entrée en relation a été mise à jour/régularisée dans le cadre de la mise à jour du dossier client',
                    followUp: {
                        condition: 'Non',
                        question: {
                            text: 'Cette absence de régularisation pose-t-elle un problème pour le dossier ?',
                            type: 'boolean',
                            required: true,
                            help: 'Évaluer l\'impact de l\'absence de régularisation sur la conformité du dossier',
                            qualityCheck: {
                                text: 'L\'absence de régularisation constitue-t-elle une anomalie réglementaire ?',
                                help: 'Considérer l\'évolution du profil client et les obligations de mise à jour'
                            }
                        }
                    }
                },
                {
                    text: 'La signature du conseiller est-elle présente ?',
                    type: 'boolean',
                    required: true,
                    help: 'Engagement du conseiller sur les services d\'entrée en relation proposés',
                    qualityCheck: {
                        text: 'Le conseiller atteste-t-il de sa capacité à accompagner l\'entrée en relation ?',
                        help: 'Signature avec confirmation des compétences et habilitations',
                        type: 'signature_conseiller'
                    }
                },
                {
                    text: 'La signature de tous les clients est-elle présente ?',
                    type: 'boolean',
                    required: true,
                    help: 'Acceptation formelle de l\'entrée en relation par le client',
                    qualityCheck: {
                        text: 'Le client confirme-t-il son acceptation des conditions d\'entrée en relation ?',
                        help: 'Signature avec acceptation explicite des modalités et de l\'accompagnement',
                        type: 'signature_clients'
                    }
                }
            ]
        },
            99: {
                id: 99,
                name: 'Zeendoc',
                fullName: 'Archivage Zeendoc',
                skipIfNC : true,
                questions: [
                    {
                        text: 'Tous les documents sont-ils bien ajoutés dans Zeendoc ?',
                        type: 'boolean',
                        required: true,
                        help: 'Vérifiez si tous les documents nécessaires au contrôle sont présents et correctement archivés dans Zeendoc',
                        qualityCheck: {
                            text: 'L\'archivage est-il complet et organisé ?',
                            help: 'Vérifiez que tous les documents sont classés, lisibles et correctement nommés'
                        }
                    },
                    {
                        text: 'Quels documents sont manquants dans Zeendoc ?',
                        type: 'checklist',
                        required: true,
                        help: 'Cochez tous les documents qui sont absents ou manquants dans l\'archivage Zeendoc. Si TOUS les documents sont présents, ne cochez rien (checklist vide = aucun document manquant).',
                        showOnlyIf: {
                            questionIndex: 0, // Question précédente (index 0)
                            answer: 'Non'
                        },
                        options: [
                            'FR - Fiche de Renseignements',
                            'Profil Risques (incluant ESG)',
                            'Cartographie Client',
                            'FIL - Fiche d\'Information Légale',
                            'Lettre de Mission d\'entrée en relation',
                            'Lettre de mission d\'opération',
                            'CNI - Carte Nationale d\'Identité',
                            'Justificatif de domicile',
                            'Etude - Etude Financière Client',
                            'RIB - Relevé d\'Identité Bancaire',
                            'Convention RTO - Convention de Réception et Transmission d\'Ordres',
                            'Origine des fonds - Déclaration et Justification de l\'Origine des Fonds',
                            'Cartographie et Suivi des Opérations',
                            'Destination des fonds (Rachats)',
                            'Mandat de financement',
                            'Synthèse + Adéquation',
                            'Fiche conseil',
                            'Bon pour accord',
                            'Déclaration d\'adéquation',
                            'Bulletin de souscription'
                        ]
                    },
                    {
                        text: 'Les documents disponibles dans Zeendoc sont-ils suffisants pour ce type de contrôle ?',
                        type: 'boolean',
                        required: true,
                        help: 'Évaluez si les documents présents dans Zeendoc (qu\'il y en ait beaucoup ou peu) permettent de mener le contrôle de manière satisfaisante pour ce type spécifique de contrôle'
                    },
                    {
                        text: 'Les documents présents sont-ils affectés au bon client dans Zeendoc ?',
                        type: 'boolean',
                        required: true,
                        help: 'Vérifiez que les documents présents dans Zeendoc sont correctement rattachés au dossier client',
                        qualityCheck: {
                            text: 'L\'affectation client est-elle correcte et cohérente ?',
                            help: 'Nom, prénom, numéro de dossier correspondent au client contrôlé'
                        }
                    }
                ]
            }
        };
    }

    // Le reste des méthodes reste identique...
    setupEventListeners() {
        window.addEventListener('startDocumentControl', (e) => {
            this.startDocumentControl(e.detail.dossier, e.detail.control);
        });
        
        // Initialiser les vérifications périodiques
        this.initializePeriodicChecks();
    }

    startDocumentControl(dossier, control) {
        Utils.debugLog('=== DÉBUT CONTRÔLE DOCUMENTAIRE ===');
        Utils.debugLog(`Dossier: ${dossier.client}`);
        Utils.debugLog(`Type de contrôle: ${control.type}`);

        this.currentDossier = dossier;
        this.currentControl = control;
        this.isResumingControl = false;
        
        // Vérifier s'il existe un contrôle suspendu pour ce dossier/type
        const dossierKey = this.generateDossierKey(dossier);
        const suspendedControl = window.persistenceManager?.getSuspendedControl(dossierKey, control.type);
        
        if (suspendedControl) {
            this.showResumeControlDialog(suspendedControl);
            return;
        }
        
        this.initializeNewControl(control.type);
        this.showDocumentControlInterface();
    }

    initializeDocumentsForControl(controlType) {
        let requiredDocuments;
    
        if (controlType === 'OPERATION') {
            // Utiliser la logique conditionnelle pour les opérations
            requiredDocuments = this.determineOperationDocuments(this.currentDossier);
            Utils.debugLog(`Documents sélectionnés pour l'opération: ${requiredDocuments.join(', ')}`);
        } else {
            // Pour les autres contrôles, utiliser la méthode standard
            requiredDocuments = this.getRequiredDocuments(controlType);
        }
        
        this.documentsState = {};
        this.documentResponses = {};
        
        requiredDocuments.forEach(docId => {
            // Vérifier que la configuration du document existe
            if (this.documentsConfig[docId]) {
                this.documentsState[docId] = {
                    id: docId,
                    status: 'pending',
                    responses: {},
                    completedQuestions: 0,
                    totalQuestions: this.documentsConfig[docId].questions.length
                };
                this.documentResponses[docId] = {};
            } else {
                Utils.debugLog(`Attention: Configuration manquante pour le document ${docId}`);
            }
        });

        Utils.debugLog(`Documents initialisés pour ${controlType}: ${requiredDocuments.join(', ')}`);
    }

    // MODIFICATION : Gestion du skip si document absent
    moveToNextQuestion() {
        const docConfig = this.documentsConfig[this.currentDocument];
        const questions = docConfig.questions;
        const currentQuestion = questions[this.currentQuestionIndex];
        
        // Vérifier si on doit passer toutes les questions suivantes (document absent)
        if (currentQuestion.skipIfNo || currentQuestion.skipIfNC) {
            const lastResponse = this.documentResponses[this.currentDocument][this.currentQuestionIndex];
            if (lastResponse) {
                // Document absent (skipIfNo)
                if (currentQuestion.skipIfNo && lastResponse.answer === 'Non') {
                    this.completeDocument();
                    return;
                }
                // Document non concerné (skipIfNC) - NOUVEAU
                if (currentQuestion.skipIfNC && lastResponse.answer === 'NC') {
                    this.completeDocument();
                    return;
                }
            }
        }
        
        // Vérifier s'il y a une question de suivi à injecter
        if (currentQuestion.followUp) {
            const lastResponse = this.documentResponses[this.currentDocument][this.currentQuestionIndex];
            
            if (lastResponse && lastResponse.answer === currentQuestion.followUp.condition) {
                // Injecter la question de suivi
                const followUpQuestion = {...currentQuestion.followUp.question};
                followUpQuestion.isFollowUp = true;
                followUpQuestion.parentQuestionIndex = this.currentQuestionIndex;
                
                // Insérer la question de suivi après la question actuelle
                questions.splice(this.currentQuestionIndex + 1, 0, followUpQuestion);
                
                // Mettre à jour le nombre total de questions pour ce document
                this.documentsState[this.currentDocument].totalQuestions = questions.length;
            }
        }

            if (this.currentQuestionIndex < questions.length - 1) {
            this.currentQuestionIndex++;
            
            // NOUVEAU : Vérifier si la question suivante doit être affichée conditionnellement
            const nextQuestion = questions[this.currentQuestionIndex];
            if (nextQuestion.showOnlyIf) {
                const shouldShow = this.shouldShowConditionalQuestion(nextQuestion.showOnlyIf);
                if (!shouldShow) {
                    // Passer à la question suivante récursivement
                    this.moveToNextQuestion();
                    return;
                }
            }
            
            this.updateQuestionInterface();
        } else {
            this.completeDocument();
        }
    }

    // AJOUTER cette méthode dans documentController.js
    generateControlDetails() {
        const details = [];
        
        Object.entries(this.documentResponses).forEach(([docId, docResponses]) => {
            const docConfig = this.documentsConfig[docId];
            
            Object.values(docResponses).forEach(response => {
                details.push({
                    document: docConfig?.name || `Document ${docId}`,
                    question: response.question,
                    reponse: response.answer,
                    qualite: response.quality || '',
                    justification: response.justification || '',
                    conforme: response.conforme !== false, // Utilise la logique existante
                    obligatoire: response.obligation === 'Obligatoire'
                });
            });
        });
        
        return details;
    }

    // NOUVELLE méthode pour vérifier si une question conditionnelle doit être affichée
    shouldShowConditionalQuestion(condition) {
        const { questionIndex, answer, answerIn } = condition;
        const targetResponse = this.documentResponses[this.currentDocument][this.currentQuestionIndex + questionIndex];
        
        if (!targetResponse) return false;
    
        if (answerIn) {
            return answerIn.includes(targetResponse.answer);
        }
        
        if (answer === 'has_selection') {
            return targetResponse.missingElements && targetResponse.missingElements.length > 0;
        }
        
        return targetResponse.answer === answer;
    }
    
    // Méthode utilitaire pour récupérer les informations des documents (mise à jour avec Harvest)
    getDocumentName(docId) {
        const documentNames = {
            1: 'FR',
            2: 'Profil Risques',
            4: 'Carto Client',
            5: 'FIL',
            6: 'Lettre de Mission',
            7: 'CNI',
            8: 'Justificatif Domicile',
            9: 'Etude',
            10: 'RIB',
            11: 'Convention RTO',
            12: 'Origine des fonds',
            13: 'Carto Opération',
            14: 'Destination des fonds',
            15: 'Mandat de financ.',
            16: 'Synthèse + Adéq.',
            17: 'Fiche conseil',    
            18: 'Bon pour accord',
            19: 'Déclaration d\'adéquation',
            20: 'Bulletin de souscription',
            21: 'Harvest',
            22: 'FR + Profil Risques (opération)' ,
            23: 'Carton de signature',
            24: 'LM Entrée en Relation',
            99: 'Zeendoc'
        };
        return documentNames[docId] || `Document ${docId}`;
    }

    // Les autres méthodes restent identiques - je les ajoute pour completeness
    showDocumentControlInterface() {
        Utils.showSection('document-control-section');
        this.updateDocumentControlInterface();
    }

    updateDocumentControlInterface() {
        const section = document.getElementById('document-control-section');
        if (!section) return;

        const titleEl = section.querySelector('.section-title');
        if (titleEl) {
            const titleText = this.isRevisionMode ? 
                `Révision Contrôle (C2R) - ${this.currentControl.definition.name}` :
                `Contrôle Documentaire - ${this.currentControl.definition.name}`;
            titleEl.textContent = titleText;
        }

        // NOUVEAU : Ajouter un indicateur de mode révision
        if (this.isRevisionMode) {
            const existingBanner = section.querySelector('.revision-banner');
            if (!existingBanner) {
                const revisionBanner = document.createElement('div');
                revisionBanner.className = 'revision-banner';
                revisionBanner.innerHTML = `
                    <div style="
                        background: linear-gradient(135deg, #fff3cd 0%, #ffeaa7 100%);
                        border: 2px solid #ffc107;
                        border-radius: 12px;
                        padding: 15px;
                        margin: 20px 0;
                        text-align: center;
                    ">
                        <h4 style="margin: 0 0 10px 0; color: #856404;">
                            🔄 MODE RÉVISION ACTIVÉ
                        </h4>
                        <p style="margin: 0; color: #856404;">
                            Vous révisez un contrôle existant. Les réponses sont pré-remplies.
                            <br><strong>Modifications détectées : <span id="modification-count">${this.modifiedFields.size}</span></strong>
                        </p>
                    </div>
                `;
                section.insertBefore(revisionBanner, section.querySelector('.dossier-info'));
            } else {
                // Mettre à jour le compteur de modifications
                const countSpan = existingBanner.querySelector('#modification-count');
                if (countSpan) {
                    countSpan.textContent = this.modifiedFields.size;
                }
            }
        }

        this.updateDossierInfo();
        this.updateDocumentsGrid();
        this.updateControlButtons();
    }

    updateDossierInfo() {
        const infoContainer = document.getElementById('dossier-info');
        if (!infoContainer) return;

        // Récupérer les statuts de contrôle pour ce dossier
        const dossierStatuses = this.getDossierStatuses(this.currentDossier);
        const statusBadges = this.generateStatusBadges(dossierStatuses);
        
        // Extraire le contexte d'opération si applicable
        const operationContext = this.getOperationContext();

        infoContainer.innerHTML = `
            <div class="dossier-info-card">
                <div class="dossier-info-header">
                    <h3>📋 Informations du dossier en contrôle</h3>
                    ${statusBadges ? `<div class="status-badges">${statusBadges}</div>` : ''}
                </div>
                
                <div class="dossier-info-body">
                    <!-- Section Client Principal -->
                    <div class="info-section client-section">
                        <h4>👤 Informations Client</h4>
                        <div class="dossier-details">
                            <div class="detail-item client">
                                <span class="label">Nom client</span>
                                <span class="value primary">${this.currentDossier.client || 'Non spécifié'}</span>
                            </div>
                            
                            <div class="detail-item reference">
                                <span class="label">Référence</span>
                                <span class="value">${this.currentDossier.reference || 'Non renseigné'}</span>
                            </div>
                            
                            <div class="detail-item nouveau-client">
                                <span class="label">Nouveau client</span>
                                <span class="value ${this.getBadgeClass(this.currentDossier.nouveauClient)}">
                                    ${this.currentDossier.nouveauClient || 'Non renseigné'}
                                    ${this.currentDossier.nouveauClient?.toLowerCase() === 'oui' ? ' ⭐' : ''}
                                </span>
                            </div>
                            
                            <div class="detail-item ppe">
                                <span class="label">PPE</span>
                                <span class="value ${this.getPPEClass(this.currentDossier.ppe)}">
                                    ${this.currentDossier.ppe || 'Non renseigné'}
                                    ${this.currentDossier.ppe?.toLowerCase() === 'oui' ? ' 🔒' : ''}
                                </span>
                            </div>
                        </div>
                    </div>

                    <!-- Section Dossier -->
                    <div class="info-section dossier-section">
                        <h4>📁 Informations Dossier</h4>
                        <div class="dossier-details">
                            <div class="detail-item code">
                                <span class="label">Code dossier</span>
                                <span class="value code">${this.currentDossier.codeDossier || 'Non renseigné'}</span>
                            </div>
                            
                            <div class="detail-item domaine">
                                <span class="label">Domaine</span>
                                <span class="value badge ${this.getBadgeClass(this.currentDossier.domaine)}">
                                    ${this.currentDossier.domaine || 'Non renseigné'}
                                </span>
                            </div>
                            
                            <div class="detail-item contrat">
                                <span class="label">Contrat</span>
                                <span class="value">${this.currentDossier.contrat || 'Non renseigné'}</span>
                            </div>
                            
                            <div class="detail-item fournisseur">
                                <span class="label">Fournisseur</span>
                                <span class="value">${this.currentDossier.fournisseur || 'Non renseigné'}</span>
                            </div>
                        </div>
                    </div>

                    <!-- Section Opération -->
                    <div class="info-section operation-section">
                        <h4>💰 Informations Opération</h4>
                        <div class="dossier-details">
                            <div class="detail-item montant">
                                <span class="label">Montant</span>
                                <span class="value montant">${this.formatMontant(this.currentDossier.montant)}</span>
                            </div>
                            
                            <div class="detail-item type-acte">
                                <span class="label">Type d'acte</span>
                                <span class="value">${this.currentDossier.typeActe || 'Non renseigné'}</span>
                            </div>
                            
                            <div class="detail-item etat-bo">
                                <span class="label">État BO</span>
                                <span class="value badge ${this.getEtatBOClass(this.currentDossier.etatBO)}">
                                    ${this.currentDossier.etatBO || 'Non renseigné'}
                                </span>
                            </div>
                            
                            ${operationContext ? `
                            <div class="detail-item operation-type">
                                <span class="label">Type d'opération détecté</span>
                                <span class="value badge ${operationContext.type}">
                                    ${operationContext.type.replace('_', ' ').toUpperCase()}
                                    ${operationContext.isVersement ? '📥' : operationContext.isRachat ? '📤' : '⚙️'}
                                </span>
                            </div>
                            ` : ''}
                        </div>
                    </div>

                    <!-- Section Équipe -->
                    <div class="info-section team-section">
                        <h4>👥 Équipe</h4>
                        <div class="dossier-details">
                            <div class="detail-item conseiller">
                                <span class="label">Conseiller</span>
                                <span class="value">${this.currentDossier.conseiller || 'Non assigné'}</span>
                            </div>
                            
                            <div class="detail-item assistant-bo">
                                <span class="label">Assistant BO</span>
                                <span class="value">${this.currentDossier.assistantBO || 'Non assigné'}</span>
                            </div>
                        </div>
                    </div>

                    <!-- Section Historique si données brutes disponibles -->
                    ${this.currentDossier.rawData ? `
                    <div class="info-section technical-section">
                        <h4>🔧 Informations techniques</h4>
                        <div class="dossier-details">
                            <div class="detail-item raw-data">
                                <span class="label">Données source</span>
                                <span class="value">${this.currentDossier.rawData.length} colonnes Excel</span>
                            </div>
                            
                            <div class="detail-item original-index">
                                <span class="label">Index original</span>
                                <span class="value">${this.currentDossier.originalIndex + 1}</span>
                            </div>
                        </div>
                    </div>
                    ` : ''}
                </div>
            </div>
        `;
    }

    // Méthodes utilitaires pour le formatage et les classes CSS
    formatMontant(montant) {
        if (!montant) return 'Non renseigné';
        
        // Si c'est déjà formaté, on le retourne tel quel
        if (typeof montant === 'string' && montant.includes('€')) {
            return `<strong>${montant}</strong>`;
        }
        
        // Essayer d'extraire un nombre
        const numericValue = this.extractNumericAmount(montant);
        if (numericValue > 0) {
            return `<strong>${numericValue.toLocaleString('fr-FR')} €</strong>`;
        }
        
        return `<strong>${montant}</strong>`;
    }

    getBadgeClass(value) {
        if (!value) return 'neutral';
        
        const lowerValue = value.toLowerCase();
        if (lowerValue === 'oui' || lowerValue === 'yes') return 'oui';
        if (lowerValue === 'non' || lowerValue === 'no') return 'non';
        if (lowerValue === 'nouveau') return 'nouveau';
        if (lowerValue.includes('private') || lowerValue.includes('privé')) return 'private';
        if (lowerValue.includes('corporate') || lowerValue.includes('entreprise')) return 'corporate';
        
        return 'neutral';
    }

    getPPEClass(ppe) {
        if (!ppe) return 'neutral';
        return ppe.toLowerCase() === 'oui' ? 'ppe-yes' : 'ppe-no';
    }

    getEtatBOClass(etat) {
        if (!etat) return 'neutral';
        
        const lowerEtat = etat.toLowerCase();
        if (lowerEtat.includes('validé') || lowerEtat.includes('ok') || lowerEtat.includes('terminé')) return 'success';
        if (lowerEtat.includes('attente') || lowerEtat.includes('pending')) return 'warning';
        if (lowerEtat.includes('erreur') || lowerEtat.includes('rejeté')) return 'error';
        
        return 'neutral';
    }

    extractNumericAmount(montantString) {
        if (!montantString) return 0;
        
        const cleaned = montantString.toString()
            .replace(/[^\d,.-]/g, '')
            .replace(/,/g, '.');
        
        const number = parseFloat(cleaned);
        return isNaN(number) ? 0 : number;
    }

    // Méthodes pour récupérer les statuts et badges (si elles n'existent pas déjà)
    getDossierStatuses(dossier) {
        if (!window.documentController) return {};
        
        const dossierKey = window.documentController.generateDossierKey(dossier);
        const controlTypes = ['LCB-FT', 'FINANCEMENT', 'CARTO_CLIENT', 'OPERATION', 'NOUVEAU_CLIENT', 'ADEQUATION', 'ARBITRAGE'];
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

    getShortControlType(type) {
        const shortNames = {
            'LCB-FT': 'LCB',
            'FINANCEMENT': 'FIN',
            'CARTO_CLIENT': 'CARTO',
            'OPERATION': 'OP',
            'NOUVEAU_CLIENT': 'NC',
            'MIS_A_JOUR': 'MAJ',
            'ADEQUATION': 'ADQ',
            'ARBITRAGE': 'ARB'
        };
        return shortNames[type] || type.substring(0, 3);
    }

    getOperationContext() {
        if (!this.currentDossier || !this.currentControl) return null;
        
        if (this.currentControl.type !== 'OPERATION') return null;
        
        const typeOperation = this.extractOperationType(this.currentDossier);
        const montant = this.currentDossier.montant || '';
        
        return {
            type: typeOperation,
            isVersement: ['versement', 'versement_initial', 'versement_complementaire', 'transfert_entrant'].includes(typeOperation),
            isRachat: ['rachat', 'rachat_partiel', 'rachat_total', 'transfert_sortant', 'avance'].includes(typeOperation),
            isArbitrage: typeOperation === 'arbitrage',
            montant: montant,
            needsOriginFunds: ['versement', 'versement_initial', 'versement_complementaire', 'transfert_entrant'].includes(typeOperation),
            needsDestinationFunds: ['rachat', 'rachat_partiel', 'rachat_total', 'transfert_sortant', 'avance'].includes(typeOperation)
        };
    }

    extractOperationType(dossier) {
        // Chercher dans différents champs possibles
        const typeActe = (dossier.typeActe || '').toLowerCase();
        const contrat = (dossier.contrat || '').toLowerCase();
        const etatBO = (dossier.etatBO || '').toLowerCase();
        
        // Mots-clés pour versements
        const versementKeywords = ['versement', 'apport', 'entrée', 'souscription', 'dépôt'];
        // Mots-clés pour rachats
        const rachatKeywords = ['rachat', 'retrait', 'sortie', 'liquidation'];
        // Mots-clés pour arbitrages
        const arbitrageKeywords = ['arbitrage', 'switch', 'réallocation'];
        // Mots-clés pour transferts
        const transfertKeywords = ['transfert', 'portabilité'];
        // Mots-clés pour avances
        const avanceKeywords = ['avance', 'prêt'];
        
        // Analyser le type d'acte en priorité
        if (versementKeywords.some(keyword => typeActe.includes(keyword))) {
            if (typeActe.includes('initial') || typeActe.includes('ouverture')) {
                return 'versement_initial';
            }
            return 'versement';
        }
        
        if (rachatKeywords.some(keyword => typeActe.includes(keyword))) {
            if (typeActe.includes('partiel')) {
                return 'rachat_partiel';
            } else if (typeActe.includes('total')) {
                return 'rachat_total';
            }
            return 'rachat';
        }
        
        if (arbitrageKeywords.some(keyword => typeActe.includes(keyword))) {
            return 'arbitrage';
        }
        
        if (transfertKeywords.some(keyword => typeActe.includes(keyword))) {
            if (typeActe.includes('entrant') || typeActe.includes('arrivée')) {
                return 'transfert_entrant';
            } else if (typeActe.includes('sortant') || typeActe.includes('départ')) {
                return 'transfert_sortant';
            }
            return 'transfert_entrant'; // Par défaut
        }
        
        if (avanceKeywords.some(keyword => typeActe.includes(keyword))) {
            return 'avance';
        }
        
        // Si pas trouvé dans typeActe, chercher dans d'autres champs
        if (versementKeywords.some(keyword => contrat.includes(keyword) || etatBO.includes(keyword))) {
            return 'versement';
        }
        
        if (rachatKeywords.some(keyword => contrat.includes(keyword) || etatBO.includes(keyword))) {
            return 'rachat';
        }
        
        // Par défaut, si on ne peut pas déterminer
        return 'unknown';
    }

    updateDocumentsGrid() {
        const gridContainer = document.getElementById('documents-grid');
        if (!gridContainer) return;

        const documentsHtml = Object.values(this.documentsState).map(docState => {
            const docConfig = this.documentsConfig[docState.id];
            const statusClass = this.getStatusClass(docState.status);
            const progressText = this.getProgressText(docState);

            return `
                <div class="document-card ${statusClass}" 
                     data-doc-id="${docState.id}"
                     onclick="window.documentController?.startDocumentQuestions(${docState.id})">
                    <div class="document-header">
                        <h4 class="document-name">${docConfig.name}</h4>
                        <div class="document-status-icon">
                            ${this.getStatusIcon(docState.status)}
                        </div>
                    </div>
                    <div class="document-subtitle">${docConfig.fullName}</div>
                    <div class="document-progress">${progressText}</div>
                </div>
            `;
        }).join('');

        gridContainer.innerHTML = documentsHtml;
    }

    getStatusClass(status) {
        const classes = {
            'pending': 'status-pending',
            'completed': 'status-completed',
            'error': 'status-error'
        };
        return classes[status] || 'status-pending';
    }

    getStatusIcon(status) {
        const icons = {
            'pending': '⏳',
            'completed': '✅',
            'error': '❌'
        };
        return icons[status] || '⏳';
    }

    getProgressText(docState) {
        if (docState.totalQuestions === 0) {
            return docState.status === 'completed' ? 'Vérifié' : 'À vérifier';
        }
        return `${docState.completedQuestions}/${docState.totalQuestions} questions`;
    }

    startDocumentQuestions(documentId) {
        Utils.debugLog(`=== DÉBUT QUESTIONS DOCUMENT ${documentId} ===`);
    
        this.currentDocument = documentId;
        this.currentQuestionIndex = 0;
        
        const docConfig = this.documentsConfig[documentId];
        
        // NOUVEAU : Filtrer les questions selon le type de contrôle
        const originalQuestions = [...docConfig.questions]; // Copie pour éviter la mutation
        const filteredQuestions = this.filterQuestionsForControlType(originalQuestions);
        
        Utils.debugLog(`Questions filtrées: ${originalQuestions.length} -> ${filteredQuestions.length} pour ${this.currentControl?.type}`);
        
        if (filteredQuestions.length === 0) {
            this.documentsState[documentId].status = 'completed';
            this.documentsState[documentId].completedQuestions = 1;
            this.updateDocumentsGrid();
            Utils.showNotification(`Document ${docConfig.name} marqué comme vérifié`, 'success');
            return;
        }
        
        // Sauvegarder les questions originales et utiliser les filtrées
        docConfig.originalQuestions = originalQuestions;
        docConfig.questions = filteredQuestions;
        
        // Mettre à jour le nombre total de questions pour ce document
        this.documentsState[documentId].totalQuestions = filteredQuestions.length;
        
        this.showQuestionInterface();
    }

    showQuestionInterface() {
        Utils.showSection('question-interface-section');
        this.updateQuestionInterface();
    }

    updateQuestionInterface() {
        const docConfig = this.documentsConfig[this.currentDocument];
        const questions = docConfig.questions;
        const currentQuestionData = questions[this.currentQuestionIndex];

        const questionContainer = document.getElementById('question-container');
        if (!questionContainer) return;

        // Interface de base (existante)
        questionContainer.innerHTML = `
            <div class="question-header">
                <h3>${docConfig.fullName}</h3>
                <div class="question-progress">
                    Question ${this.currentQuestionIndex + 1} sur ${questions.length}
                    ${this.isResumingControl ? '<span class="resume-badge">🔄 Reprise</span>' : ''}
                    ${this.isRevisionMode ? '<span class="revision-badge">📝 Révision</span>' : ''}
                </div>
            </div>
            
            <!-- NOUVEAU : Indicateur de réponse originale en mode révision -->
            ${this.isRevisionMode ? this.generateOriginalResponseIndicator() : ''}
            
            <div class="question-content">
                <div class="question-text">
                    ${currentQuestionData.text}
                    <span class="help-icon" onclick="window.documentController?.toggleHelp('main-help')" title="Aide">💡</span>
                    <div id="main-help" class="help-bubble" style="display: none;">
                        ${currentQuestionData.help}
                    </div>
                </div>
                
                <div class="response-options">
                    ${this.generateResponseOptions(currentQuestionData)}
                </div>
                
                <div class="question-actions">
                    <button class="btn btn-secondary ${this.currentQuestionIndex === 0 ? 'disabled' : ''}" 
                            onclick="window.documentController?.goToPreviousQuestion()"
                            ${this.currentQuestionIndex === 0 ? 'disabled' : ''}>
                        ⬅️ Question précédente
                    </button>
                    <button class="btn btn-primary" onclick="window.documentController?.saveQuestionResponse()">
                        ${this.currentQuestionIndex === questions.length - 1 ? 'Terminer le document' : 'Question suivante'} ➡️
                    </button>
                    <button class="btn btn-danger" onclick="window.documentController?.suspendControl()">
                        ⏸️ Suspendre
                    </button>
                    <button class="btn btn-secondary" onclick="window.documentController?.cancelQuestion()">
                        🏠 Retour au menu
                    </button>
                </div>
            </div>
        `;

        // Pré-remplir les réponses existantes
        if (this.isRevisionMode || this.isResumingControl) {
            this.prefillExistingResponses();
        }

        // Ajouter les styles
        if (currentQuestionData.type === 'checklist') {
            this.addChecklistStyles();
        }
        this.addHelpBubbleStyles();
        this.addRevisionStyles();
    }

    generateOriginalResponseIndicator() {
        if (!this.isRevisionMode) return '';

        const originalResponse = this.originalResponses[this.currentDocument]?.[this.currentQuestionIndex];
        if (!originalResponse) return '';

        return `
            <div class="original-response-indicator">
                <div style="
                    background: #e3f2fd;
                    border-left: 4px solid #2196f3;
                    padding: 12px 15px;
                    margin: 15px 0;
                    border-radius: 0 8px 8px 0;
                ">
                    <div style="font-weight: 600; color: #1976d2; margin-bottom: 5px;">
                        📋 Réponse originale :
                    </div>
                    <div style="color: #424242;">
                        <strong>Réponse :</strong> ${originalResponse.answer}<br>
                        ${originalResponse.quality ? `<strong>Qualité :</strong> ${originalResponse.quality}<br>` : ''}
                        ${originalResponse.justification ? `<strong>Justification :</strong> ${originalResponse.justification}` : ''}
                    </div>
                </div>
            </div>
        `;
    }

    // NOUVEAU : Ajouter les styles pour le mode révision
    addRevisionStyles() {
        if (document.getElementById('revision-styles')) return;
        
        const style = document.createElement('style');
        style.id = 'revision-styles';
        style.textContent = `
            .revision-badge {
                background: #ffc107;
                color: #212529;
                padding: 4px 8px;
                border-radius: 4px;
                font-size: 0.8rem;
                font-weight: 600;
                margin-left: 8px;
            }
            
            .original-response-indicator {
                animation: fadeIn 0.3s ease-in-out;
            }
            
            @keyframes fadeIn {
                from { opacity: 0; transform: translateY(-10px); }
                to { opacity: 1; transform: translateY(0); }
            }
            
            .revision-banner {
                animation: slideIn 0.5s ease-out;
            }
            
            @keyframes slideIn {
                from { opacity: 0; transform: translateX(-20px); }
                to { opacity: 1; transform: translateX(0); }
            }
            
            .modified-field {
                border: 2px solid #ffc107;
                background: rgba(255, 193, 7, 0.1);
                border-radius: 4px;
            }
            
            .modified-field::after {
                content: "✏️ Modifié";
                position: absolute;
                top: -8px;
                right: 8px;
                background: #ffc107;
                color: #212529;
                font-size: 0.7rem;
                padding: 2px 6px;
                border-radius: 10px;
                font-weight: 600;
            }
        `;
        
        document.head.appendChild(style);
    }

    formatDisplayDate(dateString) {
        if (!dateString) return 'N/A';
        
        // Si la date est déjà formatée par Utils.formatDate, l'utiliser directement
        if (typeof dateString === 'string' && dateString.match(/^\d{2}\/\d{2}\/\d{4}$/)) {
            return dateString; // Déjà au format DD/MM/YYYY
        }
        
        // Sinon, utiliser la même logique que DataProcessor.parseExcelDate
        try {
            const date = this.parseExcelDateSafe(dateString);
            if (!date || isNaN(date.getTime())) return dateString;
            
            return date.toLocaleDateString('fr-FR', {
                day: '2-digit',
                month: '2-digit', 
                year: 'numeric'
            });
        } catch (error) {
            return dateString;
        }
    }
    
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
        
        // Format DD/MM/YYYY (format européen)
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
        
        // Format ISO ou autres formats standard
        const isoDate = new Date(dateString);
        if (!isNaN(isoDate.getTime())) {
            return isoDate;
        }
        
        return null;
    }
    
    calculateMonthsDifference(dateDoc, dateEnvoi) {
        if (!dateDoc || !dateEnvoi) return 999;
        
        const date1 = this.parseExcelDateSafe(dateDoc);
        const date2 = this.parseExcelDateSafe(dateEnvoi);
        
        if (!date1 || !date2 || isNaN(date1.getTime()) || isNaN(date2.getTime())) {
            return 999;
        }
        
        return (date2.getFullYear() - date1.getFullYear()) * 12 + 
               (date2.getMonth() - date1.getMonth());
    }
    
    getDCCStatus() {
        if (!this.currentDossier.dateDCC || !this.currentDossier.dateEnvoi) {
            return 'unknown';
        }
        
        const diffMonths = this.calculateMonthsDifference(
            this.currentDossier.dateDCC, 
            this.currentDossier.dateEnvoi
        );
        
        if (diffMonths <= 24) return 'valid';
        return 'expired';
    }
    
    getDCCStatusText() {
        if (!this.currentDossier.dateDCC || !this.currentDossier.dateEnvoi) {
            return 'Dates manquantes';
        }
        
        // Utiliser les valeurs brutes directement sans re-formater
        const diffMonths = this.calculateMonthsDifference(
            this.currentDossier.dateDCC,  // Utiliser la valeur brute
            this.currentDossier.dateEnvoi
        );
        
        if (diffMonths <= 0) return 'Postérieure à l\'envoi';
        if (diffMonths <= 6) return `Très récente (${diffMonths} mois)`;
        if (diffMonths <= 12) return `Récente (${diffMonths} mois)`;
        if (diffMonths <= 24) return `Valide (${diffMonths} mois)`;
        return `Expirée (${diffMonths} mois)`;
    }
    
    getProfilStatus() {
        if (!this.currentDossier.dateProfilInvestisseur || !this.currentDossier.dateEnvoi) {
            return 'unknown';
        }
        
        const diffMonths = this.calculateMonthsDifference(
            this.currentDossier.dateProfilInvestisseur, 
            this.currentDossier.dateEnvoi
        );
        
        if (diffMonths <= 24) return 'valid';
        return 'expired';
    }
    
    getProfilStatusText() {
        if (!this.currentDossier.dateProfilInvestisseur || !this.currentDossier.dateEnvoi) {
            return 'Dates manquantes';
        }
        
        const diffMonths = this.calculateMonthsDifference(
            this.currentDossier.dateProfilInvestisseur, 
            this.currentDossier.dateEnvoi
        );
        
        if (diffMonths <= 0) return 'Postérieur à l\'envoi';
        if (diffMonths <= 6) return `Très récent (${diffMonths} mois)`;
        if (diffMonths <= 12) return `Récent (${diffMonths} mois)`;
        if (diffMonths <= 24) return `Valide (${diffMonths} mois)`;
        return `Expiré (${diffMonths} mois)`;
    }
    
    getUpdateContextInfo() {
        console.log('Debug dates:', {
            dateDCC: this.currentDossier.dateDCC,
            dateProfilInvestisseur: this.currentDossier.dateProfilInvestisseur,
            dateEnvoi: this.currentDossier.dateEnvoi,
            typeDCC: typeof this.currentDossier.dateDCC,
            typeEnvoi: typeof this.currentDossier.dateEnvoi
        });
        
        return {
            dccStatus: this.getDCCStatus(),
            dccText: this.getDCCStatusText(),
            dccDate: this.formatDisplayDate(this.currentDossier.dateDCC),
            profilStatus: this.getProfilStatus(), 
            profilText: this.getProfilStatusText(),
            profilDate: this.formatDisplayDate(this.currentDossier.dateProfilInvestisseur),
            dateEnvoi: this.formatDisplayDate(this.currentDossier.dateEnvoi)
        };
    }

    goToPreviousQuestion() {
        if (this.currentQuestionIndex > 0) {
            // Supprimer la réponse actuelle si elle existe
            if (this.documentResponses[this.currentDocument] && 
                this.documentResponses[this.currentDocument][this.currentQuestionIndex]) {
                delete this.documentResponses[this.currentDocument][this.currentQuestionIndex];
            }
            
            // Revenir à la question précédente
            this.currentQuestionIndex--;
            
            // Gérer les questions de suivi (followUp) qui ont pu être injectées
            const docConfig = this.documentsConfig[this.currentDocument];
            const questions = docConfig.questions;
            const currentQuestion = questions[this.currentQuestionIndex];
            
            // Si c'est une question de suivi, la supprimer de la liste
            if (currentQuestion && currentQuestion.isFollowUp) {
                questions.splice(this.currentQuestionIndex, 1);
                this.documentsState[this.currentDocument].totalQuestions = questions.length;
                
                // Revenir encore d'une question si on était sur une followUp
                if (this.currentQuestionIndex > 0) {
                    this.currentQuestionIndex--;
                }
            }
            
            this.updateQuestionInterface();
            Utils.debugLog(`Retour à la question ${this.currentQuestionIndex + 1}`);
        }
    }

    generateResponseOptions(questionData) {
        if (questionData.type === 'document_type') {
        // Déterminer les options selon le document actuel
        let options;
        
        if (this.currentDocument === 1) {
            // Pour le document FR (ID 1) : options spécifiques RIC
            options = ['RIC (électronique)', 'Papier signé'];
        } else {
            // Pour tous les autres documents : options génériques
            options = ['Electronique', 'Papier'];
        }

         if (questionData.type === 'profile_origin') {
            return `
                <div class="response-group profile-origin-group">
                    <label>Origine du profil investisseur :</label>
                    <div class="radio-group">
                        ${questionData.options.map(option => `
                            <label class="radio-option">
                                <input type="radio" name="response" value="${option}">
                                <span>${option}</span>
                            </label>
                        `).join('')}
                    </div>
                </div>
            `;
        }
        
        return `
            <div class="response-group">
                <label>Type de document :</label>
                <div class="radio-group">
                    ${options.map(option => `
                        <label class="radio-option">
                            <input type="radio" name="response" value="${option}">
                            <span>${option}</span>
                        </label>
                    `).join('')}
                </div>
            </div>
        `;
    }

        if (questionData.type === 'protection_status') {
            return `
                <div class="response-group protection-status-group">
                    <label>Statut juridique du client :</label>
                    <div class="radio-group">
                        ${questionData.options.map(option => `
                            <label class="radio-option">
                                <input type="radio" name="response" value="${option}">
                                <span>${option}</span>
                            </label>
                        `).join('')}
                    </div>
                </div>
            `;
        }

    // NOUVEAU : Gestion du type checklist
    if (questionData.type === 'checklist') {
        return `
            <div class="response-group checklist-group">
                <label>Éléments manquants ou incomplets (cochez ceux qui posent problème) :</label>
                <div class="checklist-container">
                    ${questionData.options.map((option, index) => `
                        <div class="checklist-item">
                            <label class="checkbox-label">
                                <input type="checkbox" name="checklist-item" value="${option}" id="checklist-${index}">
                                <span class="checkbox-text">${option}</span>
                            </label>
                        </div>
                    `).join('')}
                </div>
                <div class="checklist-summary">
                    <span id="checklist-count">0</span> élément(s) manquant(s) identifié(s)
                </div>
            </div>
        `;
    }

    if (questionData.type === 'risque_niveau') {
        return `
            <div class="response-group risque-niveau-group">
                <label>Niveau de risque (1 = très prudent, 7 = très dynamique) :</label>
                <div class="radio-group">
                    ${questionData.options.map(option => `
                        <label class="radio-option risque-level-${option}">
                            <input type="radio" name="response" value="${option}">
                            <span>Niveau ${option}</span>
                        </label>
                    `).join('')}
                </div>
            </div>
        `;
    }

    if (questionData.type === 'esg_respect') {
        return `
            <div class="response-group esg-respect-group">
                <label>Respect du profil ESG :</label>
                <div class="radio-group">
                    ${questionData.options.map(option => `
                        <label class="radio-option esg-${option.toLowerCase()}">
                            <input type="radio" name="response" value="${option}">
                            <span>${option}</span>
                        </label>
                    `).join('')}
                </div>
            </div>
        `;
    }

    // NOUVEAU : Gestion du type carto_support
        if (questionData.type === 'carto_support') {
            return `
                <div class="response-group carto-support-group">
                    <label>Support de réalisation :</label>
                    <div class="radio-group">
                        ${questionData.options.map(option => `
                            <label class="radio-option">
                                <input type="radio" name="response" value="${option}">
                                <span>${option}</span>
                            </label>
                        `).join('')}
                    </div>
                </div>
            `;
        }

        if (questionData.type === 'text') {
            return `
                <div class="response-group">
                    <label>Précisez :</label>
                    <input type="text" id="text-response" class="form-input" placeholder="Tapez votre réponse...">
                </div>
            `;
        }

        if (questionData.type === 'operation_type') {
        return `
            <div class="response-group operation-type-group">
                <label>Type d'opération :</label>
                <div class="radio-group">
                    ${questionData.options.map(option => `
                        <label class="radio-option">
                            <input type="radio" name="response" value="${option}">
                            <span>${option}</span>
                        </label>
                    `).join('')}
                </div>
            </div>
        `;
    }

    if (questionData.type === 'operation_status') {
        return `
            <div class="response-group operation-status-group">
                <label>Statut de l'opération :</label>
                <div class="radio-group">
                    ${questionData.options.map(option => `
                        <label class="radio-option">
                            <input type="radio" name="response" value="${option}">
                            <span>${option}</span>
                        </label>
                    `).join('')}
                </div>
            </div>
        `;
    }

    if (questionData.type === 'rachat_motif') {
        return `
            <div class="response-group rachat-motif-group">
                <label>Motif du rachat :</label>
                <div class="radio-group">
                    ${questionData.options.map(option => `
                        <label class="radio-option">
                            <input type="radio" name="response" value="${option}">
                            <span>${option}</span>
                        </label>
                    `).join('')}
                </div>
            </div>
        `;
    }

        // Nouveaux types pour Carto Client
        if (questionData.type === 'patrimoine_tranche') {
            return `
                <div class="response-group">
                    <label>Tranche de patrimoine :</label>
                    <div class="radio-group">
                        ${questionData.options.map(option => `
                            <label class="radio-option">
                                <input type="radio" name="response" value="${option}">
                                <span>${option}</span>
                            </label>
                        `).join('')}
                    </div>
                </div>
            `;
        }

        if (questionData.type === 'revenus_tranche') {
            return `
                <div class="response-group">
                    <label>Tranche de revenus :</label>
                    <div class="radio-group">
                        ${questionData.options.map(option => `
                            <label class="radio-option">
                                <input type="radio" name="response" value="${option}">
                                <span>${option}</span>
                            </label>
                        `).join('')}
                    </div>
                </div>
            `;
        }

        if (questionData.type === 'vigilance_level') {
            return `
                <div class="response-group">
                    <label>Niveau de vigilance :</label>
                    <div class="radio-group">
                        ${questionData.options.map(option => `
                            <label class="radio-option">
                                <input type="radio" name="response" value="${option}">
                                <span>${option}</span>
                            </label>
                        `).join('')}
                    </div>
                </div>
            `;
        }

        if (questionData.type === 'gda_status') {
            return `
                <div class="response-group">
                    <label>Statut du GDA :</label>
                    <div class="radio-group">
                        ${questionData.options.map(option => `
                            <label class="radio-option">
                                <input type="radio" name="response" value="${option}">
                                <span>${option}</span>
                            </label>
                        `).join('')}
                    </div>
                </div>
            `;
        }

        if (questionData.type === 'gda_date') {
            return `
                <div class="response-group">
                    <label>Date du GDA manuel :</label>
                    <input type="date" id="date-response" class="form-input">
                </div>
            `;
        }
        
        // Questions boolean standard avec ou sans qualityCheck
        let options = `
            <div class="response-group">
                <label>Réponse :</label>
                <div class="radio-group">
                    <label class="radio-option">
                        <input type="radio" name="response" value="Oui">
                        <span>Oui</span>
                    </label>
                    <label class="radio-option">
                        <input type="radio" name="response" value="Non">
                        <span>Non</span>
                    </label>
                    <label class="radio-option">
                        <input type="radio" name="response" value="NC">
                        <span>N/C</span>
                    </label>
                </div>
            </div>
        `;

         if (questionData.type === 'origin_type') {
            return `
                <div class="response-group">
                    <label>Type de déclaration d'origine des fonds :</label>
                    <div class="radio-group">
                        ${questionData.options.map(option => `
                            <label class="radio-option">
                                <input type="radio" name="response" value="${option}">
                                <span>${option}</span>
                            </label>
                        `).join('')}
                    </div>
                </div>
            `;
        }

        if (questionData.type === 'suspicion_declaration') {
            return `
                <div class="response-group">
                    <label>Évaluation du risque de blanchiment :</label>
                    <div class="radio-group">
                        ${questionData.options.map(option => `
                            <label class="radio-option">
                                <input type="radio" name="response" value="${option}">
                                <span>${option}</span>
                            </label>
                        `).join('')}
                    </div>
                </div>
            `;
        }

        if (questionData.qualityCheck) {
            options += this.generateQualityCheckOptions(questionData.qualityCheck);
        }

        // Setup des event listeners après génération du HTML
        setTimeout(() => {
            this.setupQuestionEventListeners();
        }, 100);

        return options;
    }

    generateQualityCheckOptions(qualityCheck) {
        if (qualityCheck.type === 'signature_conseiller') {
            return `
                <div class="response-group quality-group" style="display: none;">
                    <label>
                        ${qualityCheck.text}
                        <span class="help-icon" onclick="window.documentController?.toggleHelp('quality-help')" title="Aide">💡</span>
                        <div id="quality-help" class="help-bubble" style="display: none;">
                            ${qualityCheck.help}
                        </div>
                    </label>
                    <div class="quality-checks">
                        <div class="check-item">
                            <label>Type de signature :</label>
                            <div class="radio-group">
                                <label class="radio-option">
                                    <input type="radio" name="signature-type" value="Manuscrite">
                                    <span>Manuscrite lisible</span>
                                </label>
                                <label class="radio-option">
                                    <input type="radio" name="signature-type" value="DocuSign">
                                    <span>DocuSign certifiée</span>
                                </label>
                                <label class="radio-option">
                                    <input type="radio" name="signature-type" value="Autre electronique">
                                    <span>Autre électronique</span>
                                </label>
                                <label class="radio-option">
                                    <input type="radio" name="signature-type" value="Non conforme">
                                    <span>Non conforme</span>
                                </label>
                            </div>
                        </div>
                        <div class="check-item">
                            <label class="checkbox-label">
                                <input type="checkbox" name="quality-checks" value="identite-correcte">
                                <span>Identité correspond au conseiller du dossier</span>
                            </label>
                        </div>
                        <div class="check-item">
                            <label class="checkbox-label">
                                <input type="checkbox" name="quality-checks" value="date-coherente">
                                <span>Date de signature cohérente</span>
                            </label>
                        </div>
                    </div>
                </div>
            `;
        } else if (qualityCheck.type === 'risque_coherence') {
            return `
                <div class="response-group quality-group" style="display: none;">
                     <label>
                         ${qualityCheck.text}
                        <span class="help-icon" onclick="window.documentController?.toggleHelp('quality-help')" title="Aide">💡</span>
                        <div id="quality-help" class="help-bubble" style="display: none;">
                            ${qualityCheck.help}
                        </div>
                    </label>
                    <div class="radio-group">
                        <label class="radio-option">
                            <input type="radio" name="quality" value="Cohérent">
                            <span>Cohérent (écart ≤ 1 niveau)</span>
                        </label>
                        <label class="radio-option">
                            <input type="radio" name="quality" value="Acceptable avec justification">
                            <span>Acceptable avec justification (écart de 2 niveaux)</span>
                        </label>
                        <label class="radio-option">
                            <input type="radio" name="quality" value="Non cohérent">
                            <span>Non cohérent (écart > 2 niveaux)</span>
                        </label>
                    </div>
                    <div class="justification-field" style="display: none; margin-top: 10px;">
                        <label>Justification de l'écart de risque :</label>
                        <textarea name="risk-justification" rows="3" placeholder="Expliquer pourquoi l'écart de risque est acceptable..."></textarea>
                    </div>
                </div>
            `;
        } else if (qualityCheck.type === 'signature_cif') {
            return `
                <div class="response-group quality-group" style="display: none;">
                    <label>
                        ${qualityCheck.text}
                        <span class="help-icon" onclick="window.documentController?.toggleHelp('quality-help')" title="Aide">💡</span>
                        <div id="quality-help" class="help-bubble" style="display: none;">
                            ${qualityCheck.help}
                        </div>
                    </label>
                    <div class="quality-checks">
                        <div class="check-item">
                            <label>Statut CIF :</label>
                            <div class="radio-group">
                                <label class="radio-option">
                                    <input type="radio" name="cif-status" value="CIF inscrit ORIAS">
                                    <span>CIF inscrit ORIAS</span>
                                </label>
                                <label class="radio-option">
                                    <input type="radio" name="cif-status" value="CIF en cours d'inscription">
                                    <span>CIF en cours d'inscription</span>
                                </label>
                                <label class="radio-option">
                                    <input type="radio" name="cif-status" value="Non CIF">
                                    <span>Non CIF</span>
                                </label>
                            </div>
                        </div>
                        <div class="check-item">
                            <label class="checkbox-label">
                                <input type="checkbox" name="cif-checks" value="carte-professionnelle-valide">
                                <span>Carte professionnelle valide et à jour</span>
                            </label>
                        </div>
                        <div class="check-item">
                            <label class="checkbox-label">
                                <input type="checkbox" name="cif-checks" value="habilitations-adequates">
                                <span>Habilitations adéquates pour les produits proposés</span>
                            </label>
                        </div>
                        <div class="check-item">
                            <label class="checkbox-label">
                                <input type="checkbox" name="cif-checks" value="signature-conforme">
                                <span>Signature conforme à la carte CIF</span>
                            </label>
                        </div>
                    </div>
                </div>
            `;
        } else if (qualityCheck.type === 'signature_clients') {
            return `
                <div class="response-group quality-group" style="display: none;">
                    <label>
                        ${qualityCheck.text}
                        <span class="help-icon" onclick="window.documentController?.toggleHelp('quality-help')" title="Aide">💡</span>
                        <div id="quality-help" class="help-bubble" style="display: none;">
                            ${qualityCheck.help}
                        </div>
                    </label>
                    <div class="quality-checks">
                        <div class="check-item">
                            <label>Type de signature :</label>
                            <div class="radio-group">
                                <label class="radio-option">
                                    <input type="radio" name="signature-type-clients" value="Manuscrite">
                                    <span>Manuscrite lisible</span>
                                </label>
                                <label class="radio-option">
                                    <input type="radio" name="signature-type-clients" value="DocuSign">
                                    <span>DocuSign certifiée</span>
                                </label>
                                <label class="radio-option">
                                    <input type="radio" name="signature-type-clients" value="Autre electronique">
                                    <span>Autre électronique</span>
                                </label>
                                <label class="radio-option">
                                    <input type="radio" name="signature-type-clients" value="Non conforme">
                                    <span>Non conforme</span>
                                </label>
                            </div>
                        </div>
                        <div class="check-item">
                            <label class="checkbox-label">
                                <input type="checkbox" name="quality-checks" value="signatures-distinctes">
                                <span>Signatures distinctes et lisibles (tous les titulaires)</span>
                            </label>
                        </div>
                        <div class="check-item">
                            <label class="checkbox-label">
                                <input type="checkbox" name="quality-checks" value="identites-correctes">
                                <span>Identités correspondant aux titulaires du contrat</span>
                            </label>
                        </div>
                        <div class="check-item">
                            <label class="checkbox-label">
                                <input type="checkbox" name="quality-checks" value="dates-coherentes">
                                <span>Dates de signature cohérentes</span>
                            </label>
                        </div>
                    </div>
                </div>
            `;
        } else {
            return `
                <div class="response-group quality-group" style="display: none;">
                    <label>
                        ${qualityCheck.text}
                        <span class="help-icon" onclick="window.documentController?.toggleHelp('quality-help')" title="Aide">💡</span>
                        <div id="quality-help" class="help-bubble" style="display: none;">
                            ${qualityCheck.help}
                        </div>
                    </label>
                    <div class="radio-group">
                        <label class="radio-option">
                            <input type="radio" name="quality" value="Conforme">
                            <span>Conforme</span>
                        </label>
                        <label class="radio-option">
                            <input type="radio" name="quality" value="Partiellement conforme">
                            <span>Partiellement conforme</span>
                        </label>
                        <label class="radio-option">
                            <input type="radio" name="quality" value="Non conforme">
                            <span>Non conforme</span>
                        </label>
                    </div>
                </div>
            `;
        }
    }

    setupQuestionEventListeners() {
        const responseInputs = document.querySelectorAll('input[name="response"]');
        responseInputs.forEach(input => {
            input.addEventListener('change', (e) => {
                const qualityGroup = document.querySelector('.quality-group');
                
                if (e.target.value === 'Oui') {
                    if (qualityGroup) qualityGroup.style.display = 'block';
                } else {
                    if (qualityGroup) {
                        qualityGroup.style.display = 'none';
                        this.resetQualityInputs(qualityGroup);
                    }
                }
            });
        });

        // 2. Event listeners pour les checkboxes de checklist (nouveau)
        const checklistItems = document.querySelectorAll('input[name="checklist-item"]');
        if (checklistItems.length > 0) {
            checklistItems.forEach(checkbox => {
                checkbox.addEventListener('change', () => {
                    this.updateChecklistCounter();
                });
            });
        }
    }
    

    // 5. NOUVELLE méthode pour mettre à jour le compteur de la checklist
    updateChecklistCounter() {
        const checkedItems = document.querySelectorAll('input[name="checklist-item"]:checked');
        const countElement = document.getElementById('checklist-count');
        
        if (countElement) {
            const count = checkedItems.length;
            countElement.textContent = count;
            
            // Changer la couleur selon le nombre d'éléments manquants
            const summaryElement = countElement.parentElement;
            if (summaryElement) {
                summaryElement.className = 'checklist-summary';
                if (count === 0) {
                    summaryElement.classList.add('no-missing');
                } else if (count <= 3) {
                    summaryElement.classList.add('few-missing');
                } else {
                    summaryElement.classList.add('many-missing');
                }
            }
        }
    }

    resetQualityInputs(qualityGroup) {
        const inputs = qualityGroup.querySelectorAll('input');
        inputs.forEach(input => {
            input.checked = false;
        });
    }

    toggleHelp(helpId) {
        const helpElement = document.getElementById(helpId);
        if (helpElement) {
            helpElement.style.display = helpElement.style.display === 'none' ? 'block' : 'none';
        }
    }

    collectQuestionResponse() {
        const docConfig = this.documentsConfig[this.currentDocument];
        const questionData = docConfig.questions[this.currentQuestionIndex];
        
        const response = {
            documentId: this.currentDocument,
            questionIndex: this.currentQuestionIndex,
            question: questionData.text,
            answer: '',
            quality: '',
            qualityDetails: {},
            justification: ''
        };

        // NOUVEAU : Gestion du type profile_origin
        if (questionData.type === 'profile_origin') {
            const profileOriginRadio = document.querySelector('input[name="response"]:checked');
            if (profileOriginRadio) {
                response.answer = profileOriginRadio.value;
            }
            return response;
        }

        // Gestion du type checklist (modifiée pour améliorer la détection)
        if (questionData.type === 'checklist') {
            const checkedItems = document.querySelectorAll('input[name="checklist-item"]:checked');
            const missingElements = Array.from(checkedItems).map(cb => cb.value);
            
            response.answer = missingElements.length === 0 ? 'Aucun élément manquant' : missingElements.join(', ');
            response.missingElements = missingElements;
            response.missingCount = missingElements.length;
            
            return response;
        }

        if (questionData.type === 'document_type') {
            const docTypeRadio = document.querySelector('input[name="response"]:checked');
            if (docTypeRadio) {
                response.answer = docTypeRadio.value;
            }
            return response;
        }

        if (questionData.type === 'carto_support') {
            const cartoSupportRadio = document.querySelector('input[name="response"]:checked');
            if (cartoSupportRadio) {
                response.answer = cartoSupportRadio.value;
            }
            return response;
        }

        if (questionData.type === 'text') {
            const textInput = document.getElementById('text-response');
            if (textInput) {
                response.answer = textInput.value.trim();
            }
            return response;
        }

        // Gestion des nouveaux types de questions pour Carto Client
        if (questionData.type === 'patrimoine_tranche' || 
            questionData.type === 'revenus_tranche' || 
            questionData.type === 'vigilance_level' ||
            questionData.type === 'gda_status') {
            const answerRadio = document.querySelector('input[name="response"]:checked');
            if (answerRadio) {
                response.answer = answerRadio.value;
            }
            
            return response;
        }

        const answerRadio = document.querySelector('input[name="response"]:checked');
        if (answerRadio) {
            response.answer = answerRadio.value;
        }

        if (questionData.type === 'gda_date') {
            const dateInput = document.getElementById('date-response');
            if (dateInput) {
                response.answer = dateInput.value;
            }
            return response;
        }

        if (response.answer === 'Oui' && questionData.qualityCheck) {
            if (questionData.qualityCheck.type === 'signature_conseiller') {
                const signatureType = document.querySelector('input[name="signature-type"]:checked');
                if (signatureType) {
                    response.qualityDetails.signatureType = signatureType.value;
                }
                
                const qualityChecks = document.querySelectorAll('input[name="quality-checks"]:checked');
                response.qualityDetails.checks = Array.from(qualityChecks).map(cb => cb.value);
                
                const allChecked = qualityChecks.length === 2;
                const validType = signatureType && ['Manuscrite', 'DocuSign', 'Autre electronique'].includes(signatureType.value);
                response.quality = (allChecked && validType) ? 'Conforme' : 'Non conforme';
                
            } else if (questionData.qualityCheck.type === 'signature_clients') {
                const signatureType = document.querySelector('input[name="signature-type-clients"]:checked');
                if (signatureType) {
                    response.qualityDetails.signatureType = signatureType.value;
                }
                 
                const qualityChecks = document.querySelectorAll('input[name="quality-checks"]:checked');
                response.qualityDetails.checks = Array.from(qualityChecks).map(cb => cb.value);
                    
                const allChecked = qualityChecks.length === 3;
                const validType = signatureType && ['Manuscrite', 'DocuSign', 'Autre electronique'].includes(signatureType.value);
                response.quality = (allChecked && validType) ? 'Conforme' : 'Non conforme';

            } else if (questionData.qualityCheck.type === 'signature_cif') {
                const cifStatus = document.querySelector('input[name="cif-status"]:checked');
                if (cifStatus) {
                    response.qualityDetails.cifStatus = cifStatus.value;
                }
                
                const cifChecks = document.querySelectorAll('input[name="cif-checks"]:checked');
                response.qualityDetails.checks = Array.from(cifChecks).map(cb => cb.value);
                
                const allChecked = cifChecks.length === 3;
                const validStatus = cifStatus && cifStatus.value === 'CIF inscrit ORIAS';
                response.quality = (allChecked && validStatus) ? 'Conforme' : 'Non conforme';
                
            } else if (questionData.qualityCheck.type === 'signature_clients') {
                const qualityChecks = document.querySelectorAll('input[name="quality-checks"]:checked');
                response.qualityDetails.checks = Array.from(qualityChecks).map(cb => cb.value);
                
                response.quality = (qualityChecks.length === 3) ? 'Conforme' : 'Non conforme';
            
            } else if (questionData.qualityCheck.type === 'signature_cif') {
                const cifStatus = document.querySelector('input[name="cif-status"]:checked');
                if (cifStatus) {
                    response.qualityDetails.cifStatus = cifStatus.value;
                }
                
                const cifChecks = document.querySelectorAll('input[name="cif-checks"]:checked');
                response.qualityDetails.checks = Array.from(cifChecks).map(cb => cb.value);
                
                const allChecked = cifChecks.length === 3;
                const validStatus = cifStatus && cifStatus.value === 'CIF inscrit ORIAS';
                response.quality = (allChecked && validStatus) ? 'Conforme' : 'Non conforme';
                
            } else {
                // Pour les autres types de qualityCheck
                const qualityRadio = document.querySelector('input[name="quality"]:checked');
                if (qualityRadio) {
                    response.quality = qualityRadio.value;
                } else {
                    // Si pas de sélection qualité, on considère conforme par défaut
                    response.quality = 'Conforme';
                }
            }
        }

        return response;
    }

    validateResponse(response) {
        const questionData = this.documentsConfig[this.currentDocument].questions[this.currentQuestionIndex];
        
        if (questionData.type === 'document_type') {
            if (!response.answer) {
                Utils.showNotification('Veuillez sélectionner le type de document', 'error');
                return false;
            }
            return true;
        }

        if (questionData.type === 'profile_origin') {
            if (!response.answer) {
                Utils.showNotification('Veuillez sélectionner l\'origine du profil', 'error');
                return false;
            }
            return true;
        }

        // NOUVEAU : Validation pour checklist (toujours valide, même si rien n'est coché)
        if (questionData.type === 'checklist') {
            return true; // Une checklist vide est valide (signifie "rien ne manque")
        }

        if (questionData.type === 'text') {
            if (!response.answer) {
                Utils.showNotification('Veuillez saisir une réponse', 'error');
                return false;
            }
            return true;
        }

        if (questionData.type === 'carto_support') {
            if (!response.answer) {
                Utils.showNotification('Veuillez sélectionner le support de réalisation', 'error');
                return false;
            }
            return true;
        }

        // Validation spécifique pour les noms de CIF
        if (questionData.text.includes('CIF signataire')) {
            if (response.answer.length < 3) {
                Utils.showNotification('Le nom du CIF doit contenir au moins 3 caractères', 'error');
                return false;
            }
        }

        if (questionData.type === 'gda_status') {
            if (!response.answer) {
                Utils.showNotification('Veuillez sélectionner le statut du GDA', 'error');
                return false;
            }
            return true;
        }

        if (questionData.type === 'gda_date') {
            if (!response.answer) {
                Utils.showNotification('Veuillez saisir la date du GDA manuel', 'error');
                return false;
            }
            return true;
        }

        if (questionData.type === 'origin_type' || questionData.type === 'suspicion_declaration') {
            if (!response.answer) {
                Utils.showNotification('Veuillez sélectionner une option', 'error');
                return false;
            }
            return true;
        }

        if (questionData.type === 'operation_type' || 
            questionData.type === 'operation_status' || 
            questionData.type === 'rachat_motif') {
            if (!response.answer) {
                Utils.showNotification('Veuillez sélectionner une option', 'error');
                return false;
            }
            return true;
        }

        // Validation pour les nouveaux types
        if (questionData.type === 'patrimoine_tranche' || 
            questionData.type === 'revenus_tranche' || 
            questionData.type === 'vigilance_level') {
            if (!response.answer) {
                Utils.showNotification('Veuillez sélectionner une option', 'error');
                return false;
            }
            
            return true;
        }

        if (!response.answer) {
            Utils.showNotification('Veuillez sélectionner une réponse', 'error');
            return false;
        }

        if (response.answer === 'Oui' && questionData.qualityCheck) {
            if (questionData.qualityCheck.type === 'signature_conseiller') {
                if (!response.qualityDetails.signatureType) {
                    Utils.showNotification('Veuillez sélectionner le type de signature', 'error');
                    return false;
                }

            } else if (questionData.qualityCheck.type === 'signature_clients') {
                if (!response.qualityDetails.signatureType) {
                    Utils.showNotification('Veuillez sélectionner le type de signature des clients', 'error');
                    return false;
                }

            } else if (questionData.qualityCheck.type === 'signature_cif') {
                if (!response.qualityDetails.cifStatus) {
                    Utils.showNotification('Veuillez sélectionner le statut CIF', 'error');
                    return false;
                }
            } else if (questionData.qualityCheck.type === 'signature_clients') {
                if (!response.qualityDetails.checks || response.qualityDetails.checks.length === 0) {
                    Utils.showNotification('Veuillez vérifier au moins un critère de conformité', 'error');
                    return false;
                }
            } else {
                // Pour les autres types de qualityCheck, on vérifie seulement si c'est affiché
                const qualityGroup = document.querySelector('.quality-group');
                if (qualityGroup && qualityGroup.style.display !== 'none' && !response.quality) {
                    Utils.showNotification('Veuillez indiquer le niveau de conformité', 'error');
                    return false;
                }
            }
        }

        return true;
    }

    saveQuestionResponse() {
        const response = this.collectQuestionResponse();
        
        if (!this.validateResponse(response)) {
            return;
        }

        // Vérifier si c'est une question qui ne nécessite pas de justification même si "Non"
        const questionData = this.documentsConfig[this.currentDocument].questions[this.currentQuestionIndex];
        const isExemptFromJustification = this.isQuestionExemptFromJustification(questionData, response);

        // Afficher la justification seulement si nécessaire
        if (!isExemptFromJustification && 
            (response.answer === 'Non' || response.quality === 'Non conforme' || response.quality === 'Partiellement conforme')) {
            this.showJustificationModal(response);
            return;
        }

        // Sinon, sauvegarder directement la réponse
        this.saveResponse(response);
        this.moveToNextQuestion();
    }

    isQuestionExemptFromJustification(questionData, response) {
        // Questions spécifiques qui ne nécessitent pas de justification pour "Non"
        const exemptQuestions = [
            'Est-ce que le conseiller est CIF ?',
            'Est-ce que le document est présent ?', // Déjà géré par skipIfNo mais au cas où
            'La cartographie client a-t-elle été réalisée ?',
            'La cartographie de l\'opération a-t-elle été réalisée ?',
            'Tous les documents sont-ils bien ajoutés dans Zeendoc ?',
            'Est-ce que le patrimoine est-il connu ?',
            'Est-ce que les revenus sont-ils connus ?',
            'Le client connaissait-il tous les produits proposés ?',
            'Le dossier client a-t-il été créé sous Harvest ?',
            'Est-ce qu\'il y a une FR ?',
            'Est-ce qu\'il y a un profil investisseur ?',
            'Les documents disponibles dans Zeendoc sont-ils suffisants pour ce type de contrôle ?'
        ];

        // Les checklists ne nécessitent jamais de justification
        if (questionData.type === 'checklist') {
            return true;
        }

        // Les questions de type profile_origin ne nécessitent pas de justification
        if (questionData.type === 'profile_origin') {
            return true;
        }

        // Vérifier si c'est une question exemptée
        if (exemptQuestions.includes(questionData.text)) {
            return true;
        }

        // Cas spécial pour ESG "Partiellement" 
        if (questionData.type === 'esg_respect' && response.answer === 'Partiellement') {
            return true;
        }

        // Questions avec skipIfNC qui ne nécessitent pas de justification pour "N/C"
        if (questionData.skipIfNC && response.answer === 'NC') {
            return true;
        }

        // Questions avec followUp qui ne nécessitent pas de justification
        if (questionData.followUp && response.answer === 'Non') {
            return true;
        }

        // Questions de type "document_type", "patrimoine_tranche", etc. qui ne sont pas des conformités
        const exemptTypes = [
            'document_type', 
            'patrimoine_tranche',
            'carto_support', 
            'revenus_tranche', 
            'vigilance_level',
            'gda_status',
            'gda_date',
            'operation_type',
            'operation_status',
            'rachat_motif',
            'origin_type',
            'suspicion_declaration',
            'risque_niveau',
            'esg_respect'
        ];

        if (exemptTypes.includes(questionData.type)) {
            return true;
        }

        return false;
    }

     startRevision(controleId) {
        if (!window.persistenceManager) {
            Utils.showNotification('Gestionnaire d\'historique non disponible', 'error');
            return;
        }

        const originalControl = window.persistenceManager.getHistoryData().controles.find(c => c.id == controleId);
        if (!originalControl) {
            Utils.showNotification('Contrôle original introuvable', 'error');
            return;
        }

        // Vérifier si le contrôle peut être révisé
        if (!this.canControlBeRevised(originalControl)) {
            Utils.showNotification('Ce contrôle ne peut plus être révisé', 'warning');
            return;
        }

        Utils.debugLog(`=== DÉBUT RÉVISION CONTRÔLE ${controleId} ===`);
        Utils.debugLog(`Client: ${originalControl.client}, Type: ${originalControl.type}`);

        // Initialiser le mode révision
        this.isRevisionMode = true;
        this.originalControlId = controleId;
        this.originalResponses = originalControl.rawControlData?.responses || {};
        this.modifiedFields = new Set();
        this.revisionStartTime = new Date();

        // Restaurer le contexte du contrôle original
        this.currentDossier = originalControl.rawControlData?.dossier || {
            client: originalControl.client,
            codeDossier: originalControl.codeDossier,
            conseiller: originalControl.conseiller,
            montant: originalControl.montant,
            domaine: originalControl.domaine
        };

        this.currentControl = originalControl.rawControlData?.control || {
            type: originalControl.type,
            definition: { name: originalControl.type }
        };

        // Initialiser les documents avec les réponses originales
        this.initializeDocumentsForControl(this.currentControl.type);
        this.loadOriginalResponsesIntoState();

        // Afficher l'interface de contrôle en mode révision
        this.showDocumentControlInterface();
        Utils.showNotification('Mode révision activé - Réponses pré-remplies', 'info');
    }

    // NOUVEAU : Vérifier si un contrôle peut être révisé
    canControlBeRevised(control) {
        // Un contrôle peut être révisé s'il est de type C1 ou C1S (pas C2R)
        if (control.completionType === 'C2R') {
            return false;
        }

        // Vérifier qu'il n'existe pas déjà une révision
        if (window.persistenceManager) {
            const existingRevision = window.persistenceManager.getHistoryData().controles
                .find(c => c.parentControlId == control.id);
            if (existingRevision) {
                return false;
            }
        }

        return true;
    }

    // NOUVEAU : Charger les réponses originales dans l'état actuel
    loadOriginalResponsesIntoState() {
        if (!this.originalResponses) return;

        // Copier les réponses originales dans documentResponses
        Object.keys(this.originalResponses).forEach(docId => {
            if (!this.documentResponses[docId]) {
                this.documentResponses[docId] = {};
            }
            
            Object.keys(this.originalResponses[docId] || {}).forEach(questionIndex => {
                this.documentResponses[docId][questionIndex] = {
                    ...this.originalResponses[docId][questionIndex]
                };
            });
        });

        // Mettre à jour l'état des documents comme terminés
        Object.keys(this.documentsState).forEach(docId => {
            if (this.originalResponses[docId] && Object.keys(this.originalResponses[docId]).length > 0) {
                this.documentsState[docId].status = 'completed';
                this.documentsState[docId].completedQuestions = Object.keys(this.originalResponses[docId]).length;
            }
        });

        Utils.debugLog(`Réponses originales chargées pour ${Object.keys(this.originalResponses).length} documents`);
    }

    saveResponse(response) {
        if (!this.documentResponses[response.documentId]) {
            this.documentResponses[response.documentId] = {};
        }
        
        // NOUVEAU : En mode révision, comparer avec la réponse originale
        if (this.isRevisionMode) {
            const originalResponse = this.originalResponses[response.documentId]?.[response.questionIndex];
            if (originalResponse) {
                const hasChanged = this.hasResponseChanged(originalResponse, response);
                if (hasChanged) {
                    const fieldKey = `${response.documentId}_${response.questionIndex}`;
                    this.modifiedFields.add(fieldKey);
                    response.wasModified = true;
                    response.originalAnswer = originalResponse.answer;
                    response.originalQuality = originalResponse.quality;
                    
                    Utils.debugLog(`Modification détectée: Doc ${response.documentId}, Q ${response.questionIndex}`);
                } else {
                    response.wasModified = false;
                }
            }
        }
        
        // Calculer la conformité
        response.conforme = this.isResponseConforme(response);
        
        this.documentResponses[response.documentId][response.questionIndex] = response;
        
        Utils.debugLog(`Réponse sauvegardée: Doc ${response.documentId}, Q ${response.questionIndex}, Conforme: ${response.conforme}${response.wasModified ? ' [MODIFIÉE]' : ''}`);
    }

    // NOUVEAU : Comparer deux réponses pour détecter les changements
    hasResponseChanged(originalResponse, newResponse) {
        // Comparer les réponses principales
        if (originalResponse.answer !== newResponse.answer) {
            return true;
        }

        // Comparer la qualité si présente
        if (originalResponse.quality !== newResponse.quality) {
            return true;
        }

        // Comparer les justifications
        if ((originalResponse.justification || '') !== (newResponse.justification || '')) {
            return true;
        }

        // Comparer les éléments manquants pour les checklists
        if (originalResponse.missingElements && newResponse.missingElements) {
            const originalMissing = JSON.stringify(originalResponse.missingElements.sort());
            const newMissing = JSON.stringify(newResponse.missingElements.sort());
            if (originalMissing !== newMissing) {
                return true;
            }
        }

        return false;
    }

    // Méthode corrigée pour isResponseConforme
    isResponseConforme(response) {
    const questionData = this.documentsConfig[response.documentId].questions[response.questionIndex];
    
        // Les checklists sont toujours considérées comme des anomalies à signaler
        if (questionData.type === 'checklist') {
            return false; // Toujours rouge/non conforme pour les checklists
        }
    
        // Si c'est explicitement marqué comme non conforme par la qualité
        if (response.quality === 'Non conforme') {
            return false;
        }
    
        // NOUVELLE LOGIQUE : Identifier les types de questions où seules certaines réponses sont des anomalies
        const questionType = questionData.type;
        const questionText = response.question.toLowerCase();
        
        // Types de questions avec des réponses valides multiples (pas d'anomalie)
        const validChoiceTypes = [
            'document_type',        // Papier/Electronique sont tous valides
            'carto_support',        // Harvest/Papier sont tous valides
            'patrimoine_tranche',   // Toutes les tranches sont valides
            'revenus_tranche',      // Toutes les tranches sont valides
            'vigilance_level',      // Standard/Complémentaire/Renforcée sont tous valides
            'gda_status',          // Automatique/Manuel/Pas fait sont tous valides
            'operation_type',       // Tous les types d'opération sont valides
            'operation_status',     // Tous les statuts sont valides
            'rachat_motif',        // Tous les motifs sont valides
            'origin_type',         // Tous les types de déclaration sont valides
            'suspicion_declaration', // Toutes les évaluations sont valides
            'risque_niveau',       // Tous les niveaux de risque sont valides
            'esg_respect',         // Oui/Non/Partiellement sont tous valides
            'profile_origin',      // Papier/Electronique sont tous valides
            'text',                // Les réponses texte sont généralement valides
            'gda_date'             // Les dates sont valides si saisies
        ];
        
        // Si c'est un type de question avec choix multiples valides
        if (validChoiceTypes.includes(questionType)) {
            return true; // Toutes les réponses de ces types sont conformes
        }
        
        // Pour les questions boolean standard, analyser la réponse
        if (questionType === 'boolean' || !questionType) {
            
            // Réponse "NC" (Non Concerné) est toujours valide
            if (response.answer === 'NC') {
                return true;
            }
            
            // Réponse "Oui" est généralement valide (sauf si qualité non conforme)
            if (response.answer === 'Oui') {
                return response.quality !== 'Non conforme' && response.quality !== 'Partiellement conforme';
            }
            
            // Pour "Non", vérifier s'il s'agit d'une question où "Non" est acceptable
            if (response.answer === 'Non') {
                // Questions où "Non" est normal/attendu/acceptable
                const acceptableNoQuestions = [
                    'est-ce que le conseiller est cif',
                    'le client connaissait-il tous les produits',
                    'des rachats répétés ont-ils été effectués',
                    'y a-t-il un profil risque correspondant',
                    'est-ce que le patrimoine est-il connu',
                    'est-ce que les revenus sont-ils connus',
                    'des éléments sont-ils manquants',
                    'd\'autres informations détaillées sont-elles manquantes',
                    'si montant > 150 000€, une diligence renforcée',
                    'en cas de doute, une déclaration de soupçon',
                    'si compte tiers, y a-t-il une procuration',
                    'l\'opération concerne-t-elle un produit cif',
                    'par rapport à l\'ancien document, les informations ont-elles évolué',
                    'par rapport à l\'ancien profil, les informations ont-elles évolué',
                    'Le document a-t-il été régularisé lors de la mise à jour ?'
                ];
                
                // Vérifier si la question fait partie des cas où "Non" est acceptable
                const isAcceptableNo = acceptableNoQuestions.some(acceptableQuestion => 
                    questionText.includes(acceptableQuestion)
                );
                
                if (isAcceptableNo) {
                    return true; // "Non" est acceptable pour ces questions
                }
                
                // Pour les autres questions, "Non" indique généralement une anomalie
                return false;
            }
        }
        
        // Par défaut, considérer comme conforme si pas d'indication contraire
        return true;
    }

    completeDocument() {
        const docConfig = this.documentsConfig[this.currentDocument];
    
        // Restaurer les questions originales si elles ont été sauvegardées
        if (docConfig.originalQuestions) {
            docConfig.questions = docConfig.originalQuestions;
            delete docConfig.originalQuestions;
        }
        
        this.documentsState[this.currentDocument].status = 'completed';
        this.documentsState[this.currentDocument].completedQuestions = 
            this.documentsConfig[this.currentDocument].questions.length;
        
        Utils.debugLog(`Document ${this.currentDocument} terminé`);
        
        this.showDocumentControlInterface();
        
        const docName = this.documentsConfig[this.currentDocument].name;
        Utils.showNotification(`Document ${docName} terminé avec succès`, 'success');
    }

    cancelQuestion() {
        this.showDocumentControlInterface();
    }

    updateControlButtons() {
        const buttonsContainer = document.getElementById('control-buttons');
        if (!buttonsContainer) return;

        // Vérifier si nous sommes actuellement dans l'interface de contrôle documentaire
        const documentControlSection = document.getElementById('document-control-section');
        const isInDocumentControl = documentControlSection && 
                                documentControlSection.style.display !== 'none' && 
                                !documentControlSection.classList.contains('hidden');

        // Si nous ne sommes pas dans l'interface de contrôle, ne pas afficher les informations de progression
        if (!isInDocumentControl) {
            buttonsContainer.innerHTML = `
                <div class="btn-group">
                    <button class="btn btn-secondary" onclick="window.documentController?.returnToSample()">
                        Retour aux contrôles
                    </button>
                </div>
            `;
            return;
        }

        // Code pour l'interface de contrôle documentaire uniquement
        const allCompleted = Object.values(this.documentsState).every(doc => doc.status === 'completed');
        const completedCount = Object.values(this.documentsState).filter(doc => doc.status === 'completed').length;
        const totalCount = Object.values(this.documentsState).length;

        buttonsContainer.innerHTML = `
            <div class="control-progress">
                Documents terminés : ${completedCount}/${totalCount}
            </div>
            <div class="btn-group">
                <button class="btn btn-secondary" onclick="window.documentController?.returnToSample()">
                    Retour à l'échantillon
                </button>
                <button class="btn btn-success ${allCompleted ? '' : 'disabled'}" 
                        onclick="window.documentController?.completeControl()"
                        ${allCompleted ? '' : 'disabled'}>
                    Contrôle terminé
                </button>
                <button class="btn btn-danger" onclick="window.documentController?.suspendControl()">
                    ⏸️ Suspendre
                </button>
            </div>
        `;
    }

    returnToSample() {
        Utils.showSection('sample-selection-section');
    }

    completeControl() {
        const allCompleted = Object.values(this.documentsState).every(doc => doc.status === 'completed');
    
        if (!allCompleted) {
            Utils.showNotification('Veuillez terminer tous les documents avant de finaliser le contrôle', 'error');
            return;
        }
    
        // NOUVEAU : Récupérer les infos de suspension AVANT la génération du résumé
        const dossierKey = this.generateDossierKey(this.currentDossier);
        const controlType = this.currentControl.type;
        const suspendedControl = window.persistenceManager?.getSuspendedControl(dossierKey, controlType);
    
        const wasSuspended = this.isResumingControl && this.currentControlId;
        const suspendedInfo = wasSuspended ? {
            suspendedAt: new Date(), // ou récupérer la vraie date
            suspendReason: "Contrôle repris après suspension"
        } : null;
        
        // Supprimer le contrôle suspendu s'il existait
        if (wasSuspended) {
            const dossierKey = this.generateDossierKey(this.currentDossier);
            const controlType = this.currentControl.type;
            window.persistenceManager?.removeSuspendedControl(dossierKey, controlType);
        }
        
        const summary = this.generateControlSummary(wasSuspended, suspendedInfo);
    
        if (this.manualControlMode) {
            this.completeCurrentManualDossier();
        } else {
            // MODIFIÉ : Passer les infos de suspension dans le résumé
            const summary = this.generateControlSummary(wasSuspended, suspendedControl);
            
            window.dispatchEvent(new CustomEvent('controlCompleted', {
                detail: summary
            }));
            
            Utils.showSection('automatic-control-section');
        }
    }

    completeCurrentManualDossier() {
    // Générer le résumé pour le dossier actuel
    const currentResult = this.generateControlSummary();
    
    // Ajouter aux résultats
    this.manualControlResults.push(currentResult);
    
    Utils.debugLog(`Dossier ${this.currentDossierIndex + 1} terminé: ${currentResult.dossier.client}`);
    
    // Sauvegarder ce résultat individuellement
    window.dispatchEvent(new CustomEvent('controlCompleted', {
        detail: currentResult
    }));
    
    // Passer au dossier suivant
    this.currentDossierIndex++;
    this.resetDocumentStateForNext();
    
    // Continuer avec le prochain dossier
    this.startNextDossierControl();
}

resetDocumentStateForNext() {
    // Réinitialiser l'état pour le prochain dossier
    this.documentsState = {};
    this.currentDocument = null;
    this.currentQuestionIndex = 0;
    this.documentResponses = {};
    this.currentJustificationResponse = null;
}

completeManualControl() {
    Utils.debugLog('=== CONTRÔLE MANUEL TERMINÉ ===');
    Utils.debugLog(`${this.manualControlResults.length} dossiers contrôlés`);
    
    const endTime = new Date();
    const duration = endTime - this.manualControlStartTime;
    
    // Générer le rapport consolidé
    const consolidatedReport = {
        controlType: this.manualControlDefinition.name,
        startTime: this.manualControlStartTime,
        endTime: endTime,
        duration: duration,
        totalDossiers: this.manualSelectedDossiers.length,
        completedDossiers: this.manualControlResults.length,
        results: this.manualControlResults,
        summary: this.generateManualControlSummary()
    };
    
    // Afficher le résumé final
    this.showManualControlSummary(consolidatedReport);
    
    // Réinitialiser le mode manuel
    this.resetManualControlMode();
}

generateManualControlSummary() {
    const totalDossiers = this.manualControlResults.length;
    if (totalDossiers === 0) return {};
    
    const totalAnomalies = this.manualControlResults.reduce((sum, result) => 
        sum + (result.obligatoryIssuesCount || 0), 0);
    
    const conformeDossiers = this.manualControlResults.filter(result => 
        (result.obligatoryIssuesCount || 0) === 0).length;
    
    const nonConformeDossiers = totalDossiers - conformeDossiers;
    const tauxConformite = Math.round((conformeDossiers / totalDossiers) * 100);
    
    return {
        totalDossiers,
        conformeDossiers,
        nonConformeDossiers,
        totalAnomalies,
        tauxConformite
    };
}

showManualControlSummary(consolidatedReport) {
    Utils.showSection('manual-control-summary-section');
    this.populateManualSummaryInterface(consolidatedReport);
}

populateManualSummaryInterface(report) {
    const summary = report.summary;
    
    // Mise à jour des statistiques
    const stats = {
        'summary-total-dossiers': summary.totalDossiers || 0,
        'summary-conformes': summary.conformeDossiers || 0,
        'summary-non-conformes': summary.nonConformeDossiers || 0,
        'summary-taux-conformite': `${summary.tauxConformite || 0}%`,
        'summary-total-anomalies': summary.totalAnomalies || 0
    };
    
    Object.entries(stats).forEach(([id, value]) => {
        const element = document.getElementById(id);
        if (element) element.textContent = value;
    });
    
    // Mise à jour des informations du contrôle
    const duration = this.formatDuration(report.duration);
    const controlInfo = {
        'summary-control-type': report.controlType,
        'summary-duration': duration,
        'summary-start-time': report.startTime.toLocaleString('fr-FR'),
        'summary-end-time': report.endTime.toLocaleString('fr-FR')
    };
    
    Object.entries(controlInfo).forEach(([id, value]) => {
        const element = document.getElementById(id);
        if (element) element.textContent = value;
    });
    
    // Générer le tableau détaillé
    this.generateManualResultsTable(report.results);
}

formatDuration(milliseconds) {
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
        return `${hours}h ${minutes % 60}min`;
    } else if (minutes > 0) {
        return `${minutes}min ${seconds % 60}s`;
    } else {
        return `${seconds}s`;
    }
}

generateManualResultsTable(results) {
    const tbody = document.getElementById('manual-results-tbody');
    if (!tbody) return;
    
    tbody.innerHTML = results.map((result, index) => {
        const dossier = result.dossier;
        const isConforme = (result.obligatoryIssuesCount || 0) === 0;
        const documentsInfo = result.documents ? 
            `${Object.values(result.documents).filter(d => d.status === 'completed').length}/${Object.keys(result.documents).length}` : 
            '0/0';
        
        return `
            <tr class="${isConforme ? 'row-conforme' : 'row-non-conforme'}">
                <td><strong>${dossier.client}</strong></td>
                <td>${dossier.codeDossier || 'N/A'}</td>
                <td>${dossier.conseiller || 'N/A'}</td>
                <td>${dossier.montant || 'N/A'}</td>
                <td><span class="badge secondary">${documentsInfo}</span></td>
                <td><span class="badge ${result.obligatoryIssuesCount > 0 ? 'non' : 'oui'}">${result.obligatoryIssuesCount || 0}</span></td>
                <td><span class="badge ${isConforme ? 'oui' : 'non'}">${isConforme ? 'CONFORME' : 'NON CONFORME'}</span></td>
                <td>
                    <button class="btn btn-sm btn-secondary" onclick="window.documentController?.exportSingleManualResult(${index})">
                        📊 Export
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

    generateControlSummary(wasSuspended = false, suspendedControl = null) {
        const summary = {
            dossier: this.currentDossier,
            control: this.currentControl,
            documents: this.documentsState,
            responses: this.documentResponses,
            completedAt: new Date(),
            obligatoryIssuesCount: this.countObligatoryIssues(),
            wasSuspended: wasSuspended,
            suspensionInfo: suspendedControl ? {
                suspendedAt: suspendedControl.suspendedAt,
                suspendReason: suspendedControl.suspendReason
            } : null
        };

        // NOUVEAU : Informations spécifiques aux révisions
        if (this.isRevisionMode) {
            summary.isRevision = true;
            summary.parentControlId = this.originalControlId;
            summary.revisionDate = new Date();
            summary.modifiedFields = Array.from(this.modifiedFields);
            summary.totalModifications = this.modifiedFields.size;
            
            Utils.debugLog(`Révision terminée: ${summary.totalModifications} modification(s) apportée(s)`);
        }

        // Notifier l'historique
        window.dispatchEvent(new CustomEvent('controlCompleted', {
            detail: summary
        }));

        window.persistenceManager?.saveControl(summary);
        
        Utils.showSection('automatic-control-section');
        return summary;
    }

    countObligatoryIssues() {
        let count = 0;
        Object.values(this.documentResponses).forEach(docResponses => {
            Object.values(docResponses).forEach(response => {
                if ((response.answer === 'Non' || response.quality === 'Non conforme') && 
                    response.obligation === 'Obligatoire') {
                    count++;
                }
            });
        });
        return count;
    }

    exportControlResults(summary) {
        // Utiliser le formatage Excel avancé
        const ExcelFormatter = window.ExcelFormatter || this.createBasicExcelFormatter();
        const formatter = new ExcelFormatter();
        const fileName = Utils.generateFileName(`Controle_Documentaire_${summary.dossier.codeDossier || 'Sans_Code'}`);
        
        try {
            formatter.exportFormattedControl(summary, fileName);
            Utils.showNotification('Contrôle exporté avec mise en forme professionnelle !', 'success');
        } catch (error) {
            // Fallback vers l'ancienne méthode en cas d'erreur
            console.error('Erreur formatage Excel:', error);
            Utils.showNotification('Export réalisé en mode simple', 'warning');
            
            // Code original en fallback
            const exportData = {
                'Date de contrôle': summary.completedAt.toLocaleDateString('fr-FR'),
                'Type de contrôle': summary.control.definition.name,
                'Client': summary.dossier.client,
                'Code dossier': summary.dossier.codeDossier,
                'Conseiller': summary.dossier.conseiller,
                'Montant': summary.dossier.montant,
                'Éléments obligatoires manquants': summary.obligatoryIssuesCount,
                'Statut': 'Terminé'
            };

            Object.entries(summary.documents).forEach(([docId, docState]) => {
                const docConfig = this.documentsConfig[docId];
                const docResponses = summary.responses[docId] || {};
                
                let docIssues = [];
                let docJustifications = [];
                
                Object.values(docResponses).forEach(response => {
                    if (response.answer === 'Non' || response.quality === 'Non conforme') {
                        docIssues.push(response.question);
                        if (response.justification) {
                            docJustifications.push(response.justification);
                        }
                    } else if (response.quality === 'Partiellement conforme') {
                        docIssues.push(`${response.question} (partiellement conforme)`);
                    }
                });
                
                exportData[`${docConfig.name} - Présent`] = docState.status === 'completed' ? 'Oui' : 'Non';
                exportData[`${docConfig.name} - Problèmes`] = docIssues.join('; ');
                exportData[`${docConfig.name} - Justifications`] = docJustifications.join('; ');
            });

            if (window.fileHandler) {
                window.fileHandler.exportToExcel([exportData], fileName);
            }
        }
    }

    createBasicExcelFormatter() {
        // Formatter basique en cas d'absence du formatage avancé
        return {
            exportFormattedControl: (summary, fileName) => {
                const exportData = [{
                    'Date': summary.completedAt.toLocaleDateString('fr-FR'),
                    'Type': summary.control.definition.name,
                    'Client': summary.dossier.client,
                    'Statut': summary.obligatoryIssuesCount === 0 ? 'CONFORME' : 'NON CONFORME',
                    'Anomalies': summary.obligatoryIssuesCount
                }];
                
                if (window.fileHandler) {
                    window.fileHandler.exportToExcel(exportData, fileName);
                }
            }
        };
    }

    showJustificationModal(response) {
        const modal = document.createElement('div');
        modal.className = 'justification-modal';
        modal.innerHTML = `
            <div class="modal-overlay">
                <div class="modal-content">
                    <h3>Justification requise</h3>
                    <p>Vous avez indiqué une <strong>non-conformité</strong> pour :</p>
                    <div class="question-recap">${response.question}</div>
                    
                    <div class="justification-form">
                        <label>Pourquoi ? (Précisez le problème détecté)</label>
                        <textarea id="justification-text" rows="4" placeholder="Expliquer la raison de la non-conformité..."></textarea>
                        
                        <div class="obligation-level">
                            <label>Cet élément est :</label>
                            <div class="radio-group">
                                <label class="radio-option">
                                    <input type="radio" name="obligation" value="Obligatoire">
                                    <span>Obligatoire</span>
                                </label>
                                <label class="radio-option">
                                    <input type="radio" name="obligation" value="Optionnel">
                                    <span>Optionnel</span>
                                </label>
                            </div>
                        </div>
                    </div>
                    
                    <div class="modal-actions">
                        <button class="btn btn-secondary" onclick="window.documentController?.cancelJustification()">
                            Annuler
                        </button>
                        <button class="btn btn-primary" onclick="window.documentController?.saveJustification()">
                            Confirmer
                        </button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        this.currentJustificationResponse = response;
        
        setTimeout(() => {
            const textarea = document.getElementById('justification-text');
            if (textarea) textarea.focus();
        }, 100);
    }

    saveJustification() {
        const justificationText = document.getElementById('justification-text');
        const obligationRadio = document.querySelector('input[name="obligation"]:checked');
        
        if (!justificationText || !justificationText.value.trim()) {
            Utils.showNotification('Veuillez fournir une justification', 'error');
            return;
        }
        
        if (!obligationRadio) {
            Utils.showNotification('Veuillez indiquer si cet élément est obligatoire ou optionnel', 'error');
            return;
        }

        this.currentJustificationResponse.justification = justificationText.value.trim();
        this.currentJustificationResponse.obligation = obligationRadio.value;

        this.saveResponse(this.currentJustificationResponse);
        this.closeJustificationModal();
        this.moveToNextQuestion();
    }

    cancelJustification() {
        this.closeJustificationModal();
    }

    closeJustificationModal() {
        const modal = document.querySelector('.justification-modal');
        if (modal) {
            modal.remove();
        }
        this.currentJustificationResponse = null;
    }

    addHelpBubbleStyles() {
        if (document.getElementById('help-bubble-styles')) return;
        
        const style = document.createElement('style');
        style.id = 'help-bubble-styles';
        style.textContent = `
            .help-icon {
                cursor: pointer;
                margin-left: 8px;
                font-size: 1.1rem;
                opacity: 0.7;
                transition: opacity 0.3s ease;
            }
            
            .help-icon:hover {
                opacity: 1;
            }
            
            .help-bubble {
                background: #f8f9fa;
                border: 1px solid #e9ecef;
                border-radius: 6px;
                padding: 10px;
                margin-top: 8px;
                font-size: 0.9rem;
                color: #495057;
                line-height: 1.4;
                box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            }
            
            .quality-checks {
                margin-top: 15px;
            }
            
            .check-item {
                margin-bottom: 10px;
                padding: 8px;
                background: #f8f9fa;
                border-radius: 4px;
            }
            
            .check-item label {
                margin-bottom: 5px;
                font-weight: 500;
            }
            
            .checkbox-label {
                display: flex;
                align-items: center;
                cursor: pointer;
                font-weight: normal !important;
            }
            
            .checkbox-label input[type="checkbox"] {
                margin-right: 8px;
                transform: scale(1.1);
            }
            
            .radio-group {
                display: flex;
                flex-wrap: wrap;
                gap: 15px;
                margin-top: 8px;
            }
            
            .radio-option {
                display: flex;
                align-items: center;
                cursor: pointer;
                padding: 8px 12px;
                border: 1px solid #e9ecef;
                border-radius: 6px;
                transition: all 0.3s ease;
                background: white;
            }
            
            .radio-option:hover {
                border-color: #d4af37;
                background: #fefefe;
            }
            
            .radio-option input[type="radio"] {
                margin-right: 6px;
                transform: scale(1.1);
            }
        `;
        
        document.head.appendChild(style);
    }

    getCurrentControl() {
        return {
            dossier: this.currentDossier,
            control: this.currentControl,
            documentsState: this.documentsState,
            responses: this.documentResponses
        };
    }

    getControlProgress() {
        const totalDocs = Object.keys(this.documentsState).length;
        const completedDocs = Object.values(this.documentsState).filter(doc => doc.status === 'completed').length;
        
        return {
            completed: completedDocs,
            total: totalDocs,
            percentage: Math.round((completedDocs / totalDocs) * 100)
        };
    }

    // Méthode pour diagnostiquer l'état du contrôle
    diagnoseControl() {
        Utils.debugLog('=== DIAGNOSTIC CONTROLE DOCUMENTAIRE ===');
        Utils.debugLog(`Dossier en cours: ${this.currentDossier ? this.currentDossier.client : 'Aucun'}`);
        Utils.debugLog(`Type de contrôle: ${this.currentControl ? this.currentControl.type : 'Aucun'}`);
        Utils.debugLog(`Documents état: ${Object.keys(this.documentsState).length}`);
        Utils.debugLog(`Document actuel: ${this.currentDocument || 'Aucun'}`);
        Utils.debugLog(`Question actuelle: ${this.currentQuestionIndex}`);
        
        if (this.documentsState) {
            Object.entries(this.documentsState).forEach(([docId, state]) => {
                Utils.debugLog(`  Doc ${docId}: ${state.status} (${state.completedQuestions}/${state.totalQuestions})`);
            });
        }
        
        return this.getCurrentControl();
    }

    pauseManualControl() {
    // Fonctionnalité de pause (optionnelle)
    Utils.showNotification('Contrôle mis en pause', 'info');
    // Ici vous pourriez sauvegarder l'état et permettre de reprendre plus tard
}

    cancelManualControl() {
        const confirmed = confirm(
            `Êtes-vous sûr de vouloir annuler le contrôle manuel ?\n\n` +
            `${this.manualControlResults.length} dossier(s) déjà contrôlé(s) seront conservés.`
        );
        
        if (confirmed) {
            Utils.showNotification('Contrôle manuel annulé', 'warning');
            this.resetManualControlMode();
            Utils.showSection('automatic-control-section');
        }
    }

    resetManualControlMode() {
        this.manualControlMode = false;
        this.manualSelectedDossiers = [];
        this.currentManualControlType = null;
        this.currentDossierIndex = 0;
        this.manualControlResults = [];
        this.manualControlStartTime = null;
        this.manualControlDefinition = null;
        this.resetDocumentStateForNext();
    }

    exportSingleManualResult(resultIndex) {
        if (resultIndex >= this.manualControlResults.length) return;
        
        const result = this.manualControlResults[resultIndex];
        this.exportControlResults(result);
    }

    exportAllManualResults() {
        if (this.manualControlResults.length === 0) {
            Utils.showNotification('Aucun résultat à exporter', 'warning');
            return;
        }
        
        // Créer un export consolidé
        const exportData = this.manualControlResults.map((result, index) => ({
            'N°': index + 1,
            'Date': result.completedAt ? result.completedAt.toLocaleDateString('fr-FR') : new Date().toLocaleDateString('fr-FR'),
            'Type Contrôle': this.manualControlDefinition?.name || 'Manuel',
            'Client': result.dossier.client,
            'Code Dossier': result.dossier.codeDossier,
            'Conseiller': result.dossier.conseiller,
            'Montant': result.dossier.montant,
            'Domaine': result.dossier.domaine,
            'Documents Contrôlés': result.documents ? 
                `${Object.values(result.documents).filter(d => d.status === 'completed').length}/${Object.keys(result.documents).length}` : 
                '0/0',
            'Anomalies Majeures': result.obligatoryIssuesCount || 0,
            'Conformité': (result.obligatoryIssuesCount || 0) === 0 ? 'CONFORME' : 'NON CONFORME',
            'Remarques': `Contrôle manuel effectué le ${new Date().toLocaleDateString('fr-FR')}`
        }));
        
        const fileName = Utils.generateFileName(`Controle_Manuel_${this.currentManualControlType || 'Multiple'}`);
        
        if (window.fileHandler) {
            window.fileHandler.exportToExcel(exportData, fileName);
            Utils.showNotification(`Export réalisé: ${fileName}`, 'success');
        }
    }

     showResumeControlDialog(suspendedControl) {
        const modal = document.createElement('div');
        modal.className = 'justification-modal';
        modal.innerHTML = `
            <div class="modal-overlay">
                <div class="modal-content">
                    <h3>🔄 Contrôle suspendu détecté</h3>
                    <div class="resume-info">
                        <p>Un contrôle <strong>${suspendedControl.type}</strong> a été suspendu pour ce dossier le <strong>${new Date(suspendedControl.suspendedAt).toLocaleDateString('fr-FR')}</strong>.</p>
                        <div class="suspend-details">
                            <p><strong>Progress:</strong> ${Object.keys(suspendedControl.responses || {}).length} question(s) déjà répondue(s)</p>
                            <p><strong>Dernier document:</strong> ${this.getDocumentName(suspendedControl.lastDocument) || 'Non défini'}</p>
                            ${suspendedControl.suspendReason ? `<p><strong>Raison:</strong> ${suspendedControl.suspendReason}</p>` : ''}
                        </div>
                    </div>
                    
                    <div class="modal-actions">
                        <button class="btn btn-primary" onclick="window.documentController?.resumeControl('${suspendedControl.id}')">
                            🔄 Reprendre le contrôle
                        </button>
                        <button class="btn btn-warning" onclick="window.documentController?.startNewControl()">
                            🆕 Recommencer à zéro
                        </button>
                        <button class="btn btn-secondary" onclick="window.documentController?.cancelControlStart()">
                            ❌ Annuler
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
    }

    initializeNewControl(controlType) {
        this.currentControlId = `control_${Date.now()}`;
        this.isResumingControl = false;
        this.initializeDocumentsForControl(controlType);
    }

    // NOUVEAU : Reprendre un contrôle suspendu
    resumeControl(suspendedControlId) {
        this.closeResumeDialog();
        
        const suspendedControl = window.persistenceManager?.getSuspendedControlById(suspendedControlId);
        if (!suspendedControl) {
            Utils.showNotification('Contrôle suspendu introuvable', 'error');
            return;
        }
        
        Utils.debugLog(`=== REPRISE CONTRÔLE SUSPENDU ${suspendedControlId} ===`);
        
        // Restaurer l'état du contrôle
        this.currentControlId = suspendedControlId;
        this.isResumingControl = true;
        this.documentsState = suspendedControl.documents || {};
        this.documentResponses = suspendedControl.responses || {};
        
        // Restaurer la progression
        if (suspendedControl.lastDocument && suspendedControl.lastQuestionIndex !== undefined) {
            this.currentDocument = suspendedControl.lastDocument;
            this.currentQuestionIndex = suspendedControl.lastQuestionIndex;
        }
        
        this.showDocumentControlInterface();
        Utils.showNotification('Contrôle repris avec succès', 'success');
    }

    // NOUVEAU : Recommencer un contrôle à zéro
    startNewControl() {
        this.closeResumeDialog();
        
        // Supprimer l'ancien contrôle suspendu
        const dossierKey = this.generateDossierKey(this.currentDossier);
        window.persistenceManager?.removeSuspendedControl(dossierKey, this.currentControl.type);
        
        this.initializeNewControl(this.currentControl.type);
        this.showDocumentControlInterface();
        Utils.showNotification('Nouveau contrôle démarré', 'info');
    }

    // NOUVEAU : Annuler le démarrage du contrôle
    cancelControlStart() {
        this.closeResumeDialog();
        Utils.showSection('automatic-control-section');
    }

    // NOUVEAU : Fermer le dialog de reprise
    closeResumeDialog() {
        const modal = document.querySelector('.justification-modal');
        if (modal) {
            modal.remove();
        }
    }

    // NOUVEAU : Pré-remplir les réponses existantes
    prefillExistingResponses() {
        const existingResponse = this.documentResponses[this.currentDocument]?.[this.currentQuestionIndex];
        if (!existingResponse) return;

        // Pré-remplir les champs selon le type de réponse
        if (existingResponse.answer) {
            const responseRadio = document.querySelector(`input[name="response"][value="${existingResponse.answer}"]`);
            if (responseRadio) {
                responseRadio.checked = true;
                // Déclencher l'événement pour afficher les champs de qualité si nécessaire
                responseRadio.dispatchEvent(new Event('change'));
            }
        }

        if (existingResponse.quality) {
            setTimeout(() => {
                const qualityRadio = document.querySelector(`input[name="quality"][value="${existingResponse.quality}"]`);
                if (qualityRadio) {
                    qualityRadio.checked = true;
                }
            }, 100);
        }

        // Pré-remplir les champs texte
        if (existingResponse.answer && existingResponse.answer !== 'Oui' && existingResponse.answer !== 'Non' && existingResponse.answer !== 'NC') {
            const textInput = document.getElementById('text-response');
            if (textInput) {
                textInput.value = existingResponse.answer;
            }
        }
    }

    // NOUVEAU : Suspendre le contrôle avec commentaire optionnel
    suspendControl() {
        const modal = document.createElement('div');
        modal.className = 'justification-modal';
        modal.innerHTML = `
            <div class="modal-overlay">
                <div class="modal-content">
                    <h3>⏸️ Suspendre le contrôle</h3>
                    <p>Le contrôle sera sauvegardé et vous pourrez le reprendre plus tard.</p>
                    <p><strong>Dossier:</strong> ${this.currentDossier.client} (${this.currentControl.definition.name})</p>
                    
                    <div class="suspend-form">
                        <label>Commentaire (optionnel):</label>
                        <textarea id="suspend-reason" rows="3" placeholder="Raison de la suspension, éléments manquants, etc."></textarea>
                    </div>
                    
                    <div class="modal-actions">
                        <button class="btn btn-warning" onclick="window.documentController?.confirmSuspendControl()">
                            ⏸️ Confirmer la suspension
                        </button>
                        <button class="btn btn-secondary" onclick="window.documentController?.closeSuspendDialog()">
                            ❌ Continuer le contrôle
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
    }

    // NOUVEAU : Confirmer la suspension
    confirmSuspendControl() {
        const reasonTextarea = document.getElementById('suspend-reason');
        const suspendReason = reasonTextarea ? reasonTextarea.value.trim() : '';
        
        const dossierKey = this.generateDossierKey(this.currentDossier);
        
        const suspendedControl = {
            id: this.currentControlId || `suspended_${Date.now()}`,
            dossierKey: dossierKey,
            dossier: this.currentDossier,
            control: this.currentControl,
            type: this.currentControl.type,
            documents: this.documentsState,
            responses: this.documentResponses,
            lastDocument: this.currentDocument,
            lastQuestionIndex: this.currentQuestionIndex,
            suspendedAt: new Date(),
            suspendReason: suspendReason,
            status: 'suspended'
        };
        
        // Sauvegarder le contrôle suspendu
        if (window.persistenceManager) {
            window.persistenceManager.saveSuspendedControl(suspendedControl);
        }
        
        this.closeSuspendDialog();
        this.resetControlState();
        
        Utils.showNotification('Contrôle suspendu et sauvegardé', 'warning');
        Utils.showSection('automatic-control-section');
        
        // Notifier les autres modules de la suspension
        window.dispatchEvent(new CustomEvent('controlSuspended', {
            detail: suspendedControl
        }));
    }

    // NOUVEAU : Fermer le dialog de suspension
    closeSuspendDialog() {
        const modal = document.querySelector('.justification-modal');
        if (modal) {
            modal.remove();
        }
    }

    // NOUVEAU : Méthode pour diagnostiquer les contrôles suspendus
    diagnoseSuspendedControls() {
        if (!window.persistenceManager) {
            Utils.debugLog('PersistenceManager non disponible');
            return;
        }

        const suspended = window.persistenceManager.getSuspendedControls();
        Utils.debugLog(`=== CONTRÔLES SUSPENDUS (${suspended.length}) ===`);
        
        suspended.forEach(control => {
            const daysSuspended = Math.floor((new Date() - new Date(control.suspendedAt)) / (1000 * 60 * 60 * 24));
            Utils.debugLog(`${control.dossier.client} (${control.type}) - ${daysSuspended} jours`);
            
            if (daysSuspended >= 14) {
                Utils.showNotification(
                    `⚠️ Contrôle suspendu depuis ${daysSuspended} jours: ${control.dossier.client} (${control.type})`,
                    'warning'
                );
            }
        });
    }

    determineOperationDocuments(dossier) {
    const baseDocuments = [1, 2, 4, 6, 10, 11, 13, 19, 20, 99]; // Documents de base pour toute opération
    
    // Analyser le type d'opération depuis les données du dossier
    const typeOperation = this.extractOperationType(dossier);
    
    Utils.debugLog(`Type d'opération détecté: ${typeOperation}`);
    
    switch (typeOperation) {
        case 'versement':
        case 'versement_initial':
        case 'versement_complementaire':
        case 'transfert_entrant':
            // Pour les versements : origine des fonds obligatoire
            return [...baseDocuments, 12]; // Ajouter document 12 (Origine des fonds)
            
        case 'rachat':
        case 'rachat_partiel':
        case 'rachat_total':
        case 'transfert_sortant':
            // Pour les rachats : destination des fonds obligatoire
            return [...baseDocuments, 14]; // Ajouter document 14 (Destination des fonds)
            
        case 'arbitrage':
            // Pour les arbitrages : aucun mouvement de fonds externe
            return baseDocuments; // Pas besoin de doc 12 ou 14
            
        case 'avance':
            // Pour les avances : destination des fonds
            return [...baseDocuments, 14];
            
        default:
            // Par défaut : inclure les deux pour être sûr
            Utils.debugLog('Type d\'opération non reconnu, inclusion des deux documents');
            return [...baseDocuments, 12, 14];
    }
}

    // AJOUTER cette méthode pour extraire le type d'opération depuis le dossier
    extractOperationType(dossier) {
        // Chercher dans différents champs possibles
        const typeActe = (dossier.typeActe || '').toLowerCase();
        const contrat = (dossier.contrat || '').toLowerCase();
        const etatBO = (dossier.etatBO || '').toLowerCase();
        
        // Mots-clés pour versements
        const versementKeywords = ['versement', 'apport', 'entrée', 'souscription', 'dépôt'];
        // Mots-clés pour rachats
        const rachatKeywords = ['rachat', 'retrait', 'sortie', 'liquidation'];
        // Mots-clés pour arbitrages
        const arbitrageKeywords = ['arbitrage', 'switch', 'réallocation'];
        // Mots-clés pour transferts
        const transfertKeywords = ['transfert', 'portabilité'];
        // Mots-clés pour avances
        const avanceKeywords = ['avance', 'prêt'];
        
        // Analyser le type d'acte en priorité
        if (versementKeywords.some(keyword => typeActe.includes(keyword))) {
            if (typeActe.includes('initial') || typeActe.includes('ouverture')) {
                return 'versement_initial';
            }
            return 'versement';
        }
        
        if (rachatKeywords.some(keyword => typeActe.includes(keyword))) {
            if (typeActe.includes('partiel')) {
                return 'rachat_partiel';
            } else if (typeActe.includes('total')) {
                return 'rachat_total';
            }
            return 'rachat';
        }
        
        if (arbitrageKeywords.some(keyword => typeActe.includes(keyword))) {
            return 'arbitrage';
        }
        
        if (transfertKeywords.some(keyword => typeActe.includes(keyword))) {
            if (typeActe.includes('entrant') || typeActe.includes('arrivée')) {
                return 'transfert_entrant';
            } else if (typeActe.includes('sortant') || typeActe.includes('départ')) {
                return 'transfert_sortant';
            }
            return 'transfert_entrant'; // Par défaut
        }
        
        if (avanceKeywords.some(keyword => typeActe.includes(keyword))) {
            return 'avance';
        }
        
        // Si pas trouvé dans typeActe, chercher dans d'autres champs
        if (versementKeywords.some(keyword => contrat.includes(keyword) || etatBO.includes(keyword))) {
            return 'versement';
        }
        
        if (rachatKeywords.some(keyword => contrat.includes(keyword) || etatBO.includes(keyword))) {
            return 'rachat';
        }
        
        // Par défaut, si on ne peut pas déterminer
        return 'unknown';
    }

    // AJOUTER une méthode pour obtenir des informations contextuelles sur l'opération
    getOperationContext() {
        if (!this.currentDossier) return null;
        
        const typeOperation = this.extractOperationType(this.currentDossier);
        const montant = this.currentDossier.montant || '';
        
        return {
            type: typeOperation,
            isVersement: ['versement', 'versement_initial', 'versement_complementaire', 'transfert_entrant'].includes(typeOperation),
            isRachat: ['rachat', 'rachat_partiel', 'rachat_total', 'transfert_sortant', 'avance'].includes(typeOperation),
            isArbitrage: typeOperation === 'arbitrage',
            montant: montant,
            needsOriginFunds: ['versement', 'versement_initial', 'versement_complementaire', 'transfert_entrant'].includes(typeOperation),
            needsDestinationFunds: ['rachat', 'rachat_partiel', 'rachat_total', 'transfert_sortant', 'avance'].includes(typeOperation)
        };
    }

    // AJOUTER cette méthode pour afficher le contexte d'opération
    updateOperationContext() {
        const infoContainer = document.getElementById('dossier-info');
        if (!infoContainer || !this.currentControl || this.currentControl.type !== 'OPERATION') return;
        
        const operationContext = this.getOperationContext();
        if (!operationContext) return;
        
        // Ajouter une section contexte opération après les infos du dossier
        const contextHtml = `
            <div class="operation-context-card" style="margin-top: 20px;">
                <div class="operation-context-header">
                    <h4>🔄 Contexte de l'opération</h4>
                </div>
                <div class="operation-context-body">
                    <div class="context-details">
                        <div class="context-item">
                            <span class="context-label">Type d'opération :</span>
                            <span class="context-value">
                                ${operationContext.type.replace('_', ' ').toUpperCase()}
                                <span class="operation-type-indicator ${operationContext.type}">
                                    ${operationContext.isVersement ? 'VERSEMENT' : 
                                    operationContext.isRachat ? 'RACHAT' : 
                                    operationContext.isArbitrage ? 'ARBITRAGE' : 'AUTRE'}
                                </span>
                            </span>
                        </div>
                        <div class="context-item">
                            <span class="context-label">Documents requis :</span>
                            <span class="context-value">
                                ${operationContext.needsOriginFunds ? '📥 Origine des fonds' : ''}
                                ${operationContext.needsDestinationFunds ? '📤 Destination des fonds' : ''}
                                ${!operationContext.needsOriginFunds && !operationContext.needsDestinationFunds ? '⚙️ Documents standard uniquement' : ''}
                            </span>
                        </div>
                        <div class="context-item">
                            <span class="context-label">Montant :</span>
                            <span class="context-value">${operationContext.montant || 'Non renseigné'}</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // Insérer le contexte après les infos du dossier
        infoContainer.insertAdjacentHTML('beforeend', contextHtml);
    }

    addChecklistStyles() {
    if (document.getElementById('checklist-styles')) return;
    
    const style = document.createElement('style');
    style.id = 'checklist-styles';
    style.textContent = `
        .checklist-group {
        background: #f8f9fa;
        border-radius: 8px;
        padding: 20px;
        margin: 15px 0;
    }

    .checklist-container {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
        gap: 12px;
        margin: 15px 0;
        max-height: 300px;
        overflow-y: auto;
        border: 1px solid #e9ecef;
        border-radius: 6px;
        padding: 15px;
        background: white;
    }

    .checklist-item {
        display: flex;
        align-items: flex-start; /* Alignement en haut pour éviter les conflits */
        padding: 10px;
        border-radius: 4px;
        transition: background-color 0.2s ease;
        min-height: 44px; /* Hauteur minimum pour éviter les chevauchements */
    }

    .checklist-item:hover {
        background-color: #f1f3f4;
    }

    /* Style spécifique pour les checkboxes de la checklist */
    .checklist-item .checkbox-label {
        display: flex;
        align-items: flex-start;
        cursor: pointer;
        font-weight: normal !important;
        width: 100%;
        margin: 0;
        gap: 12px;
        line-height: 1.4;
    }

    .checklist-item input[type="checkbox"] {
        width: 18px;
        height: 18px;
        margin: 2px 0 0 0; /* Léger décalage vers le bas pour aligner avec la première ligne de texte */
        accent-color: #d4af37;
        flex-shrink: 0; /* Empêche la checkbox de se rétrécir */
        position: relative;
        z-index: 10; /* S'assurer que la checkbox est au-dessus */
    }

    .checklist-item .checkbox-text {
        flex: 1;
        font-size: 0.95rem;
        margin-top: 0;
        padding-top: 0;
        line-height: 1.4;
    }

    /* S'assurer que les radio buttons normaux ne sont pas affectés */
    .radio-group .radio-option {
        display: flex;
        align-items: center; /* Centré pour les radio buttons */
        cursor: pointer;
        padding: 8px 12px;
        border: 1px solid #e9ecef;
        border-radius: 6px;
        transition: all 0.3s ease;
        background: white;
        gap: 8px;
    }

    .radio-group input[type="radio"] {
        margin: 0;
        transform: scale(1.1);
        flex-shrink: 0;
    }

    .checklist-summary {
        margin-top: 15px;
        padding: 12px;
        border-radius: 6px;
        font-weight: 500;
        text-align: center;
        transition: all 0.3s ease;
    }

    .checklist-summary.no-missing {
        background-color: #d4edda;
        color: #155724;
        border: 1px solid #c3e6cb;
    }

    .checklist-summary.few-missing {
        background-color: #fff3cd;
        color: #856404;
        border: 1px solid #ffeaa7;
    }

    .checklist-summary.many-missing {
        background-color: #f8d7da;
        color: #721c24;
        border: 1px solid #f5c6cb;
    }

    .checklist-group > label {
        font-weight: 600;
        color: #495057;
        margin-bottom: 10px;
        display: block;
    }
    `;
    
    document.head.appendChild(style);
}

    // NOUVEAU : Initialiser les vérifications périodiques
    initializePeriodicChecks() {
        // Vérifier les contrôles suspendus toutes les heures
        setInterval(() => {
            this.diagnoseSuspendedControls();
        }, 60 * 60 * 1000); // 1 heure
        
        // Vérification initiale après 5 secondes
        setTimeout(() => {
            this.diagnoseSuspendedControls();
        }, 5000);
    }

    // NOUVEAU : Réinitialiser l'état du contrôle
    resetControlState() {
        this.currentDossier = null;
        this.currentControl = null;
        this.documentsState = {};
        this.currentDocument = null;
        this.currentQuestionIndex = 0;
        this.documentResponses = {};
        this.currentControlId = null;
        this.isResumingControl = false;
    }

    // Reset pour nouvelle session
    reset() {
        this.currentDossier = null;
        this.currentControl = null;
        this.documentsState = {};
        this.currentDocument = null;
        this.currentQuestionIndex = 0;
        this.documentResponses = {};
        this.currentJustificationResponse = null;
        
        // NOUVEAU : Réinitialiser les propriétés de révision
        this.isRevisionMode = false;
        this.originalControlId = null;
        this.originalResponses = {};
        this.modifiedFields = new Set();
        this.revisionStartTime = null;
        
        Utils.debugLog('DocumentController réinitialisé (révisions incluses)');
    }
}
































