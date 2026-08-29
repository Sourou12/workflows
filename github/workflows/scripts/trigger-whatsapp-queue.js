const { chromium } = require('playwright');

(async () => {
  const cronUrl = process.env.CRON_URL;
  const cronKey = process.env.CRON_KEY;

  if (!cronUrl || !cronKey) {
    console.error('CRON_URL ou CRON_KEY manquant (vérifie les secrets du dépôt GitHub).');
    process.exit(1);
  }

  const url = `${cronUrl}?cle=${encodeURIComponent(cronKey)}`;

  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });

    // La première réponse d'infinityfree est souvent la page de vérification
    // anti-bot, qui pose un cookie via JS puis redirige automatiquement.
    // On attend cette redirection avant de lire le vrai contenu.
    let body = await page.textContent('body');
    let tentatives = 0;
    while (body && body.includes('requires Javascript') && tentatives < 5) {
      await page.waitForNavigation({ waitUntil: 'networkidle', timeout: 15000 }).catch(() => {});
      body = await page.textContent('body');
      tentatives++;
    }

    console.log('Réponse finale du serveur :');
    console.log(body);

    try {
      const stats = JSON.parse(body.trim());
      if (stats.success) {
        console.log(
          `Lot traité : ${stats.total_envoyes} envoyé(s), ${stats.total_echecs} échec(s), ${stats.restants} restant(s) en file.`
        );
      } else {
        console.error('Le script a répondu mais signale une erreur :', stats.error || stats);
        process.exitCode = 1;
      }
    } catch (e) {
      console.error(
        "Impossible d'interpréter la réponse comme du JSON (mur anti-bot toujours actif, ou clé secrète invalide)."
      );
      process.exitCode = 1;
    }
  } finally {
    await browser.close();
  }
})();
