const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
require('dotenv').config();

const {
  RtcTokenBuilder,
  RtcRole,
} = require('agora-token');

const app = express();

const PORT = Number(process.env.PORT || 3001);

const APP_ID = process.env.AGORA_APP_ID;
const APP_CERTIFICATE =
  process.env.AGORA_APP_CERTIFICATE;

if (!APP_ID || !APP_CERTIFICATE) {
  console.error(
    'Missing AGORA_APP_ID or AGORA_APP_CERTIFICATE in .env'
  );

  process.exit(1);
}

/*
  Prototype CORS configuration.

  GitHub Pages and the Android app both need access
  during development.

  We can restrict this further when integrating into
  the real WalkBuddy project.
*/
app.use(cors());

app.use(express.json());


/*
  --------------------------------------------------
  IN-MEMORY SESSION STORAGE
  --------------------------------------------------

  Prototype only.

  Restarting Node clears all active sessions.

  Later WalkBuddy integration should move this to
  persistent storage.
*/

const sessions = new Map();
const inviteLookup = new Map();


/*
  --------------------------------------------------
  HELPERS
  --------------------------------------------------
*/

function createRandomId(bytes = 24) {
  return crypto
    .randomBytes(bytes)
    .toString('hex');
}


function createAgoraUid() {
  /*
    Agora numeric UID must be unique inside
    the channel.

    We stay safely inside the positive
    32-bit integer range.
  */
  return crypto.randomInt(
    1000,
    2_000_000_000
  );
}


function generateAgoraToken(
  channelName,
  uid
) {
  /*
    Agora Token 2.x uses validity durations
    measured from now.

    One hour is enough for this prototype.
  */

  const tokenExpireSeconds = 3600;
  const privilegeExpireSeconds = 3600;

  return RtcTokenBuilder.buildTokenWithUid(
    APP_ID,
    APP_CERTIFICATE,
    channelName,
    uid,
    RtcRole.PUBLISHER,
    tokenExpireSeconds,
    privilegeExpireSeconds
  );
}


function sessionExpired(session) {
  return Date.now() > session.expiresAt;
}


/*
  --------------------------------------------------
  HEALTH CHECK
  --------------------------------------------------
*/

app.get(
  '/api/health',
  (_req, res) => {
    res.json({
      ok: true,
      service:
        'WalkBuddy Session Server',
    });
  }
);


/*
  --------------------------------------------------
  CREATE ASSISTANCE SESSION
  --------------------------------------------------

  Called by Android when the blind user
  presses Start Assistance Call.

  Returns:

  - unique Agora channel
  - Android UID
  - Android token
  - helper invite ID
  - session secret for ending the call
*/

app.post(
  '/api/sessions',
  (_req, res) => {
    try {
      const sessionId =
        createRandomId(12);

      const inviteId =
        createRandomId(24);

      const sessionSecret =
        createRandomId(24);

      const channelName =
        `wb_${sessionId}`;

      const userUid =
        createAgoraUid();

      const userToken =
        generateAgoraToken(
          channelName,
          userUid
        );

      const now = Date.now();

      const session = {
        sessionId,
        inviteId,
        sessionSecret,

        channelName,

        createdAt: now,

        /*
          Whole assistance session expires
          after one hour.
        */
        expiresAt:
          now + 60 * 60 * 1000,

        ended: false,

        userUid,

        /*
          Helper slot starts empty.
        */
        helperClaimed: false,
        helperUid: null,

        /*
          Browser-specific secret generated
          when the first helper claims the slot.

          Allows THAT browser to reconnect.
        */
        helperAccessKey: null,
      };

      sessions.set(
        sessionId,
        session
      );

      inviteLookup.set(
        inviteId,
        sessionId
      );

      console.log(
        '[SESSION CREATED]',
        sessionId,
        channelName
      );

      return res.status(201).json({
        sessionId,

        appId: APP_ID,

        channelName,

        uid: userUid,

        token: userToken,

        inviteId,

        sessionSecret,

        expiresAt:
          session.expiresAt,
      });
    } catch (error) {
      console.error(
        'CREATE SESSION ERROR:',
        error
      );

      return res.status(500).json({
        error:
          'Unable to create assistance session',
      });
    }
  }
);


/*
  --------------------------------------------------
  CLAIM HELPER SLOT
  --------------------------------------------------

  The FIRST browser using the invite gets
  the helper position.

  A different browser using the same invite
  afterwards receives HTTP 409.

  The original helper stores helperAccessKey
  in localStorage and can therefore refresh
  and reconnect.
*/

