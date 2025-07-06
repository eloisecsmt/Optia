import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const users = await kv.get('users');
    
    if (!users) {
      return res.status(404).json({ error: 'Utilisateurs non trouvés' });
    }

    const sanitizedUsers = {
      cgp: users.cgp.map(({ password, ...user }) => user),
      backOffice: users.backOffice.map(({ password, ...user }) => user),
      admin: users.admin.map(({ password, ...user }) => user)
    };

    res.status(200).json(sanitizedUsers);
  } catch (error) {
    console.error('Erreur récupération utilisateurs:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
}
