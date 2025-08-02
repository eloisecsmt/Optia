// documentController.js - Version modifiée avec question "document présent" et tuile Zeendoc

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
    }

    // Méthode modifiée pour enlever FR et Profil Risques du contrôle CARTO_CLIENT
    getRequiredDocuments(controlType) {
        const documentSets = {
            'LCB-FT': [1, 2, 7, 8, 99], // FR, Profil Risques, CNI, Justificatif Domicile, Zeendoc
            'FINANCEMENT': [1, 2, 9, 10, 99], // FR, Profil Risques, Etude, RIB, Zeendoc  
            'CARTO_CLIENT': [4, 99], // Harvest, Zeendoc (FR et Profil Risques supprimés)
            'OPERATION': [1, 2, 6, 11, 10, 99], // FR, Profil Risques, LM Entrée en Relation, Convention RTO, RIB, Zeendoc
            'NOUVEAU_CLIENT': [1, 2, 3, 5, 6, 7, 8, 10, 99], // FR, Profil Risques, Profil ESG, FIL, LM Entrée en Relation, CNI, Justificatif Domicile, RIB, Zeendoc
            'CONTROLE_PPE': [1, 2, 7, 8, 9, 99], // FR, Profil Risques, CNI, Justificatif Domicile, Etude, Zeendoc
            'AUDIT_CIF': [2, 6, 11, 99], // Profil Risques, LM Entrée en Relation, Convention RTO, Zeendoc
            'REVUE_PERIODIQUE': [2, 3, 4, 99] // Profil Risques, Profil ESG, Carto Client, Zeendoc
        };

        return documentSets[controlType] || [1, 2, 7, 8, 99]; // Toujours inclure Zeendoc
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
                        skipIfNo: true // NOUVEAU : permet de passer les autres questions si "Non"
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
                        text: 'Est-ce que le document est entièrement complété ?',
                        type: 'boolean',
                        required: true,
                        help: 'Aucun champ obligatoire vide, toutes les sections renseignées',
                        qualityCheck: {
                            text: 'Les informations renseignées sont-elles cohérentes et complètes ?',
                            help: 'Pas d\'incohérences dans les dates, montants, statuts ou noms'
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
                        help: 'Questionnaire papier ou formulaire électronique RIC',
                        options: ['RIC (électronique)', 'Papier signé']
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
                        text: 'Est-ce que le document est entièrement complété ?',
                        type: 'boolean',
                        required: true,
                        help: 'Toutes les questions du profil de risque renseignées',
                        qualityCheck: {
                            text: 'Toutes les sections du questionnaire sont-elles cohérentes avec le profil client ?',
                            help: 'Réponses logiques entre expérience, objectifs et horizon'
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
                        text: 'La signature du conseiller est-elle présente ?',
                        type: 'boolean',
                        required: true,
                        help: 'Validation du profil par le conseiller',
                        qualityCheck: {
                            text: 'La signature atteste-t-elle de la validation du profil ?',
                            help: 'Signature avec date de validation clairement indiquée',
                            type: 'signature_conseiller'
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
                        skipIfNo: true
                    },
                    {
                        text: 'Quel est le type de document ?',
                        type: 'document_type',
                        required: true,
                        help: 'Questionnaire papier ou formulaire électronique ESG',
                        options: ['RIC (électronique)', 'Papier signé']
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
                name: 'Harvest',
                fullName: 'Système Harvest - Cartographie Client',
                questions: [
                    {
                        text: 'Est-ce que les informations sur la cartographie du client sont présentes dans Harvest ?',
                        type: 'boolean',
                        required: true,
                        help: 'Vérifiez si les informations de cartographie client sont présentes dans Harvest',
                        skipIfNo: true
                    },
                    {
                        text: 'Est-ce que toutes les informations générales du client sont bien remplies dans Harvest ?',
                        type: 'boolean',
                        required: true,
                        help: 'Vérifiez que les champs obligatoires du profil client sont complétés dans Harvest',
                        qualityCheck: {
                            text: 'Les informations sont-elles complètes et à jour ?',
                            help: 'Vérifiez la cohérence et l\'exhaustivité des données : nom, prénom, adresse, date de naissance, situation familiale, profession, etc.'
                        }
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
                        text: 'Quel est le niveau de vigilance client ?',
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
                        skipIfNo: true
                    },
                    {
                        text: 'Quel est le type de document ?',
                        type: 'document_type',
                        required: true,
                        help: 'Vérifiez si c\'est un document papier signé ou un formulaire électronique RIC pour la FIL',
                        options: ['RIC (électronique)', 'Papier signé']
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
                        text: 'Est-ce que le document est entièrement complété ?',
                        type: 'boolean',
                        required: true,
                        help: 'Toutes les sections de la FIL renseignées : informations légales, tarifs, conditions',
                        qualityCheck: {
                            text: 'Toutes les mentions légales obligatoires sont-elles présentes et complètes ?',
                            help: 'Vérification exhaustive : coordonnées, statuts, autorisations, tarification, conditions générales'
                        }
                    },
                    {
                        text: 'Les informations légales sont-elles à jour ?',
                        type: 'boolean',
                        required: true,
                        help: 'Coordonnées, statuts juridiques, autorisations et agréments actualisés',
                        qualityCheck: {
                            text: 'Les informations correspondent-elles à la situation juridique actuelle de l\'établissement ?',
                            help: 'Vérification : raison sociale, adresse siège, numéros d\'agrément, superviseurs'
                        }
                    },
                    {
                        text: 'La tarification est-elle clairement indiquée ?',
                        type: 'boolean',
                        required: true,
                        help: 'Grille tarifaire présente, lisible et exhaustive',
                        qualityCheck: {
                            text: 'La tarification est-elle transparente et conforme aux obligations d\'information ?',
                            help: 'Tarifs explicites, pas de frais cachés, conditions d\'application claires'
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
                        help: 'Document papier signé ou formulaire électronique pour la lettre de mission',
                        options: ['RIC (électronique)', 'Papier signé']
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
                            text: 'La date d\'entrée en relation est-elle cohérente avec le dossier ?',
                            help: 'Date de signature postérieure à l\'ouverture de compte et aux premiers échanges'
                        }
                    },
                    {
                        text: 'La signature du conseiller est-elle présente ?',
                        type: 'boolean',
                        required: true,
                        help: 'Engagement du conseiller sur la mission proposée',
                        qualityCheck: {
                            text: 'La signature formalise-t-elle l\'engagement de prestation de service ?',
                            help: 'Signature avec identification claire du conseiller et de ses responsabilités',
                            type: 'signature_conseiller'
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
                        text: 'Si c\'est un produit CIF, la signature d\'un CIF est-elle présente ?',
                        type: 'boolean',
                        required: true,
                        help: 'Pour les services d\'investissement, signature obligatoire d\'un Conseiller en Investissements Financiers',
                        qualityCheck: {
                            text: 'Le CIF est-il habilité pour les services proposés ?',
                            help: 'Vérification carte professionnelle CIF, spécialisation, habilitations ORIAS',
                            type: 'signature_cif'
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
                        skipIfNo: true
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
                            text: 'La date d\'expiration est-elle supérieure à 6 mois et le document en bon état ?',
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
                        skipIfNo: true
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
                        help: 'Justificatif récent (moins de 3 mois)',
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
                        skipIfNo: true
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
                        skipIfNo: true
                    },
                    {
                        text: 'Le RIB est-il présent et lisible ?',
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
                        skipIfNo: true
                    },
                    {
                        text: 'Quel est le type de document ?',
                        type: 'document_type',
                        required: true,
                        help: 'Convention papier signée ou accord électronique pour RTO',
                        options: ['RIC (électronique)', 'Papier signé']
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
                        text: 'Les conditions tarifaires sont-elles présentes et transparentes ?',
                        type: 'boolean',
                        required: true,
                        help: 'Grille tarifaire complète et transparente pour les services RTO',
                        qualityCheck: {
                            text: 'La tarification est-elle claire et exhaustive ?',
                            help: 'Frais de courtage, droits de garde, commissions explicites sans frais cachés'
                        }
                    },
                    {
                        text: 'Les informations sur les risques sont-elles présentes ?',
                        type: 'boolean',
                        required: true,
                        help: 'Document d\'information sur les risques (DISR) ou équivalent',
                        qualityCheck: {
                            text: 'L\'information sur les risques est-elle complète et compréhensible ?',
                            help: 'Risques détaillés par catégorie d\'instruments avec exemples concrets'
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
                        text: 'Si c\'est un produit CIF, la signature d\'un CIF est-elle présente ?',
                        type: 'boolean',
                        required: true,
                        help: 'Signature obligatoire d\'un CIF habilité pour les services d\'investissement',
                        qualityCheck: {
                            text: 'Le CIF dispose-t-il des habilitations pour la RTO sur les instruments proposés ?',
                            help: 'Vérification carte CIF, spécialisations (actions, obligations, OPCVM, etc.)',
                            type: 'signature_cif'
                        }
                    }
                ]
            },
            // NOUVEAU : Tuile Zeendoc pour tous les contrôles
            99: {
                id: 99,
                name: 'Zeendoc',
                fullName: 'Archivage Zeendoc',
                questions: [
                    {
                        text: 'Tous les documents sont-ils bien ajoutés dans Zeendoc ?',
                        type: 'boolean',
                        required: true,
                        help: 'Vérifiez que tous les documents du dossier client sont présents dans Zeendoc',
                        qualityCheck: {
                            text: 'Tous les documents obligatoires sont-ils archivés dans Zeendoc ?',
                            help: 'Vérification exhaustive : FR, profils, CNI, justificatifs, contrats, etc.'
                        }
                    },
                    {
                        text: 'Les documents sont-ils affectés au bon client dans Zeendoc ?',
                        type: 'boolean',
                        required: true,
                        help: 'Vérifiez que les documents sont correctement rattachés au dossier client dans Zeendoc',
                        qualityCheck: {
                            text: 'L\'affectation client est-elle correcte et cohérente ?',
                            help: 'Nom, prénom, numéro de dossier correspondent au client contrôlé'
                        }
                    },
                    {
                        text: 'Les documents sont-ils correctement indexés et classés ?',
                        type: 'boolean',
                        required: true,
                        help: 'Vérifiez que les documents sont bien indexés avec les bonnes métadonnées dans Zeendoc',
                        qualityCheck: {
                            text: 'L\'indexation permet-elle une recherche et un classement efficaces ?',
                            help: 'Types de documents, dates, catégories correctement renseignés'
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
    }

    startDocumentControl(dossier, control) {
        Utils.debugLog('=== DÉBUT CONTRÔLE DOCUMENTAIRE ===');
        Utils.debugLog(`Dossier: ${dossier.client}`);
        Utils.debugLog(`Type de contrôle: ${control.type}`);

        this.currentDossier = dossier;
        this.currentControl = control;
        
        this.initializeDocumentsForControl(control.type);
        this.showDocumentControlInterface();
    }

    initializeDocumentsForControl(controlType) {
        const requiredDocuments = this.getRequiredDocuments(controlType);
        
        this.documentsState = {};
        this.documentResponses = {};
        
        requiredDocuments.forEach(docId => {
            this.documentsState[docId] = {
                id: docId,
                status: 'pending',
                responses: {},
                completedQuestions: 0,
                totalQuestions: this.documentsConfig[docId].questions.length
            };
            this.documentResponses[docId] = {};
        });

        Utils.debugLog(`Documents initialisés pour ${controlType}: ${requiredDocuments.join(', ')}`);
    }

    // MODIFICATION : Gestion du skip si document absent
    moveToNextQuestion() {
        const docConfig = this.documentsConfig[this.currentDocument];
        const questions = docConfig.questions;
        const currentQuestion = questions[this.currentQuestionIndex];
        
        // Vérifier si on doit passer toutes les questions suivantes (document absent)
        if (currentQuestion.skipIfNo) {
            const lastResponse = this.documentResponses[this.currentDocument][this.currentQuestionIndex];
            if (lastResponse && lastResponse.answer === 'Non') {
                // Document absent, marquer le contrôle comme terminé directement
                this.completeDocument();
                return;
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
            this.updateQuestionInterface();
        } else {
            this.completeDocument();
        }
    }

    // Méthode utilitaire pour récupérer les informations des documents (mise à jour avec Harvest)
    getDocumentName(docId) {
        const documentNames = {
            1: 'FR',
            2: 'Profil Risques',
            3: 'Profil ESG',
            4: 'Harvest', // MODIFIÉ : était 'Carto Client'
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
            titleEl.textContent = `Contrôle Documentaire - ${this.currentControl.definition.name}`;
        }

        this.updateDossierInfo();
        this.updateDocumentsGrid();
        this.updateControlButtons();
    }

    updateDossierInfo() {
        const infoContainer = document.getElementById('dossier-info');
        if (!infoContainer) return;

        infoContainer.innerHTML = `
            <div class="dossier-info-card">
                <div class="dossier-info-header">
                    <h3>Informations du dossier en contrôle</h3>
                </div>
                <div class="dossier-info-body">
                    <div class="dossier-details">
                        <div class="detail-item client">
                            <span class="label">Client</span>
                            <span class="value">${this.currentDossier.client}</span>
                        </div>
                        <div class="detail-item code">
                            <span class="label">Code</span>
                            <span class="value">${this.currentDossier.codeDossier || 'Non renseigné'}</span>
                        </div>
                        <div class="detail-item conseiller">
                            <span class="label">Conseiller</span>
                            <span class="value">${this.currentDossier.conseiller || 'Non renseigné'}</span>
                        </div>
                        <div class="detail-item montant">
                            <span class="label">Montant</span>
                            <span class="value">${this.currentDossier.montant || 'Non renseigné'}</span>
                        </div>
                        <div class="detail-item domaine">
                            <span class="label">Domaine</span>
                            <span class="value">${this.currentDossier.domaine || 'Non renseigné'}</span>
                        </div>
                        <div class="detail-item nouveau">
                            <span class="label">Nouveau</span>
                            <span class="value">${this.currentDossier.nouveauClient || 'Non renseigné'}</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
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
        
        if (docConfig.questions.length === 0) {
            this.documentsState[documentId].status = 'completed';
            this.documentsState[documentId].completedQuestions = 1;
            this.updateDocumentsGrid();
            Utils.showNotification(`Document ${docConfig.name} marqué comme vérifié`, 'success');
            return;
        }
        
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

        questionContainer.innerHTML = `
            <div class="question-header">
                <h3>${docConfig.fullName}</h3>
                <div class="question-progress">
                    Question ${this.currentQuestionIndex + 1} sur ${questions.length}
                </div>
            </div>
            
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
                    <button class="btn btn-secondary" onclick="window.documentController?.cancelQuestion()">
                        Annuler
                    </button>
                    <button class="btn btn-primary" onclick="window.documentController?.saveQuestionResponse()">
                        ${this.currentQuestionIndex === questions.length - 1 ? 'Terminer le document' : 'Question suivante'}
                    </button>
                </div>
            </div>
        `;

        this.addHelpBubbleStyles();
    }

    generateResponseOptions(questionData) {
        if (questionData.type === 'document_type') {
            const options = questionData.options || ['Papier', 'RIC'];
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

        if (questionData.type === 'text') {
            return `
                <div class="response-group">
                    <label>Précisez :</label>
                    <input type="text" id="text-response" class="form-input" placeholder="Tapez votre réponse...">
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
                            <label class="checkbox-label">
                                <input type="checkbox" name="quality-checks" value="signatures-distinctes">
                                <span>Signatures distinctes et lisibles</span>
                            </label>
                        </div>
                        <div class="check-item">
                            <label class="checkbox-label">
                                <input type="checkbox" name="quality-checks" value="identites-correctes">
                                <span>Identités correspondant aux titulaires</span>
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

        if (questionData.type === 'document_type') {
            const docTypeRadio = document.querySelector('input[name="response"]:checked');
            if (docTypeRadio) {
                response.answer = docTypeRadio.value;
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

        if (questionData.type === 'text') {
            if (!response.answer) {
                Utils.showNotification('Veuillez saisir une réponse', 'error');
                return false;
            }
            return true;
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

        if (response.answer === 'Non' || response.quality === 'Non conforme' || response.quality === 'Partiellement conforme') {
            this.showJustificationModal(response);
            return;
        }

        this.saveResponse(response);
        this.moveToNextQuestion();
    }

    saveResponse(response) {
        if (!this.documentResponses[response.documentId]) {
            this.documentResponses[response.documentId] = {};
        }
        
        this.documentResponses[response.documentId][response.questionIndex] = response;
        
        Utils.debugLog(`Réponse sauvegardée: Doc ${response.documentId}, Q ${response.questionIndex}, Réponse: ${response.answer}`);
    }

    completeDocument() {
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

        const summary = this.generateControlSummary();
        
        // Déclencher l'événement
        window.dispatchEvent(new CustomEvent('controlCompleted', {
            detail: summary
        }));
        
        // Retour à l'interface principale
        Utils.showSection('automatic-control-section');
    }

    generateControlSummary() {
        const summary = {
            dossier: this.currentDossier,
            control: this.currentControl,
            documents: this.documentsState,
            responses: this.documentResponses,
            completedAt: new Date(),
            obligatoryIssuesCount: this.countObligatoryIssues()
        };

        // Notifier l'historique
        window.dispatchEvent(new CustomEvent('controlCompleted', {
            detail: summary
        }));

        window.persistenceManager?.saveControl(summary);
        
        Utils.showSection('automatic-control-section');
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

    // Reset pour nouvelle session
    reset() {
        this.currentDossier = null;
        this.currentControl = null;
        this.documentsState = {};
        this.currentDocument = null;
        this.currentQuestionIndex = 0;
        this.documentResponses = {};
        this.currentJustificationResponse = null;
        
        Utils.debugLog('DocumentController réinitialisé');
    }
}