app.post(
  '/api/invites/:inviteId/claim',
  (req, res) => {
    try {
      const {
        inviteId,
      } = req.params;

      const {
        accessKey,
      } = req.body || {};

      const sessionId =
        inviteLookup.get(inviteId);

      if (!sessionId) {
        return res.status(404).json({
          error:
            'Invalid assistance invitation',
        });
      }

      const session =
        sessions.get(sessionId);

      if (!session) {
        return res.status(404).json({
          error:
            'Assistance session not found',
        });
      }

      if (session.ended) {
        return res.status(410).json({
          error:
            'This assistance session has ended',
        });
      }

      if (sessionExpired(session)) {
        return res.status(410).json({
          error:
            'This assistance session has expired',
        });
      }


      /*
        --------------------------------------------
        ORIGINAL HELPER RECONNECT
        --------------------------------------------
      */

      if (
        session.helperClaimed &&
        typeof accessKey === 'string' &&
        accessKey.length > 0 &&
        accessKey ===
          session.helperAccessKey
      ) {
        const helperToken =
          generateAgoraToken(
            session.channelName,
            session.helperUid
          );

        console.log(
          '[HELPER RECONNECTED]',
          session.sessionId
        );

        return res.json({
          appId: APP_ID,

          sessionId:
            session.sessionId,

          channelName:
            session.channelName,

          uid:
            session.helperUid,

          token:
            helperToken,

          accessKey:
            session.helperAccessKey,

          reconnect: true,
        });
      }


      /*
        --------------------------------------------
        HELPER SLOT ALREADY OCCUPIED
        --------------------------------------------
      */

      if (
        session.helperClaimed
      ) {
        console.log(
          '[HELPER REJECTED - SLOT FULL]',
          session.sessionId
        );

        return res.status(409).json({
          error:
            'A helper has already joined this assistance session',
        });
      }


      /*
        --------------------------------------------
        FIRST HELPER CLAIM
        --------------------------------------------
      */

      const helperUid =
        createAgoraUid();

      const helperAccessKey =
        createRandomId(24);

      session.helperClaimed =
        true;

      session.helperUid =
        helperUid;

      session.helperAccessKey =
        helperAccessKey;

      const helperToken =
        generateAgoraToken(
          session.channelName,
          helperUid
        );

      console.log(
        '[HELPER CLAIMED]',
        session.sessionId,
        'UID:',
        helperUid
      );

      return res.json({
        appId: APP_ID,

        sessionId:
          session.sessionId,

        channelName:
          session.channelName,

        uid:
          helperUid,

        token:
          helperToken,

        accessKey:
          helperAccessKey,

        reconnect: false,
      });
    } catch (error) {
      console.error(
        'CLAIM INVITE ERROR:',
        error
      );

      return res.status(500).json({
        error:
          'Unable to join assistance session',
      });
    }
  }
);


/*
  --------------------------------------------------
  END SESSION
  --------------------------------------------------

  Android receives sessionSecret when creating
  the session.

  Helper never receives this secret.

  Once ended, that invite can no longer issue
  new helper tokens.
*/

app.post(
  '/api/sessions/:sessionId/end',
  (req, res) => {
    try {
      const {
        sessionId,
      } = req.params;

      const {
        sessionSecret,
      } = req.body || {};

      const session =
        sessions.get(sessionId);

      if (!session) {
        return res.status(404).json({
          error:
            'Session not found',
        });
      }

      if (
        !sessionSecret ||
        sessionSecret !==
          session.sessionSecret
      ) {
        return res.status(403).json({
          error:
            'Not authorized to end this session',
        });
      }

      session.ended = true;

      console.log(
        '[SESSION ENDED]',
        sessionId
      );

      return res.json({
        success: true,
      });
    } catch (error) {
      console.error(
        'END SESSION ERROR:',
        error
      );

      return res.status(500).json({
        error:
          'Unable to end assistance session',
      });
    }
  }
);


/*
  --------------------------------------------------
  START SERVER
  --------------------------------------------------
*/

app.listen(
  PORT,
  '0.0.0.0',
  () => {
    console.log('');
    console.log(
      'WalkBuddy Session Server'
    );

    console.log(
      `Listening on port ${PORT}`
    );

    console.log('');
  }
);