export default async (req) => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const redirectUri =
    "https://iridescent-meerkat-175e49.netlify.app/.netlify/functions/google-auth-callback";

  if (!clientId) {
    return new Response("Configuration Google incomplète.", { status: 500 });
  }

  const state = crypto.randomUUID();

  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "https://www.googleapis.com/auth/calendar");
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("state", state);

  return new Response(null, {
    status: 302,
    headers: {
      Location: url.toString(),
      "Set-Cookie": `oauth_state=${state}; HttpOnly; Secure; SameSite=Lax; Path=/.netlify/functions; Max-Age=600`
    }
  });
};
