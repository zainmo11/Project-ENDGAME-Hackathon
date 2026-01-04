import { useEffect, useRef, useState, useCallback } from 'react';
import { Socket } from 'socket.io-client';

interface UseWebRTCVideoOptions {
    socket: Socket | null;
    isConnected: boolean;
    localVideoRef?: React.RefObject<HTMLVideoElement | null>;
    remoteVideoRef?: React.RefObject<HTMLVideoElement | null>;
    role: 'TECH' | 'RADIOLOGIST'; // Each role has their own camera
}

interface UseWebRTCVideoReturn {
    isVideoActive: boolean;
    isRemoteConnected: boolean;
    startVideo: () => Promise<void>;
    stopVideo: () => void;
    localStream: MediaStream | null;
}

const ICE_SERVERS = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
];

export function useWebRTCVideo({
    socket,
    isConnected,
    localVideoRef,
    remoteVideoRef,
    role,
}: UseWebRTCVideoOptions): UseWebRTCVideoReturn {
    const [isVideoActive, setIsVideoActive] = useState(false);
    const [isRemoteConnected, setIsRemoteConnected] = useState(false);
    const [localStream, setLocalStream] = useState<MediaStream | null>(null);

    const peerConnection = useRef<RTCPeerConnection | null>(null);
    const localStreamRef = useRef<MediaStream | null>(null);
    const pendingCandidates = useRef<RTCIceCandidate[]>([]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            stopVideo();
        };
    }, []);

    const createPeerConnection = useCallback(() => {
        const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

        pc.onicecandidate = (event) => {
            if (event.candidate && socket) {
                console.log(`[WebRTC Video ${role}] Sending ICE candidate`);
                socket.emit('webrtc-video-ice-candidate', { candidate: event.candidate, role });
            }
        };

        pc.ontrack = (event) => {
            console.log(`[WebRTC Video ${role}] Remote track received:`, event.track.kind);
            if (remoteVideoRef?.current && event.streams[0]) {
                remoteVideoRef.current.srcObject = event.streams[0];
                setIsRemoteConnected(true);
            }
        };

        pc.onconnectionstatechange = () => {
            console.log(`[WebRTC Video ${role}] Connection state:`, pc.connectionState);
            if (pc.connectionState === 'connected') {
                setIsRemoteConnected(true);
            } else if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
                setIsRemoteConnected(false);
            }
        };

        pc.oniceconnectionstatechange = () => {
            console.log(`[WebRTC Video ${role}] ICE connection state:`, pc.iceConnectionState);
        };

        return pc;
    }, [socket, remoteVideoRef, role]);

    const startVideo = useCallback(async () => {
        if (!socket || !isConnected) {
            console.error(`[WebRTC Video ${role}] Socket not connected`);
            return;
        }

        try {
            // Get camera access - both roles share their camera
            const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    width: { ideal: 1280 },
                    height: { ideal: 720 }
                },
                audio: true
            });
            localStreamRef.current = stream;
            setLocalStream(stream);

            // Show local preview
            if (localVideoRef?.current) {
                localVideoRef.current.srcObject = stream;
            }

            // Create peer connection
            const pc = createPeerConnection();
            peerConnection.current = pc;

            // Add local tracks
            stream.getTracks().forEach(track => {
                console.log(`[WebRTC Video ${role}] Adding track:`, track.kind);
                pc.addTrack(track, stream);
            });

            // Create and send offer
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);

            socket.emit('webrtc-video-offer', { offer, role });
            setIsVideoActive(true);
            console.log(`[WebRTC Video ${role}] Video started, offer sent`);
        } catch (error) {
            console.error(`[WebRTC Video ${role}] Failed to start video:`, error);
            alert('Could not access camera. Please check permissions.');
        }
    }, [socket, isConnected, role, createPeerConnection, localVideoRef]);

    const stopVideo = useCallback(() => {
        // Stop local tracks
        localStreamRef.current?.getTracks().forEach(track => track.stop());
        localStreamRef.current = null;
        setLocalStream(null);

        // Close peer connection
        peerConnection.current?.close();
        peerConnection.current = null;

        // Clear video elements
        if (localVideoRef?.current) {
            localVideoRef.current.srcObject = null;
        }
        if (remoteVideoRef?.current) {
            remoteVideoRef.current.srcObject = null;
        }

        setIsVideoActive(false);
        setIsRemoteConnected(false);
        pendingCandidates.current = [];
    }, [localVideoRef, remoteVideoRef]);

    // Handle incoming WebRTC events
    useEffect(() => {
        if (!socket) return;

        const handleVideoOffer = async ({ offer, from, senderRole }: { offer: RTCSessionDescriptionInit; from: string; senderRole: string }) => {
            // Only handle offers from the OTHER role
            if (senderRole === role) return;

            console.log(`[WebRTC Video ${role}] Received video offer from ${senderRole}:`, from);

            try {
                // Get our own camera to send back
                let stream = localStreamRef.current;
                if (!stream) {
                    stream = await navigator.mediaDevices.getUserMedia({
                        video: {
                            width: { ideal: 1280 },
                            height: { ideal: 720 }
                        },
                        audio: true
                    });
                    localStreamRef.current = stream;
                    setLocalStream(stream);

                    // Show local preview
                    if (localVideoRef?.current) {
                        localVideoRef.current.srcObject = stream;
                    }
                }

                // Create peer connection
                const pc = createPeerConnection();
                peerConnection.current = pc;

                // Add our local tracks so the other side can see us
                stream.getTracks().forEach(track => {
                    console.log(`[WebRTC Video ${role}] Adding track to answer:`, track.kind);
                    pc.addTrack(track, stream);
                });

                // Set remote description
                await pc.setRemoteDescription(new RTCSessionDescription(offer));

                // Apply pending ICE candidates
                for (const candidate of pendingCandidates.current) {
                    await pc.addIceCandidate(candidate);
                }
                pendingCandidates.current = [];

                // Create and send answer
                const answer = await pc.createAnswer();
                await pc.setLocalDescription(answer);

                socket.emit('webrtc-video-answer', { answer, to: from, role });
                setIsVideoActive(true);
                console.log(`[WebRTC Video ${role}] Video answer sent`);
            } catch (error) {
                console.error(`[WebRTC Video ${role}] Failed to handle video offer:`, error);
            }
        };

        const handleVideoAnswer = async ({ answer, from, senderRole }: { answer: RTCSessionDescriptionInit; from: string; senderRole: string }) => {
            // Only handle answers from the OTHER role
            if (senderRole === role) return;

            console.log(`[WebRTC Video ${role}] Received video answer from ${senderRole}:`, from);

            if (peerConnection.current) {
                try {
                    await peerConnection.current.setRemoteDescription(new RTCSessionDescription(answer));

                    // Apply pending ICE candidates
                    for (const candidate of pendingCandidates.current) {
                        await peerConnection.current.addIceCandidate(candidate);
                    }
                    pendingCandidates.current = [];
                    console.log(`[WebRTC Video ${role}] Remote description set`);
                } catch (error) {
                    console.error(`[WebRTC Video ${role}] Failed to set remote description:`, error);
                }
            }
        };

        const handleVideoIceCandidate = async ({ candidate, from, senderRole }: { candidate: RTCIceCandidateInit; from: string; senderRole: string }) => {
            // Only handle ICE from the OTHER role
            if (senderRole === role) return;

            console.log(`[WebRTC Video ${role}] Received ICE candidate from ${senderRole}`);
            if (peerConnection.current && peerConnection.current.remoteDescription) {
                try {
                    await peerConnection.current.addIceCandidate(new RTCIceCandidate(candidate));
                } catch (error) {
                    console.error(`[WebRTC Video ${role}] Failed to add ICE candidate:`, error);
                }
            } else {
                // Queue candidate if remote description not set yet
                pendingCandidates.current.push(new RTCIceCandidate(candidate));
            }
        };

        socket.on('webrtc-video-offer', handleVideoOffer);
        socket.on('webrtc-video-answer', handleVideoAnswer);
        socket.on('webrtc-video-ice-candidate', handleVideoIceCandidate);

        return () => {
            socket.off('webrtc-video-offer', handleVideoOffer);
            socket.off('webrtc-video-answer', handleVideoAnswer);
            socket.off('webrtc-video-ice-candidate', handleVideoIceCandidate);
        };
    }, [socket, createPeerConnection, role, localVideoRef]);

    return {
        isVideoActive,
        isRemoteConnected,
        startVideo,
        stopVideo,
        localStream,
    };
}

export default useWebRTCVideo;
