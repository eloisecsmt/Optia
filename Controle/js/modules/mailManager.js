// mail.js - Module de génération d'emails pour les conseillers

import { Utils } from './utils.js';

export class MailManager {
    constructor() {
        this.currentResults = [];
        this.conseillerEmails = new Map(); // Cache des emails des conseillers
        this.init();
    }

    init() {
        this.setupDefaultEmails();
        Utils.debugLog('MailManager initialisé');
    }

    // Configuration par défaut des emails (à adapter selon votre structure)
    setupDefaultEmails() {
        // Format: nom_conseiller -> email
        // Ces emails peuvent être configurés ou récupérés depuis un fichier de configuration
        this.conseillerEmails.set('MARTIN Pierre', 'p.martin@cabinet.fr');
        this.conseillerEmails.set('DUPONT Marie', 'm.dupont@cabinet.fr');
        this.conseillerEmails.set('BERNARD Jean', 'j.bernard@cabinet.fr');
        // Ajouter d'autres emails selon vos conseillers
    }

    // Afficher la modal de sélection du conseiller
    showConseillerSelectionModal(context = 'historique') {
        // Récupérer la liste des conseillers selon le contexte
        const conseillers = this.getAvailableConseillers(context);
        
        if (conseillers.length === 0) {
            Utils.showNotification('Aucun conseiller trouvé avec des dossiers en attente', 'warning');
            return;
        }

        this.createConseillerModal(conseillers, context);
    }

    // Récupérer les conseillers disponibles selon le contexte
    getAvailableConseillers(context) {
        let conseillers = [];

        if (context === 'historique') {
            // Depuis l'historique - récupérer tous les contrôles
            if (window.persistenceManager) {
                const allControles = window.persistenceManager.getHistoryData().controles;
                const conseillerSet = new Set();
                
                allControles.forEach(controle => {
                    if (controle.conseiller && controle.conseiller.trim() !== '') {
                        conseillerSet.add(controle.conseiller);
                    }
                });
                
                conseillers = Array.from(conseillerSet).sort();
            }
        } else if (context === 'suspendus') {
            // Depuis les contrôles suspendus
            if (window.persistenceManager) {
                const suspendedControles = window.persistenceManager.getSuspendedControls();
                const conseillerSet = new Set();
                
                suspendedControles.forEach(suspended => {
                    if (suspended.dossier.conseiller && suspended.dossier.conseiller.trim() !== '') {
                        conseillerSet.add(suspended.dossier.conseiller);
                    }
                });
                
                conseillers = Array.from(conseillerSet).sort();
            }
        } else if (context === 'selection') {
            // Depuis la sélection de dossiers
            if (window.dataProcessor) {
                const filteredDossiers = window.dataProcessor.getFilteredDossiers();
                const conseillerSet = new Set();
                
                filteredDossiers.forEach(dossier => {
                    if (dossier.conseiller && dossier.conseiller.trim() !== '') {
                        conseillerSet.add(dossier.conseiller);
                    }
                });
                
                conseillers = Array.from(conseillerSet).sort();
            }
        }

        return conseillers;
    }

