
export default async (request) => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  const redirectUri =
    "https://iridescent-meerkat-175e49.netlify.app/.netlify/functions/google-auth-callback";

  const page = (title, message) => new Response(
    `<!doctype html>
    <html lang="fr">
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width">
    <title>${title}</title>
    <body style="font-family:Arial;padding:25px;max-width:700px;margin:auto">
    <h2>${title}</h2>${message}</body></html>`,
    {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store, private"
      }
    }
  );

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  const cookies = Object.fromEntries(
    (request.headers.get("cookie") || "")
      .split(";")
      .map(item => {
        const parts = item.trim().split("=");
        return [parts.shift(), parts.join("=")];
      })
  );

  if (url.searchParams.get("error")) {
    return page("Connexion annulée", "<p>Google n'a pas autorisé la connexion.</p>");
  }

  if (!clientId || !clientSecret || !code || !state ||
      state !== cookies.oauth_state) {
    return page("Connexion impossible", "<p>La vérification de sécurité a échoué. Recommencez la connexion.</p>");
  }

  try {
    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code"
      })
    });

    const tokens = await response.json();

    if (!response.ok || !tokens.refresh_token) {
      return page(
        "Autorisation incomplète",
        "<p>Google n'a pas fourni de jeton de renouvellement. Il faudra vérifier la configuration.</p>"
      );
    }

    return page(
      "Connexion Google réussie",
      `<p>Copiez le jeton ci-dessous. Il faudra le conserver dans une variable secrète Netlify.</p>
      <textarea readonly style="width:100%;height:110px">${tokens.refresh_token}</textarea>
      <p><strong>Ne partagez jamais ce jeton.</strong></p>`
    );
  } catch {
    return page("Erreur", "<p>La connexion avec Google a échoué. Réessayez plus tard.</p>");
  }
};
