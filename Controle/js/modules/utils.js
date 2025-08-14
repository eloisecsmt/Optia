// utils.js - Fonctions utilitaires et helpers

export class Utils {
    static debugLog(message) {
        console.log(message);
        
        const debugContent = document.getElementById('debug-content');
        if (debugContent) {
            const timestamp = new Date().toLocaleTimeString();
            debugContent.innerHTML += `<div>${timestamp}: ${message}</div>`;
            debugContent.scrollTop = debugContent.scrollHeight;
        }
    }

    static toggleDebug() {
        const debugPanel = document.getElementById('debug-panel');
        debugPanel.classList.toggle('active');
    }

    static getExcelColumnName(index) {
        // Convertit un index (0-based) en nom de colonne Excel (A, B, C, etc.)
        let result = '';
        let num = index;
        while (num >= 0) {
            result = String.fromCharCode(65 + (num % 26)) + result;
            num = Math.floor(num / 26) - 1;
            if (num < 0) break;
        }
        return result;
    }

    static formatMontant(value) {
        if (!value || value === '' || value === null || value === undefined) return '';
        
        Utils.debugLog(`Formatage montant - valeur brute: "${value}" (type: ${typeof value})`);
        
        // Si c'est déjà un nombre (cas Excel avec format monétaire)
        if (typeof value === 'number') {
            Utils.debugLog(`Montant numérique: ${value}`);
            return new Intl.NumberFormat('fr-FR', {
                style: 'currency',
                currency: 'EUR'
            }).format(value);
        }
        
        // Si c'est une chaîne, nettoyer et parser
        if (typeof value === 'string') {
            let cleanValue = value.toString().trim();
            
            // Supprimer les symboles monétaires et espaces
            cleanValue = cleanValue
                .replace(/€/g, '') // Supprimer €
                .replace(/EUR/gi, '') // Supprimer EUR
                .replace(/\s/g, '') // Supprimer tous les espaces
                .replace(/\u00A0/g, '') // Supprimer espaces insécables
                .replace(/\u202F/g, '') // Supprimer espaces fins
                .replace(/[^\d,.-]/g, ''); // Garder seulement chiffres, virgules, points, tirets
            
            Utils.debugLog(`Montant nettoyé: "${cleanValue}"`);
            
            // Si c'est vide après nettoyage
            if (cleanValue === '' || cleanValue === '-') return '';
            
            // Gérer les formats français (virgule décimale)
            // Remplacer la dernière virgule par un point si c'est une décimale
            if (cleanValue.includes(',')) {
                const parts = cleanValue.split(',');
                if (parts.length === 2 && parts[1].length <= 2) {
                    // C'est probablement une décimale (ex: "1 234,56")
                    cleanValue = parts[0].replace(/\./g, '') + '.' + parts[1];
                } else {
                    // Virgules comme séparateurs de milliers
                    cleanValue = cleanValue.replace(/,/g, '');
                }
            }
            
            // Supprimer les points utilisés comme séparateurs de milliers
            // Garder seulement le dernier point s'il y a 1-2 chiffres après
            const pointIndex = cleanValue.lastIndexOf('.');
            if (pointIndex !== -1) {
                const afterPoint = cleanValue.substring(pointIndex + 1);
                if (afterPoint.length > 2) {
                    // Probablement des séparateurs de milliers
                    cleanValue = cleanValue.replace(/\./g, '');
                }
            }
            
            Utils.debugLog(`Montant final avant parsing: "${cleanValue}"`);
            
            const num = parseFloat(cleanValue);
            if (!isNaN(num)) {
                Utils.debugLog(`Montant parsé: ${num}`);
                return new Intl.NumberFormat('fr-FR', {
                    style: 'currency',
                    currency: 'EUR'
                }).format(num);
            } else {
                Utils.debugLog(`Impossible de parser le montant: "${cleanValue}"`);
                return value.toString(); // Retourner la valeur originale si parsing impossible
            }
        }
        
        Utils.debugLog(`Type de montant non géré: ${typeof value}`);
        return value.toString();
    }

    // Dans utils.js - améliorer la méthode formatDate
    static formatDate(value) {
        if (!value) return '';
        
        const cleanValue = typeof value === 'string' ? value.trim() : value;
        if (!cleanValue) return '';
        
        try {
            let date = null;
            
            // 2. Si c'est une chaîne, essayer différents formats
            if (typeof cleanValue === 'string') {
                // Format MM/DD/YYYY vs DD/MM/YYYY - traitement spécifique Excel
                if (/^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(cleanValue)) {
                    const parts = cleanValue.split('/');
                    let year = parseInt(parts[2]);
                    
                    // Gestion des années sur 2 chiffres
                    if (year < 100) {
                        year += year < 50 ? 2000 : 1900;
                    }
                    
                    const num1 = parseInt(parts[0]);
                    const num2 = parseInt(parts[1]);
                    
                    
                    // Excel nous donne toujours du MM/DD/YYYY (format US)
                    date = new Date(year, num1 - 1, num2);
                }
            }
            
            // 3. Si on a une date valide, la formater
            if (date && !isNaN(date.getTime())) {
                const year = date.getFullYear();
                if (year >= 1900 && year <= 2100) {
                    const formatted = date.toLocaleDateString('fr-FR');
                    return formatted;
                }
            }
            
            
        } catch (error) {
        }
        
        // Si tout échoue, retourner la valeur originale
        return String(cleanValue);
    }

