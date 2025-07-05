import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  const { id } = req.query;

  if (!id || isNaN(id)) {
    return res.status(400).json({ error: 'ID opération invalide' });
  }

  const operationKey = `operation:${id}`;

  if (req.method === 'GET') {
    try {
      const operation = await kv.get(operationKey);
      
      if (!operation) {
        return res.status(404).json({ error: 'Opération non trouvée' });
      }
      
      res.status(200).json(operation);
    } catch (error) {
      console.error('Erreur récupération opération:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  }
  
  else if (req.method === 'PUT') {
    try {
      // Récupérer l'opération existante
      const existingOperation = await kv.get(operationKey);
      
      if (!existingOperation) {
        return res.status(404).json({ error: 'Opération non trouvée' });
      }

      const {
        nomClient, nouveauClient, conseiller, assistantBO, domaine,
        fournisseur, nomContrat, referenceContrat, typeActe, montant,
        pourcentageFrais, partieIncomprise, ca, apporteurAffaire,
        dateEnvoiCompagnie, dateRelance, dateValidation, etatGlobal
      } = req.body;

      // Mettre à jour l'opération
      const updatedOperation = {
        ...existingOperation,
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
        updatedAt: new Date().toISOString()
      };

      await kv.set(operationKey, updatedOperation);

      res.status(200).json({ 
        success: true, 
        operation: updatedOperation,
        message: 'Opération mise à jour avec succès' 
      });
    } catch (error) {
      console.error('Erreur mise à jour opération:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  }
  
  else if (req.method === 'DELETE') {
    try {
      // Vérifier que l'opération existe
      const operation = await kv.get(operationKey);
      
      if (!operation) {
        return res.status(404).json({ error: 'Opération non trouvée' });
      }

      // Supprimer l'opération et la retirer de la liste des IDs
      await Promise.all([
        kv.del(operationKey),
        kv.srem('operations:ids', id)
      ]);
      
      res.status(200).json({ 
        success: true, 
        message: 'Opération supprimée avec succès' 
      });
    } catch (error) {
      console.error('Erreur suppression opération:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  }
  
  else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}
