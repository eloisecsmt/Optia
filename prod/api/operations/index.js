import { kv } from '@vercel/kv';

async function getNextId() {
  const nextId = await kv.incr('operations:next_id');
  return nextId;
}

async function getAllOperations() {
  try {
    const operationIds = await kv.smembers('operations:ids') || [];
    
    if (operationIds.length === 0) {
      return [];
    }
    
    // Récupérer toutes les opérations en parallèle
    const operations = await Promise.all(
      operationIds.map(async (id) => {
        const operation = await kv.get(`operation:${id}`);
        return operation;
      })
    );
    
    // Filtrer les opérations nulles et trier par date de création
    return operations
      .filter(op => op !== null)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      
  } catch (error) {
    console.error('Erreur récupération opérations:', error);
    return [];
  }
}

export default async function handler(req, res) {
  if (req.method === 'GET') {
    try {
      const operations = await getAllOperations();
      res.status(200).json(operations);
    } catch (error) {
      console.error('Erreur GET opérations:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  }
  
  else if (req.method === 'POST') {
    try {
      const {
        nomClient, nouveauClient, conseiller, assistantBO, domaine,
        fournisseur, nomContrat, referenceContrat, typeActe, montant,
        pourcentageFrais, partieIncomprise, ca, apporteurAffaire,
        dateEnvoiCompagnie, dateRelance, dateValidation, etatGlobal,
        createdBy
      } = req.body;

      if (!nomClient || !conseiller || !domaine || !fournisseur || !typeActe || !montant) {
        return res.status(400).json({ error: 'Champs obligatoires manquants' });
      }

      // Générer un nouvel ID
      const id = await getNextId();
      
      // Créer l'opération
      const operation = {
        id,
        nomClient,
        nouveauClient: nouveauClient || false,
        conseiller,
        assistantBO: assistantBO || null,
        domaine,
        fournisseur,
        nomContrat: nomContrat || null,
        referenceContrat: referenceContrat || null,
        typeActe,
        montant: parseFloat(montant) || 0,
        pourcentageFrais: parseFloat(pourcentageFrais) || 0,
        partieIncomprise: parseFloat(partieIncomprise) || 0,
        ca: parseFloat(ca) || 0,
        apporteurAffaire: apporteurAffaire || null,
        dateEnvoiCompagnie: dateEnvoiCompagnie || null,
        dateRelance: dateRelance || null,
        dateValidation: dateValidation || null,
        etatGlobal: etatGlobal || 'En cours',
        createdBy: createdBy || 'unknown',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      // Sauvegarder l'opération et l'ajouter à la liste des IDs
      await Promise.all([
        kv.set(`operation:${id}`, operation),
        kv.sadd('operations:ids', id)
      ]);

      res.status(201).json({ 
        success: true, 
        id, 
        operation,
        message: 'Opération créée avec succès' 
      });
    } catch (error) {
      console.error('Erreur création opération:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  }
  
  else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}