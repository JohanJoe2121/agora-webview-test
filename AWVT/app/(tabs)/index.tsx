import React, {
  useEffect,
  useState,
} from 'react';

import {
  PermissionsAndroid,
  Platform,
  Pressable,
  SafeAreaView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  Ionicons,
} from '@expo/vector-icons';


import {
  RtcSurfaceView,
} from 'react-native-agora';

import {
  agoraCallService,
} from '../../services/agoracallservices';


import {
  AssistanceSession,
  createAssistanceSession,
  createHelperInviteUrl,
  endAssistanceSession,
} from '../../services/services';

/*
  --------------------------------------------------
  CONFIGURATION
  --------------------------------------------------
*/


export default function HomeScreen() {

  /*
    We now initialize the Agora engine only
    after receiving the App ID from the server.
  */

  const [
    joined,
    setJoined,
  ] =
    useState(false);

  const [
    creatingSession,
    setCreatingSession,
  ] =
    useState(false);

  const [
    remoteUid,
    setRemoteUid,
  ] =
    useState<number | null>(null);

  const [
    status,
    setStatus,
  ] =
    useState(
      'Ready to start assistance call'
    );

  const [
    muted,
    setMuted,
  ] =
    useState(false);

  const [
    frontCamera,
    setFrontCamera,
  ] =
    useState(false);

  /*
    Session information returned by backend.
  */
  const [
    session,
    setSession,
  ] =
    useState<AssistanceSession | null>(
      null
    );


  useEffect(() => {
    return () => {
      cleanupAgora();
    };
  }, []);


  /*
    --------------------------------------------------
    ANDROID PERMISSIONS
    --------------------------------------------------
  */

  const requestPermissions =
    async () => {
      if (
        Platform.OS !==
        'android'
      ) {
        return true;
      }

      const result =
        await PermissionsAndroid
          .requestMultiple([
            PermissionsAndroid
              .PERMISSIONS.CAMERA,

            PermissionsAndroid
              .PERMISSIONS
              .RECORD_AUDIO,
          ]);

      return (
        result[
          PermissionsAndroid
            .PERMISSIONS.CAMERA
        ] ===
          PermissionsAndroid
            .RESULTS.GRANTED &&

        result[
          PermissionsAndroid
            .PERMISSIONS
            .RECORD_AUDIO
        ] ===
          PermissionsAndroid
            .RESULTS.GRANTED
      );
    };


  /*
    --------------------------------------------------
    INITIALIZE AGORA
    --------------------------------------------------
  */

  const initializeAgora =
  async (
    appId: string
  ) => {
    const permissionGranted =
      await requestPermissions();

    if (!permissionGranted) {
      throw new Error(
        'Camera or microphone permission denied'
      );
    }

    agoraCallService.initialize(
      appId,
      {
        onJoined: () => {
          setJoined(true);

          setStatus(
            'Waiting for helper'
          );
        },

        onRemoteUserJoined:
          (uid) => {
            setRemoteUid(uid);

            setStatus(
              'Helper connected'
            );
          },

        onFirstRemoteVideoFrame:
          (
            uid,
            width,
            height
          ) => {
            console.log(
              'REMOTE VIDEO READY:',
              uid,
              width,
              height
            );
          },

        onRemoteUserLeft:
          (_uid) => {
            setRemoteUid(null);

            setStatus(
              'Helper disconnected'
            );
          },

        onError:
          (err) => {
            setStatus(
              `Agora error ${err}`
            );
          },
      }
    );

    setFrontCamera(false);
  };


  /*
    --------------------------------------------------
    CREATE SESSION + JOIN
    --------------------------------------------------
  */

  const startAssistanceCall =
    async () => {
      if (
        creatingSession ||
        joined
      ) {
        return;
      }

      try {
        setCreatingSession(true);

        setStatus(
          'Creating secure assistance session...'
        );


        /*
          Ask backend for fresh:

          - channel
          - token
          - UID
          - helper invitation
        */


        const newSession= await createAssistanceSession();



        console.log(
          'SESSION CREATED:',
          newSession.sessionId
        );


        setSession(
          newSession
        );


        /*
          Initialize Agora using the App ID
          returned by backend.
        */
        await initializeAgora(
          newSession.appId
        );


        setStatus(
  'Joining assistance channel...'
);

agoraCallService.join({
  token:
    newSession.token,

  channelName:
    newSession.channelName,

  uid:
    newSession.uid,
});

      } catch (error) {
        console.log(
          'START CALL ERROR:',
          error
        );

        setStatus(
          `Unable to start call: ${String(
            error
          )}`
        );
      } finally {
        setCreatingSession(
          false
        );
      }
    };


  /*
    --------------------------------------------------
    HELPER INVITE
    --------------------------------------------------
  */

  const shareHelperInvite =
    async () => {
      if (!session) {
        return;
      }


      const helperUrl =
  createHelperInviteUrl(
    session
  );


      try {
        await Share.share({
          title:
            'WalkBuddy Assistance Call',

          message:
            `Please help me through WalkBuddy.\n\n${helperUrl}`,
        });
      } catch (error) {
        console.log(
          'SHARE ERROR:',
          error
        );
      }
    };


  /*
    --------------------------------------------------
    MICROPHONE
    --------------------------------------------------
  */

  const toggleMute =
  () => {
    const nextMuted =
      !muted;

    agoraCallService
      .setMuted(
        nextMuted
      );

    setMuted(
      nextMuted
    );

    setStatus(
      nextMuted
        ? 'Microphone muted'
        : remoteUid
          ? 'Helper connected'
          : 'Waiting for helper'
    );
  };

  /*
    --------------------------------------------------
    CAMERA
    --------------------------------------------------
  */

  const switchCamera =
  () => {
    agoraCallService
      .switchCamera();

    const nextFrontCamera =
      !frontCamera;

    setFrontCamera(
      nextFrontCamera
    );

    setStatus(
      nextFrontCamera
        ? 'Front camera active'
        : 'Rear camera active'
    );
  };

  /*
    --------------------------------------------------
    END SESSION
    --------------------------------------------------
  */

  const leaveChannel =
    async () => {
      const currentSession =
        session;

      /*
        Leave Agora immediately so call
        termination feels instant.
      */
     agoraCallService.leave();

      setJoined(false);
      setRemoteUid(null);
      setMuted(false);

      setStatus(
        'Assistance call ended'
      );


      /*
        Tell backend that this invitation
        is no longer valid.
      */
      if (currentSession) {
  try {
    await endAssistanceSession(
      currentSession
    );
  } catch (error) {
    console.log(
      'END SESSION SERVER ERROR:',
      error
    );
  }
}


      setSession(null);
    };


  /*
    --------------------------------------------------
    CLEANUP
    --------------------------------------------------
  */

  const cleanupAgora =
   () => {
    agoraCallService
      .cleanup();
  };


  /*
    --------------------------------------------------
    UI
    --------------------------------------------------
  */

  return (
    <SafeAreaView
      style={
        styles.container
      }
    >

      <Text
        style={
          styles.title
        }
      >
        Ask a Friend
      </Text>


      <Text
        style={
          styles.status
        }
      >
        {status}
      </Text>


      <Text
        style={
          styles.label
        }
      >
        Helper
      </Text>


      <View
        style={
          styles.remoteVideoContainer
        }
      >

        {remoteUid !== null ? (

          <RtcSurfaceView
            key={
              `remote-${remoteUid}`
            }

            style={
              styles.video
            }

            canvas={{
              uid: remoteUid,
            }}
          />

        ) : (

          <View
            style={
              styles.waitingContainer
            }
          >

            <Ionicons
              name="person-circle-outline"
              size={74}
              color="#777"
            />

            <Text
              style={
                styles.waitingText
              }
            >
              {joined
                ? 'Waiting for helper...'
                : 'Start a call to request help'}
            </Text>

          </View>

        )}

      </View>


      {!joined ? (

        <Pressable
          style={[
            styles.startButton,

            creatingSession &&
              styles.disabledButton,
          ]}

          disabled={
            creatingSession
          }

          onPress={
            startAssistanceCall
          }

          accessibilityRole="button"

          accessibilityLabel={
            creatingSession
              ? 'Creating assistance call'
              : 'Start Ask a Friend call'
          }
        >

          <Ionicons
            name="call"
            size={30}
            color="#fff"
          />

          <Text
            style={
              styles.startButtonText
            }
          >
            {creatingSession
              ? 'Creating Session...'
              : 'Start Assistance Call'}
          </Text>

        </Pressable>

      ) : (

        <>
          {session && (
            <Pressable
              style={
                styles.shareButton
              }

              onPress={
                shareHelperInvite
              }

              accessibilityRole="button"

              accessibilityLabel={
                'Share helper invitation'
              }
            >

              <Ionicons
                name="share-social"
                size={22}
                color="#fff"
              />

              <Text
                style={
                  styles.shareButtonText
                }
              >
                Invite Helper
              </Text>

            </Pressable>
          )}


          <View
            style={
              styles.callControls
            }
          >

            {/* MICROPHONE */}

            <View
              style={
                styles.controlWrapper
              }
            >

              <Pressable
                style={[
                  styles.controlButton,

                  muted &&
                    styles.activeControlButton,
                ]}

                onPress={
                  toggleMute
                }

                accessibilityRole="button"

                accessibilityLabel={
                  muted
                    ? 'Unmute microphone'
                    : 'Mute microphone'
                }
              >

                <Ionicons
                  name={
                    muted
                      ? 'mic-off'
                      : 'mic'
                  }

                  size={32}

                  color="#fff"
                />

              </Pressable>


              <Text
                style={
                  styles.controlLabel
                }
              >
                {muted
                  ? 'Unmute'
                  : 'Mute'}
              </Text>

            </View>


            {/* CAMERA */}

            <View
              style={
                styles.controlWrapper
              }
            >

              <Pressable
                style={
                  styles.controlButton
                }

                onPress={
                  switchCamera
                }

                accessibilityRole="button"

                accessibilityLabel={
                  'Switch camera'
                }
              >

                <Ionicons
                  name="camera-reverse"
                  size={34}
                  color="#fff"
                />

              </Pressable>


              <Text
                style={
                  styles.controlLabel
                }
              >
                Switch
              </Text>

            </View>


            {/* END */}

            <View
              style={
                styles.controlWrapper
              }
            >

              <Pressable
                style={[
                  styles.controlButton,
                  styles.endCallButton,
                ]}

                onPress={
                  leaveChannel
                }

                accessibilityRole="button"

                accessibilityLabel={
                  'End assistance call'
                }
              >

                <Ionicons
                  name="call"
                  size={32}
                  color="#fff"

                  style={
                    styles.endCallIcon
                  }
                />

              </Pressable>


              <Text
                style={
                  styles.controlLabel
                }
              >
                End
              </Text>

            </View>

          </View>
        </>

      )}

    </SafeAreaView>
  );
}


