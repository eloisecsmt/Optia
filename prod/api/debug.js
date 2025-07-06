import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  try {
    const debugInfo = {
      timestamp: new Date().toISOString(),
      kv_status: '✅ Connecté',
      data_check: {}
    };

    try {
      const users = await kv.get('users');
      if (users) {
        debugInfo.data_check.users = `✅ ${(users.cgp?.length || 0) + (users.backOffice?.length || 0) + (users.admin?.length || 0)} utilisateurs configurés`;
      } else {
        debugInfo.data_check.users = '⚠️ Utilisateurs non initialisés';
      }
    } catch (e) {
      debugInfo.data_check.users = '❌ Erreur lecture utilisateurs';
    }

    try {
      const nextId = await kv.get('operations:next_id');
      if (nextId) {
        debugInfo.data_check.operations_counter = `✅ Prochaine opération ID: ${nextId}`;
      } else {
        debugInfo.data_check.operations_counter = '⚠️ Compteur opérations non initialisé';
      }
    } catch (e) {
      debugInfo.data_check.operations_counter = '❌ Erreur lecture compteur';
    }

    try {
      const operationIds = await kv.smembers('operations:ids');
      if (operationIds && operationIds.length > 0) {
        debugInfo.data_check.operations_list = `✅ ${operationIds.length} opération(s) dans la base`;
      } else {
        debugInfo.data_check.operations_list = '⚠️ Aucune opération dans la base';
      }
    } catch (e) {
      debugInfo.data_check.operations_list = '❌ Erreur lecture opérations';
    }

    if (req.query.init === 'true') {
      try {
        const DEFAULT_USERS = {
          cgp: [
            { id: 'manon', nom: 'Manon', password: 'Manon4827', backOfficeAutorise: false },
            { id: 'audrey', nom: 'Audrey', password: 'Audrey7314', backOfficeAutorise: false },
            { id: 'nicolas', nom: 'Nicolas', password: 'Nicolas7431', backOfficeAutorise: true }
          ],
          backOffice: [
            { id: 'bo1', nom: 'Alice Robert', password: 'BackOffice2024!' }
          ],
          admin: [
            { id: 'admin1', nom: 'Administrateur', password: 'AdminGestion2024!' }
          ]
        };
        
        await kv.set('users', DEFAULT_USERS);
        debugInfo.init_result = '✅ Utilisateurs initialisés dans Vercel KV';
      } catch (e) {
        debugInfo.init_result = '❌ Erreur initialisation: ' + e.message;
      }
    }

    res.status(200).json(debugInfo);
    
  } catch (error) {
    res.status(500).json({ 
      error: 'Erreur debug KV', 
      message: error.message,
      kv_status: '❌ Erreur de connexion'
    });
  }
}