    static showSection(sectionId) {
        // Masquer toutes les sections
        document.querySelectorAll('.content-section').forEach(section => {
            section.classList.remove('active');
        });
        
        // Afficher la section cible
        document.getElementById(sectionId).classList.add('active');
    }

    static getBadgeClass(domaine) {
        if (!domaine) return '';
        const domain = domaine.toLowerCase();
        if (domain.includes('av')) return 'av';
        if (domain.includes('retraite')) return 'retraite';
        if (domain.includes('structure')) return 'produits-structures';
        return '';
    }

    static displayValue(value, placeholder = '-') {
        return value && value.trim() !== '' ? value : `<span style="color: #999; font-style: italic;">${placeholder}</span>`;
    }

    static generateFileName(prefix, extension = 'xlsx') {
        const timestamp = new Date().toISOString().split('T')[0];
        return `${prefix}_${timestamp}.${extension}`;
    }

    static showNotification(message, type = 'info') {
        // Fonction pour afficher des notifications
        console.log(`${type.toUpperCase()}: ${message}`);
        
        // Créer une notification visuelle
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `
            <div class="notification-content">
                <span class="notification-icon">${this.getNotificationIcon(type)}</span>
                <span class="notification-message">${message}</span>
                <button class="notification-close" onclick="this.parentElement.parentElement.remove()">×</button>
            </div>
        `;
        
        // Ajouter les styles si pas encore fait
        this.addNotificationStyles();
        
        // Ajouter au DOM
        document.body.appendChild(notification);
        
        // Supprimer automatiquement après 5 secondes
        setTimeout(() => {
            if (notification.parentElement) {
                notification.remove();
            }
        }, 5000);
        
        // Animation d'entrée
        setTimeout(() => {
            notification.classList.add('show');
        }, 10);
    }

    static getNotificationIcon(type) {
        const icons = {
            'success': '✅',
            'error': '❌',
            'warning': '⚠️',
            'info': 'ℹ️'
        };
        return icons[type] || icons['info'];
    }

    static addNotificationStyles() {
        // Vérifier si les styles sont déjà ajoutés
        if (document.getElementById('notification-styles')) return;
        
        const style = document.createElement('style');
        style.id = 'notification-styles';
        style.textContent = `
            .notification {
                position: fixed;
                top: 20px;
                right: 20px;
                z-index: 10000;
                opacity: 0;
                transform: translateX(100%);
                transition: all 0.3s ease;
                max-width: 400px;
            }
            
            .notification.show {
                opacity: 1;
                transform: translateX(0);
            }
            
            .notification-content {
                background: white;
                border-radius: 8px;
                padding: 15px;
                box-shadow: 0 5px 20px rgba(0,0,0,0.2);
                border-left: 4px solid #d4af37;
                display: flex;
                align-items: center;
                gap: 10px;
            }
            
            .notification-success .notification-content {
                border-left-color: #28a745;
            }
            
            .notification-error .notification-content {
                border-left-color: #dc3545;
            }
            
            .notification-warning .notification-content {
                border-left-color: #ffc107;
            }
            
            .notification-icon {
                font-size: 1.2rem;
            }
            
            .notification-message {
                flex: 1;
                color: #333;
                font-weight: 500;
            }
            
            .notification-close {
                background: none;
                border: none;
                font-size: 1.5rem;
                cursor: pointer;
                color: #999;
                padding: 0;
                width: 24px;
                height: 24px;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            
            .notification-close:hover {
                color: #333;
            }
        `;
        
        document.head.appendChild(style);
    }

    static validateFileType(file) {
        const validTypes = [
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
            'application/vnd.ms-excel',                                          // .xls
            'application/vnd.ms-excel.sheet.macroEnabled.12'                     // .xlsm
        ];
        
        return validTypes.includes(file.type);
    }

    static normalizeText(text) {
        // Normalise le texte pour les comparaisons (supprime accents, etc.)
        return text.toLowerCase().trim()
            .replace(/[àáâãäå]/g, 'a')
            .replace(/[èéêë]/g, 'e')
            .replace(/[ìíîï]/g, 'i')
            .replace(/[òóôõö]/g, 'o')
            .replace(/[ùúûü]/g, 'u')
            .replace(/[ç]/g, 'c')
            .replace(/[ñ]/g, 'n');
    }

    static getRandomElements(array, count) {
        // Retourne un nombre donné d'éléments aléatoires d'un tableau
        const shuffled = [...array].sort(() => 0.5 - Math.random());
        return shuffled.slice(0, count);
    }

    static deepClone(obj) {
        // Clone profond d'un objet
        return JSON.parse(JSON.stringify(obj));
    }
}