/*
  --------------------------------------------------
  STYLES
  --------------------------------------------------
*/

const styles =
  StyleSheet.create({

    container: {
      flex: 1,

      backgroundColor:
        '#000',

      paddingHorizontal:
        20,

      paddingTop:
        18,
    },


    title: {
      fontSize: 34,

      fontWeight:
        'bold',

      color:
        '#fff',

      marginBottom:
        8,
    },


    status: {
      fontSize: 18,

      color:
        '#ddd',

      marginBottom:
        18,
    },


    label: {
      fontSize: 21,

      color:
        '#fff',

      marginBottom:
        8,
    },


    remoteVideoContainer: {
      width:
        '100%',

      flex: 1,

      minHeight:
        340,

      backgroundColor:
        '#181818',

      borderRadius:
        18,

      overflow:
        'hidden',
    },


    video: {
      width:
        '100%',

      height:
        '100%',
    },


    waitingContainer: {
      flex:
        1,

      alignItems:
        'center',

      justifyContent:
        'center',
    },


    waitingText: {
      color:
        '#aaa',

      fontSize:
        18,

      marginTop:
        12,

      textAlign:
        'center',
    },


    startButton: {
      minHeight:
        72,

      marginTop:
        20,

      marginBottom:
        18,

      borderRadius:
        18,

      backgroundColor:
        '#2389da',

      flexDirection:
        'row',

      alignItems:
        'center',

      justifyContent:
        'center',

      gap:
        12,
    },


    disabledButton: {
      opacity:
        0.55,
    },


    startButtonText: {
      color:
        '#fff',

      fontSize:
        20,

      fontWeight:
        '600',
    },


    shareButton: {
      minHeight:
        52,

      marginTop:
        16,

      borderRadius:
        14,

      backgroundColor:
        '#2389da',

      flexDirection:
        'row',

      gap:
        9,

      alignItems:
        'center',

      justifyContent:
        'center',
    },


    shareButtonText: {
      color:
        '#fff',

      fontSize:
        17,

      fontWeight:
        '600',
    },


    callControls: {
      flexDirection:
        'row',

      justifyContent:
        'space-evenly',

      alignItems:
        'flex-start',

      paddingTop:
        18,

      paddingBottom:
        18,
    },


    controlWrapper: {
      alignItems:
        'center',
    },


    controlButton: {
      width:
        68,

      height:
        68,

      borderRadius:
        34,

      backgroundColor:
        '#333',

      alignItems:
        'center',

      justifyContent:
        'center',
    },


    activeControlButton: {
      backgroundColor:
        '#555',
    },


    endCallButton: {
      backgroundColor:
        '#d32f2f',
    },


    endCallIcon: {
      transform: [
        {
          rotate:
            '135deg',
        },
      ],
    },


    controlLabel: {
      color:
        '#fff',

      marginTop:
        7,

      fontSize:
        14,

      fontWeight:
        '500',
    },

  });