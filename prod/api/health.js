import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  try {
    // Test KV
    await kv.set('health_check', new Date().toISOString());
    const healthCheck = await kv.get('health_check');
    
    res.status(200).json({ 
      status: 'ok', 
      timestamp: new Date().toISOString(),
      message: 'Serveur Vercel + KV opérationnel',
      kv_status: healthCheck ? 'connecté' : 'erreur'
    });
  } catch (error) {
    res.status(500).json({ 
      status: 'error', 
      message: 'Erreur connexion KV',
      error: error.message 
    });
  }
}