    // Créer la modal de sélection du conseiller
    createConseillerModal(conseillers, context) {
        const modal = document.createElement('div');
        modal.className = 'justification-modal';
        modal.id = 'conseiller-selection-modal';
        
        modal.innerHTML = `
            <div class="modal-overlay" onclick="window.mailManager?.closeConseillerModal()">
                <div class="modal-content" style="max-width: 600px;" onclick="event.stopPropagation();">
                    <div class="modal-header">
                        <h3>📧 Générer un email de relance</h3>
                        <button class="btn btn-sm btn-secondary" onclick="window.mailManager?.closeConseillerModal()">❌</button>
                    </div>
                    
                    <div class="modal-body">
                        <div class="conseiller-selection-info">
                            <p><strong>Contexte :</strong> ${this.getContextLabel(context)}</p>
                            <p>Sélectionnez le conseiller pour lequel vous souhaitez générer un email de relance concernant ses dossiers en attente.</p>
                        </div>
                        
                        <div class="conseiller-list">
                            <h4>Conseillers disponibles (${conseillers.length}) :</h4>
                            <div class="conseiller-grid">
                                ${conseillers.map(conseiller => this.generateConseillerCard(conseiller, context)).join('')}
                            </div>
                        </div>
                        
                        <div class="email-settings">
                            <h4>⚙️ Configuration email :</h4>
                            <div class="email-config">
                                <div class="config-item">
                                    <label for="email-expediteur">Votre email (expéditeur) :</label>
                                    <input type="email" id="email-expediteur" placeholder="votre.email@cabinet.fr" 
                                           value="${this.getDefaultSenderEmail()}">
                                </div>
                                <div class="config-item">
                                    <label for="email-copie">Email en copie (optionnel) :</label>
                                    <input type="email" id="email-copie" placeholder="direction@cabinet.fr">
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="modal-actions">
                        <button class="btn btn-secondary" onclick="window.mailManager?.closeConseillerModal()">
                            ❌ Annuler
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        this.addModalStyles();
    }

    // Générer une carte pour chaque conseiller
    generateConseillerCard(conseiller, context) {
        const stats = this.getConseillerStats(conseiller, context);
        const email = this.getConseillerEmail(conseiller);
        
        return `
            <div class="conseiller-card" onclick="window.mailManager?.selectConseiller('${conseiller}', '${context}')">
                <div class="conseiller-header">
                    <h5>👨‍💼 ${conseiller}</h5>
                    <span class="email-indicator ${email ? 'has-email' : 'no-email'}" 
                          title="${email ? 'Email: ' + email : 'Email non configuré'}">
                        ${email ? '📧' : '❓'}
                    </span>
                </div>
                <div class="conseiller-stats">
                    <div class="stat-item">
                        <span class="stat-value">${stats.totalDossiers}</span>
                        <span class="stat-label">${context === 'suspendus' ? 'Suspendus' : 'Dossiers'}</span>
                    </div>
                    ${stats.anciens ? `
                        <div class="stat-item warning">
                            <span class="stat-value">${stats.anciens}</span>
                            <span class="stat-label">Anciens (14j+)</span>
                        </div>
                    ` : ''}
                    ${stats.nonConformes ? `
                        <div class="stat-item danger">
                            <span class="stat-value">${stats.nonConformes}</span>
                            <span class="stat-label">Non conformes</span>
                        </div>
                    ` : ''}
                </div>
                <div class="conseiller-action">
                    <button class="btn btn-sm btn-primary">
                        📧 Générer email
                    </button>
                </div>
            </div>
        `;
    }

    // Obtenir les statistiques d'un conseiller
    getConseillerStats(conseiller, context) {
        let stats = { totalDossiers: 0, anciens: 0, nonConformes: 0 };

        if (context === 'suspendus') {
            const suspendedControles = window.persistenceManager?.getSuspendedControls() || [];
            const conseillerSuspended = suspendedControles.filter(s => s.dossier.conseiller === conseiller);
            
            stats.totalDossiers = conseillerSuspended.length;
            stats.anciens = conseillerSuspended.filter(s => {
                const days = Math.floor((new Date() - new Date(s.suspendedAt)) / (1000 * 60 * 60 * 24));
                return days >= 14;
            }).length;
            
        } else if (context === 'historique') {
            const allControles = window.persistenceManager?.getHistoryData().controles || [];
            const conseillerControles = allControles.filter(c => c.conseiller === conseiller);
            
            stats.totalDossiers = conseillerControles.length;
            stats.nonConformes = conseillerControles.filter(c => c.conformiteGlobale === 'NON CONFORME').length;
        }

        return stats;
    }

    // Sélectionner un conseiller et générer l'email
    selectConseiller(conseiller, context) {
        Utils.debugLog(`Génération email pour ${conseiller} (contexte: ${context})`);
        
        const senderEmail = document.getElementById('email-expediteur')?.value;
        const ccEmail = document.getElementById('email-copie')?.value;
        
        this.generateEmail(conseiller, context, senderEmail, ccEmail);
        this.closeConseillerModal();
    }

    // Générer et ouvrir l'email
    generateEmail(conseiller, context, senderEmail, ccEmail) {
        const emailData = this.prepareEmailData(conseiller, context);
        const mailto = this.buildMailtoUrl(emailData, senderEmail, ccEmail);
        
        Utils.debugLog(`Ouverture email pour ${conseiller}: ${mailto.substring(0, 100)}...`);
        
        // Ouvrir le client mail
        window.location.href = mailto;
        
        // Notification de succès
        Utils.showNotification(`Email de relance généré pour ${conseiller}`, 'success');
    }

    // Préparer les données de l'email
    prepareEmailData(conseiller, context) {
        const emailData = {
        conseiller: conseiller,
        context: context,
        dossiers: [],
        stats: this.getConseillerStats(conseiller, context)
    };

        // Récupérer les dossiers spécifiques au conseiller avec plus d'informations
        if (context === 'suspendus') {
            const suspendedControles = window.persistenceManager?.getSuspendedControls() || [];
            emailData.dossiers = suspendedControles
                .filter(s => s.dossier.conseiller === conseiller)
                .map(s => ({
                    client: s.dossier.client,
                    codeDossier: s.dossier.codeDossier || 'N/A',
                    type: s.type,
                    suspendedAt: new Date(s.suspendedAt),
                    daysSuspended: Math.floor((new Date() - new Date(s.suspendedAt)) / (1000 * 60 * 60 * 24)),
                    reason: s.suspendReason || 'Non spécifiée',
                    questionsCount: Object.keys(s.responses || {}).length,
                    
                    // Informations supplémentaires du dossier si disponibles
                    montant: s.dossier.montant || null,
                    dateOuverture: s.dossier.dateOuverture || null,
                    produit: s.dossier.produit || s.dossier.typeOperation || null,
                    statut: s.dossier.statut || null,
                    numeroPolice: s.dossier.numeroPolice || null,
                    courtier: s.dossier.courtier || null,
                    domaine: s.dossier.domaine || null,
                    nouveauClient: s.dossier.nouveauClient || null
                }))
                .sort((a, b) => b.daysSuspended - a.daysSuspended); // Trier par ancienneté
                
        } else if (context === 'historique') {
            const allControles = window.persistenceManager?.getHistoryData().controles || [];
            emailData.dossiers = allControles
                .filter(c => c.conseiller === conseiller && c.conformiteGlobale === 'NON CONFORME')
                .map(c => ({
                    client: c.client,
                    codeDossier: c.codeDossier || 'N/A',
                    type: c.type,
                    date: c.date,
                    anomalies: c.anomaliesMajeures || 'Non spécifiées',
                    documents: c.documentsControles || 'Non spécifiés',
                    
                    // Informations supplémentaires du dossier si disponibles
                    montant: c.montant || null,
                    dateOuverture: c.dateOuverture || null,
                    produit: c.produit || c.typeOperation || null,
                    conseils: c.conseils || c.observations || null,
                    scoreConformite: c.scoreConformite || null,
                    numeroPolice: c.numeroPolice || null,
                    courtier: c.courtier || null,
                    domaine: c.domaine || null,
                    nouveauClient: c.nouveauClient || null
                }))
                .sort((a, b) => new Date(b.date) - new Date(a.date)); // Trier par date décroissante
        }

        return emailData;
    }

    // Construire l'URL mailto
    buildMailtoUrl(emailData, senderEmail, ccEmail) {
        const conseillerEmail = this.getConseillerEmail(emailData.conseiller);
        const subject = this.generateSubject(emailData);
        const body = this.generateEmailBody(emailData, senderEmail);
        
        // Vérifier qu'on a un email de destination
        if (!conseillerEmail || conseillerEmail.trim() === '') {
            Utils.showNotification(`Aucun email configuré pour ${emailData.conseiller}`, 'warning');
            return null;
        }
        
        // Fonction pour nettoyer et encoder proprement
        const cleanEncode = (text) => {
            return encodeURIComponent(text)
                .replace(/'/g, '%27')
                .replace(/"/g, '%22')
                .replace(/\(/g, '%28')
                .replace(/\)/g, '%29');
        };
        
        // Limiter la taille du corps pour éviter les problèmes de navigateur
        const maxBodyLength = 1200; // Réduire encore pour plus de sécurité
        const truncatedBody = body.length > maxBodyLength ? 
            body.substring(0, maxBodyLength) + '\n\n[Message tronque - voir le systeme pour le detail complet]' : 
            body;
        
        // Construire l'URL mailto manuellement
        let mailto = `mailto:${cleanEncode(conseillerEmail)}`;
        
        // Ajouter les paramètres
        const params = [];
        
        if (subject) {
            params.push(`subject=${cleanEncode(subject)}`);
        }
        
        if (truncatedBody) {
            params.push(`body=${cleanEncode(truncatedBody)}`);
        }
        
        if (ccEmail && ccEmail.trim() !== '') {
            params.push(`cc=${cleanEncode(ccEmail.trim())}`);
        }
        
        if (params.length > 0) {
            mailto += '?' + params.join('&');
        }
        
        console.log('URL mailto générée (longueur:', mailto.length, '):', mailto.substring(0, 150) + '...'); // Debug amélioré
        return mailto;
    }

    // Générer le corps de l'email 21
    generateEmailBody(emailData, senderEmail) {
        const { conseiller, context, dossiers, stats } = emailData;
        const today = new Date().toLocaleDateString('fr-FR');
        
        let lines = [];
        
        lines.push(`Bonjour ${conseiller},`);
        lines.push('');
        
        if (context === 'suspendus') {
            lines.push(`Suite au controle de conformite du ${today}, je souhaite faire le point avec vous concernant les controles documentaires suspendus sous votre responsabilite.`);
            lines.push('');
            lines.push('SITUATION ACTUELLE :');
            lines.push(`- Total des controles suspendus : ${stats.totalDossiers}`);
            
            if (stats.anciens > 0) {
                lines.push(`- Controles anciens (> 14 jours) : ${stats.anciens}`);
            }
            
            lines.push('');
            lines.push('DETAIL DES CONTROLES SUSPENDUS :');
            lines.push('');
            
            dossiers.forEach((dossier, index) => {
                lines.push(`${index + 1}. DOSSIER : ${dossier.client}`);
                lines.push(`   - Code dossier : ${dossier.codeDossier}`);
                lines.push(`   - Type de controle : ${dossier.type}`);
                lines.push(`   - Date de suspension : ${dossier.suspendedAt.toLocaleDateString('fr-FR')} (${dossier.daysSuspended} jour${dossier.daysSuspended > 1 ? 's' : ''})`);
                //lines.push(`   - Questions deja traitees : ${dossier.questionsCount}`);
                lines.push(`   - Raison de la suspension : ${dossier.reason}`);
                
                // Informations importantes du dossier
                //if (dossier.montant) {
                //    lines.push(`   - Montant du dossier : ${dossier.montant}`);
                //}
                if (dossier.numeroPolice) {
                    lines.push(`   - Numero de police : ${dossier.numeroPolice}`);
                }
                if (dossier.dateOuverture) {
                    lines.push(`   - Date d'ouverture : ${new Date(dossier.dateOuverture).toLocaleDateString('fr-FR')}`);
                }
                if (dossier.produit) {
                    lines.push(`   - Produit/Service : ${dossier.produit}`);
                }
                if (dossier.domaine) {
                    lines.push(`   - Domaine : ${dossier.domaine}`);
                }
                if (dossier.statut) {
                    lines.push(`   - Statut actuel : ${dossier.statut}`);
                }
                if (dossier.courtier) {
                    lines.push(`   - Courtier : ${dossier.courtier}`);
                }
                if (dossier.nouveauClient && dossier.nouveauClient !== 'Non') {
                    lines.push(`   - Nouveau client : ${dossier.nouveauClient}`);
                }
                
