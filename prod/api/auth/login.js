import { kv } from '@vercel/kv';

// Configuration des utilisateurs (on va les stocker dans KV)
const DEFAULT_USERS = {
  cgp: [
    { id: 'manon', nom: 'Manon', password: 'Manon4827', backOfficeAutorise: false },
    { id: 'audrey', nom: 'Audrey', password: 'Audrey7314', backOfficeAutorise: false },
    { id: 'baptistef', nom: 'Baptiste F', password: 'BaptisteF1346', backOfficeAutorise: false },
    { id: 'baptistee', nom: 'Baptiste E', password: 'BaptisteE9205', backOfficeAutorise: true },
    { id: 'clement', nom: 'Clément', password: 'Clément5862', backOfficeAutorise: false },
    { id: 'nicolas', nom: 'Nicolas', password: 'Nicolas7431', backOfficeAutorise: true },
    { id: 'leo', nom: 'Léo', password: 'Léo2198', backOfficeAutorise: false },
    { id: 'maxime', nom: 'Maxime', password: 'Maxime3072', backOfficeAutorise: false },
    { id: 'cyril', nom: 'Cyril', password: 'Cyril6849', backOfficeAutorise: true },
    { id: 'florent', nom: 'Florent', password: 'Florent1956', backOfficeAutorise: false },
    { id: 'polepro', nom: 'Pôle Pro', password: 'PôlePro8641', backOfficeAutorise: true }
  ],
  backOffice: [
    { id: 'bo1', nom: 'Alice Robert', password: 'BackOffice2024!' },
    { id: 'bo2', nom: 'Thomas Bernard', password: 'Admin2024!' }
  ],
  admin: [
    { id: 'admin1', nom: 'Administrateur Système', password: 'AdminGestion2024!' }
  ]
};

async function initializeUsers() {
  try {
    const existingUsers = await kv.get('users');
    if (!existingUsers) {
      await kv.set('users', DEFAULT_USERS);
      console.log('Utilisateurs par défaut initialisés dans KV');
    }
  } catch (error) {
    console.error('Erreur initialisation utilisateurs:', error);
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    await initializeUsers();
    
    const { userType, userId, password } = req.body;

    if (!userType || !password) {
      return res.status(400).json({ 
        success: false, 
        message: 'Type d\'utilisateur et mot de passe requis' 
      });
    }

    // Récupérer les utilisateurs depuis KV
    const users = await kv.get('users') || DEFAULT_USERS;
    let user = null;

    if (userType === 'cgp') {
      if (!userId) {
        return res.status(400).json({ 
          success: false, 
          message: 'ID conseiller requis' 
        });
      }
      user = users.cgp.find(cgp => cgp.id === userId && cgp.password === password);
    } else if (userType === 'backoffice') {
      user = users.backOffice.find(bo => bo.password === password);
    } else if (userType === 'admin') {
      user = users.admin.find(admin => admin.password === password);
    }

    if (!user) {
      return res.status(401).json({ 
        success: false, 
        message: 'Identifiants incorrects' 
      });
    }

    // Retourner les infos utilisateur (sans le mot de passe)
    const { password: _, ...userInfo } = user;
    
    res.status(200).json({ 
      success: true, 
      user: { 
        ...userInfo, 
        type: userType 
      } 
    });

  } catch (error) {
    console.error('Erreur login:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Erreur serveur' 
    });
  }
}
