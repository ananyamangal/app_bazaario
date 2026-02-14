import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Dimensions,
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as FileSystem from 'expo-file-system/legacy';

import Constants from 'expo-constants';
import * as ImagePicker from 'expo-image-picker';
import { Audio } from 'expo-av';
import { colors } from '../theme/colors';
import { radius, spacing } from '../theme/spacing';
import { useCall } from '../context/CallContext';
import { useAuth } from '../context/AuthContext';
import { apiPostAuth } from '../api/client';

// Request camera and microphone permissions (required for video/voice call)
async function requestMediaPermissions(): Promise<boolean> {
  try {
    if (Platform.OS === 'android') {
      const { status: cameraStatus } = await ImagePicker.requestCameraPermissionsAsync();
      if (cameraStatus !== 'granted') {
        Alert.alert(
          'Camera required',
          'Please allow camera access to make video calls.',
          [{ text: 'OK' }]
        );
        return false;
      }
      const { status: audioStatus } = await Audio.requestPermissionsAsync();
      if (audioStatus !== 'granted') {
        Alert.alert(
          'Microphone required',
          'Please allow microphone access for voice and video calls.',
          [{ text: 'OK' }]
        );
        return false;
      }
    }
    // iOS: permissions are requested by the system when we first use camera/mic;
    // we still request explicitly so the prompt appears before joining
    if (Platform.OS === 'ios') {
      const { status: cameraStatus } = await ImagePicker.requestCameraPermissionsAsync();
      if (cameraStatus !== 'granted') {
        Alert.alert(
          'Camera required',
          'Please allow camera access in Settings to make video calls.',
          [{ text: 'OK' }]
        );
        return false;
      }
      const { status: audioStatus } = await Audio.requestPermissionsAsync();
      if (audioStatus !== 'granted') {
        Alert.alert(
          'Microphone required',
          'Please allow microphone access in Settings for voice and video calls.',
          [{ text: 'OK' }]
        );
        return false;
      }
    }
    return true;
  } catch (e) {
    console.error('[VideoCall] Permission request failed:', e);
    Alert.alert('Error', 'Could not request camera or microphone permission.');
    return false;
  }
}

// Only load Agora when not in Expo Go so the app can start in Expo Go
let createAgoraRtcEngine: any;
let RtcSurfaceView: any;
let ChannelProfileType: any;
let ClientRoleType: any;

if (Constants.appOwnership !== 'expo') {
  try {
    const agora = require('react-native-agora');
    createAgoraRtcEngine = agora.createAgoraRtcEngine;
    RtcSurfaceView = agora.RtcSurfaceView;
    ChannelProfileType = agora.ChannelProfileType;
    ClientRoleType = agora.ClientRoleType;
  } catch (_) {}
}

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

type Props = {
  onClose: () => void;
};

// -----------------------------------------------------------------------------
// Helper
// -----------------------------------------------------------------------------

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

// -----------------------------------------------------------------------------
// Main Component
// -----------------------------------------------------------------------------

