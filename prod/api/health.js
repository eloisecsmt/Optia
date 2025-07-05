export default async function handler(req, res) {
  res.status(200).json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    message: 'Serveur Vercel KV opérationnel'
  });
}
