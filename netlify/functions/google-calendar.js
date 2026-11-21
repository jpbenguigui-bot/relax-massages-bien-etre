
const TIME_ZONE = "Europe/Paris";
const BUFFER_MINUTES = 60;

function localTimeToUTC(year, month, day, hour, minute = 0) {
  const target = Date.UTC(year, month - 1, day, hour, minute);
  let guess = target;

  for (let i = 0; i < 3; i++) {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: TIME_ZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23"
    }).formatToParts(new Date(guess));

    const values = Object.fromEntries(
      parts.map(part => [part.type, part.value])
    );

    const represented = Date.UTC(
      Number(values.year),
      Number(values.month) - 1,
      Number(values.day),
      Number(values.hour),
      Number(values.minute),
      Number(values.second)
    );

    guess += target - represented;
  }

  return new Date(guess);
}

export default async (request) => {
  const headers = {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  };

  const reply = (status, data) =>
    new Response(JSON.stringify(data), { status, headers });

  if (request.method !== "GET") {
    return reply(405, { error: "Méthode non autorisée." });
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;
  const calendarId = process.env.GOOGLE_CALENDAR_ID || "primary";

  if (!clientId || !clientSecret || !refreshToken) {
    return reply(503, {
      error: "Configuration Google incomplète dans Netlify."
    });
  }

  const url = new URL(request.url);
  const date = url.searchParams.get("date");

  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return reply(400, {
      error: "Indiquez une date au format AAAA-MM-JJ."
    });
  }

  const [year, month, day] = date.split("-").map(Number);
  const checkDate = new Date(Date.UTC(year, month - 1, day));

  if (
    checkDate.getUTCFullYear() !== year ||
    checkDate.getUTCMonth() !== month - 1 ||
    checkDate.getUTCDate() !== day
  ) {
    return reply(400, { error: "Date invalide." });
  }

  const start = localTimeToUTC(year, month, day, 0);
  const nextDay = new Date(Date.UTC(year, month - 1, day + 1));

  const end = localTimeToUTC(
    nextDay.getUTCFullYear(),
    nextDay.getUTCMonth() + 1,
    nextDay.getUTCDate(),
    0
  );

  try {
    const tokenResponse = await fetch(
      "https://oauth2.googleapis.com/token",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded"
        },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          refresh_token: refreshToken,
          grant_type: "refresh_token"
        })
      }
    );

    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok || !tokenData.access_token) {
      return reply(502, {
        error: "Impossible de se connecter à Google Agenda."
      });
    }

    const calendarResponse = await fetch(
      "https://www.googleapis.com/calendar/v3/freeBusy",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenData.access_token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          timeMin: start.toISOString(),
          timeMax: end.toISOString(),
          timeZone: TIME_ZONE,
          items: [{ id: calendarId }]
        })
      }
    );

    const calendarData = await calendarResponse.json();

    if (!calendarResponse.ok) {
      return reply(502, {
        error: "Google Agenda n'a pas pu fournir les disponibilités."
      });
    }

    const calendars = calendarData.calendars || {};
    const busy = calendars[calendarId]?.busy || [];

    const blocked = busy.map(period => ({
      start: period.start,
      end: new Date(
        new Date(period.end).getTime() +
        BUFFER_MINUTES * 60 * 1000
      ).toISOString()
    }));

    return reply(200, {
      date,
      timeZone: TIME_ZONE,
      bufferMinutes: BUFFER_MINUTES,
      blocked
    });

  } catch (error) {
    return reply(500, {
      error: "Erreur lors de la consultation de Google Agenda."
    });
  }
};