                lines.push('');
            });
            
            lines.push('IMPORTANT :');
            lines.push('');
            lines.push('Je vous invite a faire le point sur ces dossiers et a me faire un retour par email sous 7 jours ouvrables maximum.');
            lines.push('');
            lines.push('Pour information, ces controles sont actuellement suspendus. En l\'absence de retour de votre part dans les delais impartis, ces dossiers seront automatiquement classes comme NON CONFORMES.');
            lines.push('');
            lines.push('ACTIONS REQUISES :');
            lines.push('- Faire le point sur les elements manquants de ces dossiers');
            lines.push('- Rassembler la documentation complementaire si necessaire');
            lines.push('- Me transmettre les elements de regularisation');
            lines.push('- Me faire un retour detaille sur l\'avancement sous 7 jours');
            
        } else {
            lines.push(`Suite au controle de conformite du ${today}, je souhaite faire le point avec vous concernant les dossiers presentant des non-conformites.`);
            lines.push('');
            lines.push('SITUATION ACTUELLE :');
            lines.push(`- Dossiers non conformes : ${stats.nonConformes}`);
            lines.push(`- Total dossiers controles : ${stats.totalDossiers}`);
            lines.push('');
            lines.push('DETAIL DES NON-CONFORMITES :');
            lines.push('');
            
            dossiers.forEach((dossier, index) => {
                lines.push(`${index + 1}. DOSSIER : ${dossier.client}`);
                lines.push(`   - Code dossier : ${dossier.codeDossier}`);
                lines.push(`   - Type de controle : ${dossier.type}`);
                lines.push(`   - Date du controle : ${new Date(dossier.date).toLocaleDateString('fr-FR')}`);
                lines.push(`   - Anomalies majeures detectees : ${dossier.anomalies}`);
                lines.push(`   - Documents controles : ${dossier.documents}`);
                
                // Informations importantes du dossier
                if (dossier.montant) {
                    lines.push(`   - Montant du dossier : ${dossier.montant}`);
                }
                if (dossier.numeroPolice) {
                    lines.push(`   - Numero de police : ${dossier.numeroPolice}`);
                }
                if (dossier.dateOuverture) {
                    lines.push(`   - Date d'ouverture : ${new Date(dossier.dateOuverture).toLocaleDateString('fr-FR')}`);
                }
                if (dossier.produit) {
                    lines.push(`   - Produit/Service : ${dossier.produit}`);
                }
                if (dossier.domaine) {
                    lines.push(`   - Domaine : ${dossier.domaine}`);
                }
                if (dossier.courtier) {
                    lines.push(`   - Courtier : ${dossier.courtier}`);
                }
                if (dossier.scoreConformite) {
                    lines.push(`   - Score de conformite : ${dossier.scoreConformite}%`);
                }
                if (dossier.conseils) {
                    lines.push(`   - Observations : ${dossier.conseils}`);
                }
                if (dossier.nouveauClient && dossier.nouveauClient !== 'Non') {
                    lines.push(`   - Nouveau client : ${dossier.nouveauClient}`);
                }
                
                lines.push('');
            });
            
            lines.push('IMPORTANT :');
            lines.push('');
            lines.push('Je vous invite a faire le point sur ces non-conformites et a me faire un retour par email sous 7 jours ouvrables concernant les actions correctives mises en place.');
            lines.push('');
            lines.push('ACTIONS REQUISES :');
            lines.push('- Regulariser les anomalies detectees');
            lines.push('- Completer les documents manquants');
            lines.push('- Me transmettre les elements de regularisation');
            lines.push('- Me faire un retour detaille sur les mesures correctives sous 7 jours');
        }
        
        lines.push('');
        lines.push('Pour toute question ou assistance, n\'hesitez pas a me contacter directement.');
        lines.push('');
        lines.push('Cordialement,');
        lines.push('');
        
        if (senderEmail && senderEmail.trim() !== '') {
            // Extraire le nom/prénom depuis l'email si possible
            const emailParts = senderEmail.split('@')[0].split('.');
            if (emailParts.length >= 2) {
                const prenom = emailParts[0].charAt(0).toUpperCase() + emailParts[0].slice(1);
                const nom = emailParts[1].toUpperCase();
                lines.push(`${prenom} ${nom}`);
            } else {
                lines.push('Service Conformite');
            }
            lines.push(senderEmail);
        } else {
            lines.push('Service Conformite');
        }
        
        lines.push('');
        lines.push('---');
        lines.push(`Email genere automatiquement par le systeme de controle documentaire le ${today}`);
        lines.push('DELAI DE REPONSE REQUIS : 7 jours ouvrables');
        
        return lines.join('\n');
    }

    // 3. Améliorer generateSubject pour éviter les caractères spéciaux :
    generateSubject(emailData) {
        const contextLabel = emailData.context === 'suspendus' ? 'Controles suspendus' : 'Dossiers non conformes';
        const count = emailData.dossiers.length;
        const plural = count > 1 ? 's' : '';
        
        return `Conformite - ${contextLabel} - ${emailData.conseiller} (${count} dossier${plural})`;
    }

    // Utilitaires
    getContextLabel(context) {
        const labels = {
            'historique': 'Historique des contrôles',
            'suspendus': 'Contrôles suspendus',
            'selection': 'Sélection de dossiers'
        };
        return labels[context] || 'Contrôles';
    }

    getConseillerEmail(conseiller) {
        // Retourner l'email configuré ou générer un email par défaut
        if (this.conseillerEmails.has(conseiller)) {
            return this.conseillerEmails.get(conseiller);
        }
        
        // Génération automatique basée sur le nom (à adapter selon votre convention)
        // Exemple: "MARTIN Pierre" -> "p.martin@cabinet.fr"
        const parts = conseiller.split(' ');
        if (parts.length >= 2) {
            const prenom = parts[1].toLowerCase();
            const nom = parts[0].toLowerCase();
            return `${prenom.charAt(0)}.${nom}@cabinet.fr`;
        }
        
        return null; // Pas d'email trouvé
    }

    getDefaultSenderEmail() {
        // Récupérer l'email par défaut de l'expéditeur
        // Peut être configuré dans localStorage ou une config
        return localStorage.getItem('default_sender_email') || 'conformite@cabinet.fr';
    }

    // Gestion de la modal
    closeConseillerModal() {
        const modal = document.getElementById('conseiller-selection-modal');
        if (modal) {
            modal.remove();
        }
    }

    // Ajouter les styles pour la modal
    addModalStyles() {
        if (document.getElementById('mail-modal-styles')) return;
        
        const style = document.createElement('style');
        style.id = 'mail-modal-styles';
        style.textContent = `
            .conseiller-selection-info {
                background: #e3f2fd;
                padding: 15px;
                border-radius: 8px;
                margin-bottom: 20px;
            }
            
            .conseiller-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
                gap: 15px;
                margin-top: 15px;
            }
            
            .conseiller-card {
                border: 2px solid #e9ecef;
                border-radius: 12px;
                padding: 15px;
                cursor: pointer;
                transition: all 0.3s ease;
                background: white;
            }
            
            .conseiller-card:hover {
                border-color: #d4af37;
                box-shadow: 0 4px 12px rgba(0,0,0,0.1);
                transform: translateY(-2px);
            }
            
            .conseiller-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 10px;
            }
            
            .conseiller-header h5 {
                margin: 0;
                color: #1a1a2e;
                font-size: 1.1rem;
            }
            
            .email-indicator {
                font-size: 1.2rem;
                opacity: 0.7;
            }
            
            .email-indicator.has-email {
                color: #28a745;
            }
            
            .email-indicator.no-email {
                color: #ffc107;
            }
            
            .conseiller-stats {
                display: flex;
                gap: 15px;
                margin-bottom: 15px;
            }
            
            .stat-item {
                text-align: center;
                flex: 1;
            }
            
            .stat-item.warning {
                color: #ffc107;
            }
            
            .stat-item.danger {
                color: #dc3545;
            }
            
            .stat-value {
                display: block;
                font-size: 1.5rem;
                font-weight: bold;
                line-height: 1;
            }
            
            .stat-label {
                display: block;
                font-size: 0.85rem;
                opacity: 0.8;
                margin-top: 4px;
            }
            
            .conseiller-action {
                text-align: center;
            }
            
            .email-settings {
                margin-top: 25px;
                padding-top: 20px;
                border-top: 1px solid #e9ecef;
            }
            
            .email-config {
                display: grid;
                gap: 15px;
                margin-top: 15px;
            }
            
            .config-item label {
                display: block;
                margin-bottom: 5px;
                font-weight: 600;
                color: #1a1a2e;
            }
            
            .config-item input[type="email"] {
                width: 100%;
                padding: 10px;
                border: 1px solid #ddd;
                border-radius: 6px;
                font-size: 1rem;
            }
            
            .config-item input[type="email"]:focus {
                outline: none;
                border-color: #d4af37;
                box-shadow: 0 0 0 3px rgba(212, 175, 55, 0.1);
            }
        `;
        
        document.head.appendChild(style);
    }

    // Méthodes publiques pour être appelées depuis les autres modules
    
    // Depuis l'historique
    showMailFromHistory() {
        this.showConseillerSelectionModal('historique');
    }
    
    // Depuis les contrôles suspendus
    showMailFromSuspended() {
        this.showConseillerSelectionModal('suspendus');
    }
    
    // Depuis la sélection de dossiers
    showMailFromSelection() {
        this.showConseillerSelectionModal('selection');
    }
    
    // Configuration des emails des conseillers
    configureConseillerEmail(conseiller, email) {
        this.conseillerEmails.set(conseiller, email);
        // Optionnel : sauvegarder dans localStorage
        const emailConfig = Object.fromEntries(this.conseillerEmails);
        localStorage.setItem('conseiller_emails', JSON.stringify(emailConfig));
    }
    
    // Charger la configuration des emails depuis localStorage
    loadEmailConfiguration() {
        try {
            const saved = localStorage.getItem('conseiller_emails');
            if (saved) {
                const config = JSON.parse(saved);
                Object.entries(config).forEach(([conseiller, email]) => {
                    this.conseillerEmails.set(conseiller, email);
                });
                Utils.debugLog(`Configuration emails chargée: ${this.conseillerEmails.size} conseillers`);
            }
        } catch (error) {
            Utils.debugLog('Erreur chargement configuration emails: ' + error.message);
        }
    }
}
