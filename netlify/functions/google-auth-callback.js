
export default async (req) => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri =
    "https://iridescent-meerkat-175e49.netlify.app/.netlify/functions/google-auth-callback";

  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  const cookies = Object.fromEntries(
    (req.headers.get("cookie") || "")
      .split(";")
      .map(item => {
        const parts = item.trim().split("=");
        return [parts.shift(), parts.join("=")];
      })
  );

  const page = (message) => new Response(
    `<!doctype html><html lang="fr"><meta charset="utf-8"><body style="font-family:Arial;padding:30px">${message}</body></html>`,
    {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store"
      }
    }
  );

  if (error) return page("<h2>Autorisation Google annulée.</h2>");

  if (!clientId || !clientSecret || !code || !state ||
      state !== cookies.oauth_state) {
    return page("<h2>Connexion impossible.</h2><p>Vérification de sécurité échouée ou configuration incomplète.</p>");
  }

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
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
    return page("<h2>Google n'a pas fourni l'autorisation attendue.</h2><p>Il faudra vérifier la configuration OAuth.</p>");
  }

  return page(
    "<h2>Autorisation Google réussie.</h2>" +
    "<p>Le jeton de renouvellement a été obtenu. Il devra être enregistré dans une variable sécurisée Netlify avant toute utilisation du calendrier.</p>" +
    "<p>Ne partagez jamais ce jeton.</p>" +
    "<textarea readonly style='width:100%;height:100px'>" +
    tokens.refresh_token +
    "</textarea>"
  );
};
