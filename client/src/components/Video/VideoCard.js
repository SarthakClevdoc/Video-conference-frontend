import React, { useEffect, useRef } from 'react';
import styled from 'styled-components';

const VideoCard = ({ peer }) => {
  const ref = useRef();

  useEffect(() => {
    if (!peer) return;

    const handleStream = (event) => {
      if (event.detail.peerId === peer.peerID && ref.current) {
        ref.current.srcObject = event.detail.stream;
      }
    };

    window.addEventListener('peerStream', handleStream);

    if (peer.remoteStream && ref.current) {
      ref.current.srcObject = peer.remoteStream;
    }

    return () => {
      window.removeEventListener('peerStream', handleStream);
      if (ref.current) {
        ref.current.srcObject = null;
      }
    };
  }, [peer]);

  return (
    <Video
      ref={ref}
      autoPlay
      playsInline
      muted={false}
    />
  );
};

const Video = styled.video`
  width: 100%;
  height: 100%;
  object-fit: cover;
`;

export default VideoCard;