export default function VideoCallScreen({ onClose }: Props) {
  const insets = useSafeAreaInsets();
  const engineRef = useRef<any>(null);

  const { user } = useAuth();
  const {
    callState,
    currentCall,
    agoraConfig,
    callDuration,
    isMuted,
    isCameraOff,
    isSpeakerOn,
    endCall,
    resetCallState,
    toggleMute,
    toggleCamera,
    toggleSpeaker,
    switchCamera,
  } = useCall();

  // Customer: camera off by default. Seller: camera on.
  const isCustomer = user?.role === 'customer';
  const [remoteUid, setRemoteUid] = useState<number | null>(null);
  const [invoiceItemName, setInvoiceItemName] = useState('');
  const [invoicePrice, setInvoicePrice] = useState('');
  const [invoiceQuantity, setInvoiceQuantity] = useState('1');
  const [invoiceImageUri, setInvoiceImageUri] = useState<string | null>(null);
  const [invoiceImageBase64, setInvoiceImageBase64] = useState<string | null>(null);
  const [invoiceSubmitting, setInvoiceSubmitting] = useState(false);
  const [isJoined, setIsJoined] = useState(false);
  const [localVideoEnabled, setLocalVideoEnabled] = useState(!isCustomer);
  const [debugLogs, setDebugLogs] = useState<string[]>([]);
  const initStartedRef = useRef(false);

  const addDebugLog = (msg: string) => {
    const line = `[${new Date().toISOString().slice(11, 23)}] ${msg}`;
    setDebugLogs((prev) => [...prev.slice(-19), line]);
  };

  // Initialize Agora engine when we have token (customer gets it when seller accepts)
  useEffect(() => {
    if (!agoraConfig) return;

    if (!createAgoraRtcEngine) {
      Alert.alert(
        'Video not available',
        'Video calling requires a development build. It does not run in Expo Go. Build with: npx expo run:android (or run:ios)'
      );
      return;
    }

    if (initStartedRef.current) {
      addDebugLog('Skip: init already in progress');
      return;
    }

    const initAgora = async () => {
      initStartedRef.current = true;
      try {
        addDebugLog(`Config: channel=${agoraConfig.channelName} myUid=${agoraConfig.uid}`);
        const hasPermission = await requestMediaPermissions();
        if (!hasPermission) {
          addDebugLog('Permission denied');
          initStartedRef.current = false;
          return;
        }
        addDebugLog('Permissions OK, initializing...');

        const engine = createAgoraRtcEngine();
        engineRef.current = engine;

        engine.initialize({
          appId: agoraConfig.appId,
          channelProfile: ChannelProfileType?.ChannelProfileCommunication,
        });

        engine.registerEventHandler({
          onJoinChannelSuccess: (_conn: any, elapsed: number) => {
            addDebugLog(`Joined channel OK (elapsed ${elapsed}ms)`);
            setIsJoined(true);
          },
          onUserJoined: (_conn: any, uid: number, elapsed: number) => {
            addDebugLog(`Remote user joined uid=${uid} (elapsed ${elapsed}ms)`);
            try {
              engine.setupRemoteVideo({ uid });
            } catch (e) {
              addDebugLog(`setupRemoteVideo err: ${String(e)}`);
            }
            setRemoteUid(uid);
          },
          onUserOffline: (_conn: any, uid: number) => {
            addDebugLog(`Remote user offline uid=${uid}`);
            setRemoteUid((prev) => (prev === uid ? null : prev));
          },
          onError: (err: number, msg: string) => {
            addDebugLog(`Agora ERROR code=${err} msg=${msg}`);
          },
        });

        engine.enableAudio();
        engine.enableVideo();
        engine.startPreview();
        engine.setClientRole(ClientRoleType?.ClientRoleBroadcaster);
        try {
          engine.enableInstantMediaRendering?.();
        } catch (_) {}

        // Customer: start with camera off (mute local video)
        if (isCustomer) {
          try {
            engine.muteLocalVideoStream(true);
          } catch (_) {}
          setLocalVideoEnabled(false);
        }

        addDebugLog('Calling joinChannel...');
        const joinRet = engine.joinChannel(
          agoraConfig.token,
          agoraConfig.channelName,
          agoraConfig.uid,
          {
            clientRoleType: ClientRoleType?.ClientRoleBroadcaster,
            channelProfile: ChannelProfileType?.ChannelProfileCommunication,
            publishCameraTrack: !isCustomer,
            publishMicrophoneTrack: true,
            autoSubscribeAudio: true,
            autoSubscribeVideo: true,
          }
        );
        addDebugLog(`joinChannel returned: ${joinRet} (0=OK, <0=fail)`);
        if (joinRet !== 0) {
          addDebugLog('Join failed. Check token/channel/uid or Agora ERROR above.');
        }
      } catch (error) {
        addDebugLog(`Init failed: ${String(error)}`);
        initStartedRef.current = false;
        Alert.alert('Error', 'Failed to initialize video call');
      }
    };

    initAgora();

    return () => {
      initStartedRef.current = false;
      if (engineRef.current) {
        try {
          engineRef.current.leaveChannel();
          engineRef.current.release();
        } catch (e) {}
        engineRef.current = null;
      }
    };
  }, [agoraConfig, isCustomer]);

  const handleEndCall = async () => {
    await endCall();
    // Customer leaves screen; seller stays to see "Call ended" and post-call invoice form
    if (!currentCall?.isIncoming) {
      onClose();
    }
  };

  const handleToggleMute = () => {
    if (engineRef.current) engineRef.current.muteLocalAudioStream(!isMuted);
    toggleMute();
  };

  const handleToggleCamera = () => {
    if (engineRef.current) engineRef.current.muteLocalVideoStream(!isCameraOff);
    setLocalVideoEnabled(isCameraOff);
    toggleCamera();
  };

  const handleSwitchCamera = () => {
    if (engineRef.current) engineRef.current.switchCamera();
    switchCamera();
  };

  const handleToggleSpeaker = () => {
    if (engineRef.current) engineRef.current.setEnableSpeakerphone(!isSpeakerOn);
    toggleSpeaker();
  };

  const showPostCallForm = callState === 'ended' && currentCall?.isIncoming;

  const pickInvoiceImageFromSource = async (useCamera: boolean) => {
    try {
      if (useCamera) {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) {
          Alert.alert('Permission needed', 'Allow camera access to take a product photo.');
          return;
        }
      } else {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) {
          Alert.alert('Permission needed', 'Allow photo access to attach product image.');
          return;
        }
      }
      const result = useCamera
        ? await ImagePicker.launchCameraAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.8,
          })
        : await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.8,
          });
      if (result.canceled || !result.assets[0]?.uri) return;
      const uri = result.assets[0].uri;
      setInvoiceImageUri(uri);
      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      setInvoiceImageBase64(base64);
    } catch (e) {
      Alert.alert('Error', 'Failed to pick image');
    }
  };

  const handlePickInvoiceImage = () => {
    Alert.alert('Product image', 'Choose source', [
      { text: 'Take photo', onPress: () => pickInvoiceImageFromSource(true) },
      { text: 'Choose from gallery', onPress: () => pickInvoiceImageFromSource(false) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const handleSubmitInvoice = async () => {
    const name = invoiceItemName.trim();
    const price = parseFloat(invoicePrice);
    const qty = parseInt(invoiceQuantity, 10);
    if (!name) {
      Alert.alert('Required', 'Enter item name.');
      return;
    }
    if (Number.isNaN(price) || price < 0) {
      Alert.alert('Required', 'Enter a valid price.');
      return;
    }
    if (Number.isNaN(qty) || qty < 1) {
      Alert.alert('Required', 'Enter quantity (at least 1).');
      return;
    }
    if (!currentCall?.callId) return;
    setInvoiceSubmitting(true);
    try {
      await apiPostAuth(`/calls/${currentCall.callId}/invoice`, {
        itemName: name,
        price,
        quantity: qty,
        imageBase64: invoiceImageBase64 || undefined,
      });
      Alert.alert('Done', 'Invoice sent to the customer. They can view cart and checkout.');
      resetCallState();
      onClose();
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to submit invoice');
    } finally {
      setInvoiceSubmitting(false);
    }
  };

  const handleSkipInvoice = () => {
    resetCallState();
    onClose();
  };

  const renderStatus = () => {
    switch (callState) {
      case 'requesting': return 'Requesting call...';
      case 'ringing': return 'Ringing...';
      case 'connecting': return 'Connecting...';
      case 'in_call': return remoteUid ? formatDuration(callDuration) : 'Waiting for other party...';
      case 'ended': return 'Call ended';
      default: return '';
    }
  };

  const showControls = callState === 'in_call' || callState === 'connecting';

  return (
    <View style={styles.container}>
      {/* Remote Video */}
      {RtcSurfaceView && remoteUid && isJoined ? (
        <RtcSurfaceView style={styles.remoteVideo} canvas={{ uid: remoteUid }} />
      ) : (
        <View style={styles.remoteVideoPlaceholder}>
          <View style={styles.placeholderIcon}>
            <Ionicons name="person" size={80} color={colors.mutedForeground} />
          </View>
          {callState !== 'in_call' && (
            <ActivityIndicator size="large" color={colors.card} style={styles.loadingIndicator} />
          )}
        </View>
      )}

      {/* Local Video (Picture-in-picture) */}
      {RtcSurfaceView && isJoined && localVideoEnabled && (
        <View style={[styles.localVideoContainer, { top: insets.top + spacing.md }]}>
          <RtcSurfaceView style={styles.localVideo} canvas={{ uid: 0 }} zOrderMediaOverlay={true} />
        </View>
      )}

      {/* Top Bar */}
      <View style={[styles.topBar, { paddingTop: insets.top + spacing.sm }]}>
        <View style={styles.callInfo}>
          <Text style={styles.callName}>
            {currentCall?.isIncoming ? currentCall.customerName || 'Customer' : currentCall?.shopName || 'Shop'}
          </Text>
          <Text style={styles.callStatus}>{renderStatus()}</Text>
        </View>
      </View>

      {/* Debug log (screenshot for support) */}
      <View style={[styles.debugPanel, { top: insets.top + 100 }]}>
        <Text style={styles.debugTitle}>Debug (send SS if call fails)</Text>
        <ScrollView style={styles.debugScroll} nestedScrollEnabled>
          {debugLogs.length === 0 ? (
            <Text style={styles.debugLine}>—</Text>
          ) : (
            debugLogs.map((line, i) => (
              <Text key={i} style={styles.debugLine} numberOfLines={2}>
                {line}
              </Text>
            ))
          )}
        </ScrollView>
      </View>

      {/* Controls */}
      {showControls && (
        <View style={[styles.controlsContainer, { paddingBottom: insets.bottom + spacing.xl }]}>
          <View style={styles.controlsRow}>
            <Pressable style={[styles.controlButton, isMuted && styles.controlButtonActive]} onPress={handleToggleMute}>
              <Ionicons name={isMuted ? 'mic-off' : 'mic'} size={28} color={colors.card} />
              <Text style={styles.controlLabel}>{isMuted ? 'Unmute' : 'Mute'}</Text>
            </Pressable>
            <Pressable style={[styles.controlButton, isCameraOff && styles.controlButtonActive]} onPress={handleToggleCamera}>
              <Ionicons name={isCameraOff ? 'videocam-off' : 'videocam'} size={28} color={colors.card} />
              <Text style={styles.controlLabel}>{isCameraOff ? 'Camera On' : 'Camera Off'}</Text>
            </Pressable>
            <Pressable style={styles.controlButton} onPress={handleSwitchCamera}>
              <Ionicons name="camera-reverse" size={28} color={colors.card} />
              <Text style={styles.controlLabel}>Flip</Text>
            </Pressable>
            <Pressable style={[styles.controlButton, !isSpeakerOn && styles.controlButtonActive]} onPress={handleToggleSpeaker}>
              <Ionicons name={isSpeakerOn ? 'volume-high' : 'volume-mute'} size={28} color={colors.card} />
              <Text style={styles.controlLabel}>{isSpeakerOn ? 'Speaker' : 'Earpiece'}</Text>
            </Pressable>
          </View>
          <Pressable style={styles.endCallButton} onPress={handleEndCall}>
            <Ionicons name="call" size={32} color={colors.card} />
          </Pressable>
        </View>
      )}

      {/* Waiting / Cancel */}
      {!showControls && callState !== 'ended' && (
        <View style={[styles.waitingControls, { paddingBottom: insets.bottom + spacing.xl }]}>
          <Pressable style={styles.endCallButton} onPress={handleEndCall}>
            <Ionicons name="call" size={32} color={colors.card} />
          </Pressable>
          <Text style={styles.cancelText}>Cancel</Text>
        </View>
      )}

      {/* Post-call invoice form (seller only) */}
      <Modal visible={showPostCallForm} transparent animationType="slide">
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.invoiceModalOverlay}
        >
          <View style={[styles.invoiceModal, { paddingBottom: insets.bottom + 24 }]}>
            <Text style={styles.invoiceModalTitle}>Call summary – send invoice</Text>
            <Text style={styles.invoiceModalSubtitle}>Add the item you agreed on so the customer can checkout.</Text>
            <ScrollView style={styles.invoiceForm} showsVerticalScrollIndicator={false}>
              <Text style={styles.invoiceLabel}>Item name</Text>
              <TextInput
                style={styles.invoiceInput}
                value={invoiceItemName}
                onChangeText={setInvoiceItemName}
                placeholder="e.g. Blue silk saree"
                placeholderTextColor={colors.mutedForeground}
              />
              <Text style={styles.invoiceLabel}>Price (₹)</Text>
              <TextInput
                style={styles.invoiceInput}
                value={invoicePrice}
                onChangeText={setInvoicePrice}
                placeholder="0"
                placeholderTextColor={colors.mutedForeground}
                keyboardType="decimal-pad"
              />
              <Text style={styles.invoiceLabel}>Quantity</Text>
              <TextInput
                style={styles.invoiceInput}
                value={invoiceQuantity}
                onChangeText={setInvoiceQuantity}
                placeholder="1"
                placeholderTextColor={colors.mutedForeground}
                keyboardType="number-pad"
              />
              <Text style={styles.invoiceLabel}>Product image</Text>
              <Pressable style={styles.invoiceImageBtn} onPress={handlePickInvoiceImage}>
                {invoiceImageUri ? (
                  <Image source={{ uri: invoiceImageUri }} style={styles.invoiceImage} resizeMode="cover" />
                ) : (
                  <>
                    <Ionicons name="image-outline" size={32} color={colors.primary} />
                    <Text style={styles.invoiceImageBtnText}>Add image</Text>
                  </>
                )}
              </Pressable>
            </ScrollView>
            <View style={styles.invoiceActions}>
              <Pressable style={styles.invoiceSkipBtn} onPress={handleSkipInvoice}>
                <Text style={styles.invoiceSkipBtnText}>Skip</Text>
              </Pressable>
              <Pressable
                style={[styles.invoiceSubmitBtn, invoiceSubmitting && styles.invoiceSubmitBtnDisabled]}
                onPress={handleSubmitInvoice}
                disabled={invoiceSubmitting}
              >
                {invoiceSubmitting ? (
                  <ActivityIndicator size="small" color={colors.card} />
                ) : (
                  <Text style={styles.invoiceSubmitBtnText}>Send invoice</Text>
                )}
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  remoteVideo: { flex: 1, width: SCREEN_WIDTH, height: SCREEN_HEIGHT },
  remoteVideoPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
  },
  placeholderIcon: {
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingIndicator: { position: 'absolute', bottom: '30%' },
  localVideoContainer: {
    position: 'absolute',
    right: spacing.md,
    width: 120,
    height: 160,
    borderRadius: radius.md,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: colors.card,
  },
  localVideo: { flex: 1 },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  callInfo: { alignItems: 'center' },
  callName: {
    fontSize: 24,
    fontWeight: '600',
    color: colors.card,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  callStatus: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.8)',
    marginTop: spacing.xs,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  controlsContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
  },
  controlsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    marginBottom: spacing.xl,
  },
  controlButton: { alignItems: 'center', padding: spacing.sm },
  controlButtonActive: { opacity: 0.6 },
  controlLabel: {
    fontSize: 12,
    color: colors.card,
    marginTop: 4,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  endCallButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#FF3B30',
    justifyContent: 'center',
    alignItems: 'center',
    transform: [{ rotate: '135deg' }],
  },
  waitingControls: { position: 'absolute', bottom: 0, left: 0, right: 0, alignItems: 'center' },
  cancelText: { fontSize: 16, color: colors.card, marginTop: spacing.md },
  debugPanel: {
    position: 'absolute',
    left: spacing.sm,
    right: spacing.sm,
    maxHeight: 180,
    backgroundColor: 'rgba(0,0,0,0.75)',
    borderRadius: 8,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  debugTitle: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.9)',
    marginBottom: 4,
    fontWeight: '600',
  },
  debugScroll: { maxHeight: 150 },
  debugLine: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.85)',
    fontFamily: Platform.OS === 'android' ? 'monospace' : 'Menlo',
    marginBottom: 2,
  },
  invoiceModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  invoiceModal: {
    backgroundColor: colors.card,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    maxHeight: '85%',
  },
  invoiceModalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.foreground,
  },
  invoiceModalSubtitle: {
    fontSize: 14,
    color: colors.mutedForeground,
    marginTop: 4,
    marginBottom: spacing.md,
  },
  invoiceForm: { maxHeight: 320 },
  invoiceLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.foreground,
    marginBottom: 6,
  },
  invoiceInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: colors.foreground,
    marginBottom: spacing.md,
  },
  invoiceImageBtn: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderStyle: 'dashed',
    padding: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
    minHeight: 100,
  },
  invoiceImageBtnText: { fontSize: 14, color: colors.primary, marginTop: 8 },
  invoiceImage: { width: 80, height: 80, borderRadius: radius.sm },
  invoiceActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: spacing.md,
  },
  invoiceSkipBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  invoiceSkipBtnText: { fontSize: 16, fontWeight: '600', color: colors.mutedForeground },
  invoiceSubmitBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: radius.lg,
    backgroundColor: colors.primary,
    alignItems: 'center',
  },
  invoiceSubmitBtnDisabled: { opacity: 0.6 },
  invoiceSubmitBtnText: { fontSize: 16, fontWeight: '600', color: colors.card },
});
