import {
  ChannelProfileType,
  ClientRoleType,
  createAgoraRtcEngine,
  IRtcEngine,
} from 'react-native-agora';

export type AgoraCallCallbacks = {
  onJoined: () => void;

  onRemoteUserJoined: (
    uid: number
  ) => void;

  onRemoteUserLeft: (
    uid: number
  ) => void;

  onFirstRemoteVideoFrame?: (
    uid: number,
    width: number,
    height: number
  ) => void;

  onError?: (
    errorCode: number,
    message?: string
  ) => void;
};

export type JoinAgoraCallOptions = {
  token: string;
  channelName: string;
  uid: number;
};

class AgoraCallService {
  private engine:
    IRtcEngine | null = null;

  private initialized = false;

  /*
    ----------------------------------------
    INITIALIZE
    ----------------------------------------
  */

  initialize(
    appId: string,
    callbacks: AgoraCallCallbacks
  ) {
    if (this.initialized) {
      return;
    }

    console.log(
      'Creating Agora engine...'
    );

    const engine =
      createAgoraRtcEngine();

    this.engine = engine;

    engine.initialize({
      appId,

      channelProfile:
        ChannelProfileType
          .ChannelProfileCommunication,
    });

    /*
      ----------------------------------------
      EVENTS
      ----------------------------------------
    */

    engine.registerEventHandler({
      onJoinChannelSuccess:
        (
          connection,
          uid
        ) => {
          console.log(
            'JOIN SUCCESS:',
            connection.channelId,
            uid
          );

          callbacks.onJoined();
        },

      onUserJoined:
        (
          _connection,
          uid
        ) => {
          console.log(
            'HELPER JOINED:',
            uid
          );

          callbacks
            .onRemoteUserJoined(uid);
        },

      onFirstRemoteVideoFrame:
        (
          _connection,
          uid,
          width,
          height
        ) => {
          console.log(
            'FIRST REMOTE VIDEO FRAME:',
            uid,
            width,
            height
          );

          callbacks
            .onFirstRemoteVideoFrame?.(
              uid,
              width,
              height
            );
        },

      onUserOffline:
        (
          _connection,
          uid
        ) => {
          console.log(
            'HELPER LEFT:',
            uid
          );

          callbacks
            .onRemoteUserLeft(uid);
        },

      onError:
        (
          err,
          msg
        ) => {
          console.log(
            'AGORA ERROR:',
            err,
            msg
          );

          callbacks
            .onError?.(
              err,
              msg
            );
        },
    });

    /*
      Start video preview.

      Agora initially starts with the
      front camera, so switch once to
      make WalkBuddy start on the rear
      camera.
    */

    engine.enableVideo();

    engine.startPreview();

    engine.switchCamera();

    this.initialized = true;

    console.log(
      'Agora initialized'
    );
  }

  /*
    ----------------------------------------
    JOIN
    ----------------------------------------
  */

  join(
    options: JoinAgoraCallOptions
  ) {
    if (!this.engine) {
      throw new Error(
        'Agora engine has not been initialized'
      );
    }

    const result =
      this.engine.joinChannel(
        options.token,
        options.channelName,
        options.uid,
        {
          clientRoleType:
            ClientRoleType
              .ClientRoleBroadcaster,

          channelProfile:
            ChannelProfileType
              .ChannelProfileCommunication,

          publishMicrophoneTrack:
            true,

          publishCameraTrack:
            true,

          autoSubscribeAudio:
            true,

          autoSubscribeVideo:
            true,
        }
      );

    console.log(
      'joinChannel result:',
      result
    );

    if (result < 0) {
      throw new Error(
        `Agora rejected joinChannel with code ${result}`
      );
    }

    return result;
  }

  /*
    ----------------------------------------
    MICROPHONE
    ----------------------------------------
  */

  setMuted(
    muted: boolean
  ) {
    if (!this.engine) {
      return;
    }

    this.engine
      .muteLocalAudioStream(
        muted
      );
  }

  /*
    ----------------------------------------
    CAMERA
    ----------------------------------------
  */

  switchCamera() {
    if (!this.engine) {
      return;
    }

    this.engine
      .switchCamera();
  }

  /*
    ----------------------------------------
    LEAVE
    ----------------------------------------
  */

  leave() {
    if (!this.engine) {
      return;
    }

    this.engine
      .leaveChannel();
  }

  /*
    ----------------------------------------
    CLEANUP
    ----------------------------------------
  */

  cleanup() {
    if (!this.engine) {
      return;
    }

    try {
      this.engine
        .leaveChannel();

      this.engine
        .stopPreview();

      this.engine
        .release();

    } catch (error) {
      console.log(
        'AGORA CLEANUP ERROR:',
        error
      );
    }

    this.engine = null;
    this.initialized = false;
  }
}

export const agoraCallService =
  new AgoraCallService();