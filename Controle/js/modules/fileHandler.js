// fileHandler.js - Gestion des fichiers Excel et upload

import { Utils } from './utils.js';

export class FileHandler {
    constructor() {
        this.currentFile = null;
        this.setupEventListeners();
    }

    setupEventListeners() {
        const fileInput = document.getElementById('file-input');
        const uploadArea = document.querySelector('.file-upload-area');

        if (fileInput) {
            fileInput.addEventListener('change', (e) => this.handleFileSelect(e));
        }

        if (uploadArea) {
            // Glisser-déposer
            uploadArea.addEventListener('dragover', (e) => this.handleDragOver(e));
            uploadArea.addEventListener('dragleave', (e) => this.handleDragLeave(e));
            uploadArea.addEventListener('drop', (e) => this.handleDrop(e));
        }
    }

    handleDragOver(e) {
        e.preventDefault();
        document.querySelector('.file-upload-area').classList.add('dragover');
    }

    handleDragLeave(e) {
        e.preventDefault();
        document.querySelector('.file-upload-area').classList.remove('dragover');
    }

    handleDrop(e) {
        e.preventDefault();
        document.querySelector('.file-upload-area').classList.remove('dragover');
        
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            this.handleFileSelect({ target: { files: files } });
        }
    }

    handleFileSelect(event) {
        const file = event.target.files[0];
        
        if (!file) return;

        // Validation du type de fichier
        if (!Utils.validateFileType(file)) {
            Utils.showNotification('Veuillez sélectionner un fichier Excel (.xlsx, .xls ou .xlsm)', 'error');
            return;
        }

        this.currentFile = file;
        this.loadExcelFile(file);
    }

    loadExcelFile(file) {
        const reader = new FileReader();
        
        // Affichage du chargement
        this.showLoadingState();

        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                
                Utils.debugLog('Feuilles trouvées: ' + workbook.SheetNames.join(', '));
                
                const worksheet = this.findWorksheet(workbook);
                
                if (!worksheet) {
                    throw new Error('Aucune feuille utilisable trouvée dans le fichier Excel');
                }
                
                const { headers, jsonData } = this.extractData(worksheet);
                
                if (jsonData.length === 0) {
                    throw new Error('Aucune donnée trouvée après la ligne d\'en-têtes');
                }

                // Déléguer le traitement des données au DataProcessor GLOBAL
                const processor = window.dataProcessor || new DataProcessor();
                // S'assurer que c'est bien l'instance globale
                if (!window.dataProcessor) {
                    window.dataProcessor = processor;
                }
                processor.processExcelData(jsonData, headers, file);
                
            } catch (error) {
                console.error('Erreur lors de la lecture du fichier:', error);
                Utils.showNotification('Erreur lors de la lecture du fichier Excel: ' + error.message, 'error');
                this.resetFileUpload();
            }
        };

        reader.onerror = () => {
            Utils.showNotification('Erreur lors de la lecture du fichier', 'error');
            this.resetFileUpload();
        };

        reader.readAsArrayBuffer(file);
    }

    findWorksheet(workbook) {
        // Essayer différents noms de feuilles possibles
        const possibleNames = ['Résultats Fusion', 'Resultats Fusion', 'résultats fusion', 'Fusion', 'Sheet1', 'Feuil1'];
        
        for (let name of possibleNames) {
            if (workbook.Sheets[name]) {
                Utils.debugLog('Feuille utilisée: ' + name);
                return workbook.Sheets[name];
            }
        }
        
        // Utiliser la première feuille disponible comme fallback
        const firstSheetName = workbook.SheetNames[0];
        if (firstSheetName) {
            const worksheet = workbook.Sheets[firstSheetName];
            Utils.debugLog('Utilisation de la première feuille: ' + firstSheetName);
            return worksheet;
        }
        
        return null;
    }

    extractData(worksheet) {
        Utils.debugLog('Range de la feuille: ' + worksheet['!ref']);
        
        // Obtenir TOUTES les données
        const allData = XLSX.utils.sheet_to_json(worksheet, { 
            header: 1,
            defval: '',
            raw: false // Garder les chaînes formatées pour les dates/nombres
        });
        
        Utils.debugLog('Nombre total de lignes: ' + allData.length);
        
        if (allData.length < 2) {
            throw new Error('Le fichier doit contenir au moins une ligne d\'en-têtes et une ligne de données');
        }

        // Obtenir les en-têtes de la ligne 1 (index 0)
        const headers = allData[0] || [];
        Utils.debugLog('Headers trouvés (' + headers.length + '): ' + headers.slice(0, 10).join(', ') + '...');
        
        // Obtenir les données à partir de la ligne 2 (index 1)
        const jsonData = allData.slice(1);
        Utils.debugLog('Lignes de données: ' + jsonData.length);

        return { headers, jsonData };
    }

    showLoadingState() {
        const uploadArea = document.querySelector('.file-upload-area');
        if (uploadArea) {
            uploadArea.innerHTML = `
                <div class="loading">
                    <div class="spinner"></div>
                    <div>Lecture du fichier Excel en cours...</div>
                </div>
            `;
        }
    }

    resetFileUpload() {
        const uploadArea = document.querySelector('.file-upload-area');
        if (uploadArea) {
            uploadArea.innerHTML = `
                <div class="upload-icon">📁</div>
                <div class="upload-text">Cliquez pour sélectionner le fichier Excel</div>
                <div class="upload-subtext">ou glissez-déposez le fichier ici<br>Formats acceptés: .xlsx, .xls, .xlsm</div>
            `;
        }
        
        const fileInfo = document.getElementById('file-info');
        if (fileInfo) {
            fileInfo.classList.remove('active');
        }
        
        const fileInput = document.getElementById('file-input');
        if (fileInput) {
            fileInput.value = '';
        }
        
        this.currentFile = null;
        
        // Notifier les autres modules
        window.dispatchEvent(new CustomEvent('fileReset'));
    }

    updateFileInfo(file, rowCount, columnCount) {
        const fileNameEl = document.getElementById('file-name');
        const totalRowsEl = document.getElementById('total-rows');
        const totalColumnsEl = document.getElementById('total-columns');
        const fileSizeEl = document.getElementById('file-size');
        const fileInfoEl = document.getElementById('file-info');

        if (fileNameEl) fileNameEl.textContent = file.name;
        if (totalRowsEl) totalRowsEl.textContent = rowCount.toLocaleString();
        if (totalColumnsEl) totalColumnsEl.textContent = columnCount;
        if (fileSizeEl) fileSizeEl.textContent = (file.size / 1024).toFixed(0) + ' KB';
        if (fileInfoEl) fileInfoEl.classList.add('active');
    }

    getCurrentFile() {
        return this.currentFile;
    }

    exportToExcel(data, fileName) {
        try {
            // Créer le workbook
            const ws = XLSX.utils.json_to_sheet(data);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Export");

            // Télécharger le fichier
            XLSX.writeFile(wb, fileName);
            
            Utils.showNotification(`Fichier "${fileName}" téléchargé avec succès`, 'success');
            return true;
        } catch (error) {
            Utils.showNotification('Erreur lors de l\'export: ' + error.message, 'error');
            return false;
        }
    }
}