import { useEffect, useRef, useState, useCallback } from 'react';
import { Socket } from 'socket.io-client';

interface UseWebRTCVoiceOptions {
    socket: Socket | null;
    isConnected: boolean;
}

interface UseWebRTCVoiceReturn {
    isVoiceActive: boolean;
    isMuted: boolean;
    isRemoteConnected: boolean;
    startVoice: () => Promise<void>;
    stopVoice: () => void;
    toggleMute: () => void;
}

const ICE_SERVERS = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
];

export function useWebRTCVoice({ socket, isConnected }: UseWebRTCVoiceOptions): UseWebRTCVoiceReturn {
    const [isVoiceActive, setIsVoiceActive] = useState(false);
    const [isMuted, setIsMuted] = useState(false);
    const [isRemoteConnected, setIsRemoteConnected] = useState(false);

    const peerConnection = useRef<RTCPeerConnection | null>(null);
    const localStream = useRef<MediaStream | null>(null);
    const remoteAudio = useRef<HTMLAudioElement | null>(null);
    const pendingCandidates = useRef<RTCIceCandidate[]>([]);

    // Create audio element for remote audio playback
    useEffect(() => {
        if (!remoteAudio.current) {
            remoteAudio.current = new Audio();
            remoteAudio.current.autoplay = true;
        }
        return () => {
            remoteAudio.current?.pause();
            remoteAudio.current = null;
        };
    }, []);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            stopVoice();
        };
    }, []);

    const createPeerConnection = useCallback(() => {
        const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

        pc.onicecandidate = (event) => {
            if (event.candidate && socket) {
                socket.emit('webrtc-ice-candidate', { candidate: event.candidate });
            }
        };

        pc.ontrack = (event) => {
            console.log('[WebRTC] Remote track received');
            if (remoteAudio.current && event.streams[0]) {
                remoteAudio.current.srcObject = event.streams[0];
                setIsRemoteConnected(true);
            }
        };

        pc.onconnectionstatechange = () => {
            console.log('[WebRTC] Connection state:', pc.connectionState);
            if (pc.connectionState === 'connected') {
                setIsRemoteConnected(true);
            } else if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
                setIsRemoteConnected(false);
            }
        };

        return pc;
    }, [socket]);

    const startVoice = useCallback(async () => {
        if (!socket || !isConnected) {
            console.error('[WebRTC] Socket not connected');
            return;
        }

        try {
            // Get microphone access
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
            localStream.current = stream;

            // Create peer connection
            const pc = createPeerConnection();
            peerConnection.current = pc;

            // Add local audio track
            stream.getTracks().forEach(track => {
                pc.addTrack(track, stream);
            });

            // Create and send offer
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);

            socket.emit('webrtc-offer', offer);
            setIsVoiceActive(true);
            console.log('[WebRTC] Voice started, offer sent');
        } catch (error) {
            console.error('[WebRTC] Failed to start voice:', error);
            alert('Could not access microphone. Please check permissions.');
        }
    }, [socket, isConnected, createPeerConnection]);

    const stopVoice = useCallback(() => {
        // Stop local tracks
        localStream.current?.getTracks().forEach(track => track.stop());
        localStream.current = null;

        // Close peer connection
        peerConnection.current?.close();
        peerConnection.current = null;

        // Clear remote audio
        if (remoteAudio.current) {
            remoteAudio.current.srcObject = null;
        }

        setIsVoiceActive(false);
        setIsRemoteConnected(false);
        pendingCandidates.current = [];
    }, []);

    const toggleMute = useCallback(() => {
        if (localStream.current) {
            const audioTrack = localStream.current.getAudioTracks()[0];
            if (audioTrack) {
                audioTrack.enabled = !audioTrack.enabled;
                setIsMuted(!audioTrack.enabled);
            }
        }
    }, []);

    // Handle incoming WebRTC events
    useEffect(() => {
        if (!socket) return;

        const handleOffer = async ({ offer, from }: { offer: RTCSessionDescriptionInit; from: string }) => {
            console.log('[WebRTC] Received offer from:', from);

            try {
                // Get microphone access
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
                localStream.current = stream;

                // Create peer connection
                const pc = createPeerConnection();
                peerConnection.current = pc;

                // Add local audio track
                stream.getTracks().forEach(track => {
                    pc.addTrack(track, stream);
                });

                // Set remote description and create answer
                await pc.setRemoteDescription(new RTCSessionDescription(offer));

                // Apply pending ICE candidates
                for (const candidate of pendingCandidates.current) {
                    await pc.addIceCandidate(candidate);
                }
                pendingCandidates.current = [];

                const answer = await pc.createAnswer();
                await pc.setLocalDescription(answer);

                socket.emit('webrtc-answer', { answer, to: from });
                setIsVoiceActive(true);
                console.log('[WebRTC] Answer sent');
            } catch (error) {
                console.error('[WebRTC] Failed to handle offer:', error);
            }
        };

        const handleAnswer = async ({ answer, from }: { answer: RTCSessionDescriptionInit; from: string }) => {
            console.log('[WebRTC] Received answer from:', from);

            if (peerConnection.current) {
                try {
                    await peerConnection.current.setRemoteDescription(new RTCSessionDescription(answer));

                    // Apply pending ICE candidates
                    for (const candidate of pendingCandidates.current) {
                        await peerConnection.current.addIceCandidate(candidate);
                    }
                    pendingCandidates.current = [];
                    console.log('[WebRTC] Remote description set');
                } catch (error) {
                    console.error('[WebRTC] Failed to set remote description:', error);
                }
            }
        };

        const handleIceCandidate = async ({ candidate, from }: { candidate: RTCIceCandidateInit; from: string }) => {
            if (peerConnection.current && peerConnection.current.remoteDescription) {
                try {
                    await peerConnection.current.addIceCandidate(new RTCIceCandidate(candidate));
                } catch (error) {
                    console.error('[WebRTC] Failed to add ICE candidate:', error);
                }
            } else {
                // Queue candidate if remote description not set yet
                pendingCandidates.current.push(new RTCIceCandidate(candidate));
            }
        };

        socket.on('webrtc-offer', handleOffer);
        socket.on('webrtc-answer', handleAnswer);
        socket.on('webrtc-ice-candidate', handleIceCandidate);

        return () => {
            socket.off('webrtc-offer', handleOffer);
            socket.off('webrtc-answer', handleAnswer);
            socket.off('webrtc-ice-candidate', handleIceCandidate);
        };
    }, [socket, createPeerConnection]);

    return {
        isVoiceActive,
        isMuted,
        isRemoteConnected,
        startVoice,
        stopVoice,
        toggleMute,
    };
}

export default useWebRTCVoice;
