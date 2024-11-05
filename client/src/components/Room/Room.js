import React, { useState, useEffect, useRef } from "react";
import Peer from "simple-peer";
import styled from "styled-components";
import socket from "../../socket";
import VideoCard from "../Video/VideoCard";
import BottomBar from "../BottomBar/BottomBar";
import Chat from "../Chat/Chat";
import { useParams, useNavigate } from 'react-router-dom';

const Room = () => {
  const navigate = useNavigate();
  const { roomId } = useParams();
  const currentUser = sessionStorage.getItem("user");
  
  const [peers, setPeers] = useState([]);
  const [userVideoAudio, setUserVideoAudio] = useState({
    localUser: { video: true, audio: true },
  });
  const [videoDevices, setVideoDevices] = useState([]);
  const [displayChat, setDisplayChat] = useState(false);
  const [screenShare, setScreenShare] = useState(false);
  const [showVideoDevices, setShowVideoDevices] = useState(false);
  
  const peersRef = useRef([]);
  const userVideoRef = useRef();
  const screenTrackRef = useRef();
  const userStream = useRef();
  const handlePeerError = (error, peerId) => {
    console.error(`Peer error for ${peerId}:`, error);
    const peerToRemove = findPeer(peerId);
    if (peerToRemove) {
      peerToRemove.peer.destroy();
      setPeers(currentPeers => 
        currentPeers.filter(p => p.peerID !== peerId)
      );
    }
  };
  const checkMediaDevices = async () => {
    try {
      // Request permissions first
      await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      return true;
    } catch (err) {
      console.error('Media Device Error:', err);
      if (err.name === 'NotAllowedError') {
        alert('Please allow camera and microphone permissions to join the meeting.');
      } else if (err.name === 'NotFoundError') {
        alert('No camera or microphone found. Please connect a device.');
      } else {
        alert('Unable to access camera/microphone. Error: ' + err.message);
      }
      navigate('/');
      return false;
    }
  };

  useEffect(() => {
    if (!currentUser) {
      navigate('/');
      return;
    }
  
    const initializeMedia = async () => {
      try {
        if (!await checkMediaDevices()) return;
    
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: true, 
          audio: true 
        });
        
        userVideoRef.current.srcObject = stream;
        userStream.current = stream;
        
        console.log('Media stream initialized successfully');
    
        // Setup all socket event listeners
        const setupSocketListeners = () => {
          // Join room
          console.log('Attempting to join room:', roomId, 'as user:', currentUser);
          socket.emit("BE-join-room", { roomId, userName: currentUser });
          
          // Listen for new users joining
          socket.on("FE-user-join", (users) => {
            console.log('FE-user-join received:', users);
            
            try {
              const peers = [];
              users.forEach(({ userId, info }) => {
                let { userName, video, audio } = info;
                
                if (userName !== currentUser) {
                  console.log('Attempting to create peer for:', userName, userId);
                  const peer = createPeer(userId, socket.id, userStream.current);
                  
                  if (peer) {
                    peer.userName = userName;
                    peer.peerID = userId;
                    
                    peer.on('error', (err) => handlePeerError(err, userId));
                    
                    peersRef.current.push({
                      peerID: userId,
                      peer,
                      userName,
                    });
                    peers.push(peer);
            
                    setUserVideoAudio((preList) => ({
                      ...preList,
                      [userName]: { video, audio },
                    }));
                  }
                }
              });
              
              if (peers.length > 0) {
                setPeers(peers);
              }
            } catch (error) {
              console.error('Error processing new users:', error);
            }
          });
  
          // Listen for incoming calls
          socket.on("FE-receive-call", ({ signal, from, info }) => {
            console.log('Received call from:', from);
            const { userName, video, audio } = info;
            const peerIdx = findPeer(from);
  
            if (!peerIdx) {
              const peer = addPeer(signal, from, stream);
              peer.userName = userName;
  
              peersRef.current.push({
                peerID: from,
                peer,
                userName: userName,
              });
              setPeers(users => [...users, peer]);
            }
          });
  
          // Listen for accepted calls
          socket.on("FE-call-accepted", ({ signal, answerId }) => {
            const peerIdx = findPeer(answerId);
            if (peerIdx && !peerIdx.peer.destroyed) {
              try {
                console.log(`[${answerId}] Processing accepted call`);
                if (peerIdx.peer.connectionState === 'offer-sent') {
                  peerIdx.peer.signal(signal);
                  peerIdx.peer.connectionState = 'answer-received';
                } else {
                  console.log(`[${answerId}] Ignoring signal in state:`, peerIdx.peer.connectionState);
                }
              } catch (err) {
                console.error(`[${answerId}] Error handling accepted call:`, err);
                if (!err.message.includes('wrong state')) {
                  handlePeerError(err, answerId);
                }
              }
            }
          });
  
          socket.on("FE-user-leave", ({ userId, userName }) => {
            console.log('User left:', userName);
            const peerIdx = findPeer(userId);
            if (peerIdx) {
              peerIdx.peer.destroy();
              setPeers(users => users.filter(user => user.peerID !== peerIdx.peer.peerID));
            }
          });
        };
  
        setupSocketListeners();
        
      } catch (err) {
        console.error('Error in initializeMedia:', err);
        alert('Error connecting to media devices: ' + err.message);
        navigate('/');
      }
    };
  
    initializeMedia();
  
    // Cleanup function
   // In your useEffect cleanup
return () => {
  console.log('Cleaning up Room component...');
  
  // Clean up peers
  peersRef.current.forEach(({ peer }) => {
    if (peer && !peer.destroyed) {
      peer.destroy();
    }
  });
  peersRef.current = [];
  setPeers([]);

  // Clean up socket listeners
  socket.off("FE-user-join");
  socket.off("FE-receive-call");
  socket.off("FE-call-accepted");
  socket.off("FE-user-leave");
  
  // Clean up media streams
  if (userStream.current) {
    userStream.current.getTracks().forEach(track => track.stop());
  }
  if (screenTrackRef.current) {
    screenTrackRef.current.stop();
  }
};
  }, [currentUser, navigate, roomId]);

  function createPeer(userId, caller, stream) {
    try {
      const peer = new Peer({
        initiator: true,
        trickle: false,
        stream,
        config: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:global.stun.twilio.com:3478' }
          ]
        }
      });
  
      peer.connectionState = 'new';
      peer._userId = userId; // Store userId for debugging
  
      peer.on("signal", (signal) => {
        if (peer.connectionState === 'new') {
          console.log(`[${userId}] Sending initial offer`);
          socket.emit("BE-call-user", {
            userToCall: userId,
            from: caller,
            signal,
          });
          peer.connectionState = 'offer-sent';
        }
      });
  
      peer.on("connect", () => {
        console.log(`[${userId}] Peer connected successfully`);
        peer.connectionState = 'connected';
      });
  
      peer.on("stream", (remoteStream) => {
        console.log(`[${userId}] Received stream`);
        if (!peer.destroyed) {
          peer.remoteStream = remoteStream;
          const event = new CustomEvent('peerStream', { 
            detail: { peerId: userId, stream: remoteStream } 
          });
          window.dispatchEvent(event);
        }
      });
  
      peer.on("error", (err) => {
        console.error(`[${userId}] Peer error:`, err.message);
        if (err.message.includes('wrong state')) {
          if (peer.connectionState === 'offer-sent') {
            console.log(`[${userId}] Recovering from wrong state, destroying peer`);
            peer.destroy();
            // Recreate peer after a short delay
            setTimeout(() => {
              const newPeer = createPeer(userId, caller, stream);
              if (newPeer) {
                setPeers(currentPeers => {
                  const filtered = currentPeers.filter(p => p.peerID !== userId);
                  return [...filtered, newPeer];
                });
              }
            }, 1000);
          }
        } else {
          handlePeerError(err, userId);
        }
      });
  
      peer.on("close", () => {
        console.log(`[${userId}] Peer connection closed`);
        peer.connectionState = 'closed';
      });
  
      return peer;
    } catch (err) {
      console.error('Error creating peer:', err);
      return null;
    }
  }
  
  function addPeer(incomingSignal, callerId, stream) {
    try {
      const peer = new Peer({
        initiator: false,
        trickle: false,
        stream,
        config: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:global.stun.twilio.com:3478' }
          ]
        }
      });
  
      peer.connectionState = 'new';
      peer._userId = callerId;
  
      peer.on("signal", (signal) => {
        if (peer.connectionState === 'new') {
          console.log(`[${callerId}] Sending answer`);
          socket.emit("BE-accept-call", { signal, to: callerId });
          peer.connectionState = 'answer-sent';
        }
      });
  
      peer.on("connect", () => {
        console.log(`[${callerId}] Peer connected successfully`);
        peer.connectionState = 'connected';
      });
  
      peer.on("stream", (remoteStream) => {
        console.log(`[${callerId}] Received stream`);
        if (!peer.destroyed) {
          peer.remoteStream = remoteStream;
          const event = new CustomEvent('peerStream', { 
            detail: { peerId: callerId, stream: remoteStream } 
          });
          window.dispatchEvent(event);
        }
      });
  
      peer.on("error", (err) => {
        console.error(`[${callerId}] Peer error:`, err.message);
        if (!err.message.includes('wrong state')) {
          handlePeerError(err, callerId);
        }
      });
  
      peer.on("close", () => {
        console.log(`[${callerId}] Peer connection closed`);
        peer.connectionState = 'closed';
      });
  
      try {
        peer.signal(incomingSignal);
      } catch (err) {
        console.error(`[${callerId}] Error signaling peer:`, err);
        return null;
      }
  
      return peer;
    } catch (err) {
      console.error('Error adding peer:', err);
      return null;
    }
  }

  function findPeer(id) {
    return peersRef.current.find((p) => p.peerID === id);
  }

  function createUserVideo(peer, index, arr) {
    return (
      <VideoBox
        className={`width-peer${peers.length > 8 ? "" : peers.length}`}
        onClick={expandScreen}
        key={peer.peerID || index}
      >
        {writeUserName(peer.userName)}
        <FaIcon className="fas fa-expand" />
        <VideoCard 
          key={peer.peerID || index} 
          peer={peer} 
          number={arr.length}
        />
      </VideoBox>
    );
  }

  function writeUserName(userName, index) {
    if (userVideoAudio.hasOwnProperty(userName)) {
      if (!userVideoAudio[userName].video) {
        return <UserName key={userName}>{userName}</UserName>;
      }
    }
  }

  // Open Chat
  const clickChat = (e) => {
    e.stopPropagation();
    setDisplayChat(!displayChat);
  };

  // BackButton
  const goToBack = (e) => {
    e.preventDefault();
    socket.emit("BE-leave-room", { roomId, leaver: currentUser });
    sessionStorage.removeItem("user");
    navigate('/');
  };

  const toggleCameraAudio = (e) => {
    const target = e.target.getAttribute("data-switch");

    setUserVideoAudio((preList) => {
      let videoSwitch = preList["localUser"].video;
      let audioSwitch = preList["localUser"].audio;

      if (target === "video") {
        const userVideoTrack =
          userVideoRef.current.srcObject.getVideoTracks()[0];
        videoSwitch = !videoSwitch;
        userVideoTrack.enabled = videoSwitch;
      } else {
        const userAudioTrack =
          userVideoRef.current.srcObject.getAudioTracks()[0];
        audioSwitch = !audioSwitch;

        if (userAudioTrack) {
          userAudioTrack.enabled = audioSwitch;
        } else {
          userStream.current.getAudioTracks()[0].enabled = audioSwitch;
        }
      }

      return {
        ...preList,
        localUser: { video: videoSwitch, audio: audioSwitch },
      };
    });

    socket.emit("BE-toggle-camera-audio", { roomId, switchTarget: target });
  };

 
  const clickScreenSharing = () => {
    if (!screenShare) {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
        alert('Screen sharing is not supported in your browser');
        return;
      }

      navigator.mediaDevices
        .getDisplayMedia({ cursor: true })
        .then((stream) => {
          const screenTrack = stream.getTracks()[0];

          peersRef.current.forEach(({ peer }) => {
            // replaceTrack (oldTrack, newTrack, oldStream);
            peer.replaceTrack(
              peer.streams[0]
                .getTracks()
                .find((track) => track.kind === "video"),
              screenTrack,
              userStream.current
            );
          });

          // Listen click end
          screenTrack.onended = () => {
            peersRef.current.forEach(({ peer }) => {
              peer.replaceTrack(
                screenTrack,
                peer.streams[0]
                  .getTracks()
                  .find((track) => track.kind === "video"),
                userStream.current
              );
            });
            userVideoRef.current.srcObject = userStream.current;
            setScreenShare(false);
          };

          userVideoRef.current.srcObject = stream;
          screenTrackRef.current = screenTrack;
          setScreenShare(true);
        })
        .catch((err) => {
          console.error('Error sharing screen:', err);
          alert('Unable to share screen. Please check permissions.');
        });
    } else {
      screenTrackRef.current.onended();
    }
  };

  const expandScreen = (e) => {
    const elem = e.target;

    if (elem.requestFullscreen) {
      elem.requestFullscreen();
    } else if (elem.mozRequestFullScreen) {
      /* Firefox */
      elem.mozRequestFullScreen();
    } else if (elem.webkitRequestFullscreen) {
      /* Chrome, Safari & Opera */
      elem.webkitRequestFullscreen();
    } else if (elem.msRequestFullscreen) {
      /* IE/Edge */
      elem.msRequestFullscreen();
    }
  };

  const clickBackground = () => {
    if (!showVideoDevices) return;

    setShowVideoDevices(false);
  };

  const clickCameraDevice = (event) => {
    if (
      event &&
      event.target &&
      event.target.dataset &&
      event.target.dataset.value
    ) {
      const deviceId = event.target.dataset.value;
      const enabledAudio =
        userVideoRef.current.srcObject.getAudioTracks()[0].enabled;

      navigator.mediaDevices
        .getUserMedia({ video: { deviceId }, audio: enabledAudio })
        .then((stream) => {
          const newStreamTrack = stream
            .getTracks()
            .find((track) => track.kind === "video");
          const oldStreamTrack = userStream.current
            .getTracks()
            .find((track) => track.kind === "video");

          userStream.current.removeTrack(oldStreamTrack);
          userStream.current.addTrack(newStreamTrack);

          peersRef.current.forEach(({ peer }) => {
            // replaceTrack (oldTrack, newTrack, oldStream);
            peer.replaceTrack(
              oldStreamTrack,
              newStreamTrack,
              userStream.current
            );
          });
        });
    }
  };
  
  return (
    <RoomContainer onClick={clickBackground}>
      <VideoAndBarContainer>
        <VideoContainer>
          {/* Current User Video */}
          <VideoBox
            className={`width-peer${peers.length > 8 ? "" : peers.length}`}
          >
            {userVideoAudio["localUser"].video ? null : (
              <UserName>{currentUser}</UserName>
            )}
            <FaIcon className="fas fa-expand" />
            <MyVideo
              onClick={expandScreen}
              ref={userVideoRef}
              muted
              autoPlay
              playsInline    // Changed from playInline to playsInline
            ></MyVideo>
          </VideoBox>
          {/* Joined User Vidoe */}
          {peers &&
            peers.map((peer, index, arr) => createUserVideo(peer, index, arr))}
        </VideoContainer>
        <BottomBar
          clickScreenSharing={clickScreenSharing}
          clickChat={clickChat}
          clickCameraDevice={clickCameraDevice}
          goToBack={goToBack}
          toggleCameraAudio={toggleCameraAudio}
          userVideoAudio={userVideoAudio["localUser"]}
          screenShare={screenShare}
          videoDevices={videoDevices}
          showVideoDevices={showVideoDevices}
          setShowVideoDevices={setShowVideoDevices}
        />
      </VideoAndBarContainer>
      <Chat display={displayChat} roomId={roomId} />
    </RoomContainer>
  );
};

const RoomContainer = styled.div`
  display: flex;
  width: 100%;
  max-height: 100vh;
  flex-direction: row;
`;

const VideoContainer = styled.div`
  max-width: 100%;
  height: 92%;
  display: flex;
  flex-direction: row;
  justify-content: space-around;
  flex-wrap: wrap;
  align-items: center;
  padding: 15px;
  box-sizing: border-box;
  gap: 10px;
`;

const VideoAndBarContainer = styled.div`
  position: relative;
  width: 100%;
  height: 100vh;
`;

const MyVideo = styled.video``;

const VideoBox = styled.div`
  position: relative;
  display: flex;
  justify-content: center;
  align-items: center;
  > video {
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
  }

  :hover {
    > i {
      display: block;
    }
  }
`;

const UserName = styled.div`
  position: absolute;
  font-size: calc(20px + 5vmin);
  z-index: 1;
`;

const FaIcon = styled.i`
  display: none;
  position: absolute;
  right: 15px;
  top: 15px;
`;

export default Room;
