export type AssistanceSession = {
  sessionId: string;
  appId: string;
  channelName: string;
  uid: number;
  token: string;
  inviteId: string;
  sessionSecret: string;
  expiresAt: number;
};

function getBackendUrl() {
  const url =
    process.env.EXPO_PUBLIC_BACKEND_URL ?? '';

  if (!url) {
    throw new Error(
      'EXPO_PUBLIC_BACKEND_URL is not configured'
    );
  }

  return url.replace(/\/+$/, '');
}

function getHelperPageUrl() {
  const url =
    process.env.EXPO_PUBLIC_HELPER_PAGE_URL ?? '';

  if (!url) {
    throw new Error(
      'EXPO_PUBLIC_HELPER_PAGE_URL is not configured'
    );
  }

  return url.replace(/\/+$/, '');
}

export async function createAssistanceSession():
  Promise<AssistanceSession> {

  const backendUrl =
    getBackendUrl();

  const response =
    await fetch(
      `${backendUrl}/api/sessions`,
      {
        method: 'POST',
        headers: {
          'Content-Type':
            'application/json',
        },
      }
    );

  if (!response.ok) {
    const body =
      await response.text();

    throw new Error(
      `Session server returned ${response.status}: ${body}`
    );
  }

  return await response.json();
}

export function createHelperInviteUrl(
  session: AssistanceSession
) {
  const backendUrl =
    getBackendUrl();

  const helperPageUrl =
    getHelperPageUrl();

  return (
    `${helperPageUrl}` +
    `?invite=${encodeURIComponent(
      session.inviteId
    )}` +
    `&api=${encodeURIComponent(
      backendUrl
    )}`
  );
}

export async function endAssistanceSession(
  session: AssistanceSession
) {
  const backendUrl =
    getBackendUrl();

  const response =
    await fetch(
      `${backendUrl}/api/sessions/${session.sessionId}/end`,
      {
        method: 'POST',

        headers: {
          'Content-Type':
            'application/json',
        },

        body:
          JSON.stringify({
            sessionSecret:
              session.sessionSecret,
          }),
      }
    );

  if (!response.ok) {
    const body =
      await response.text();

    throw new Error(
      `Unable to end session: ${response.status} ${body}`
    );
  }
}