import React, { useRef, useState, useEffect } from 'react';
import styled from 'styled-components';
import socket from '../../socket';
import { useNavigate } from 'react-router-dom'; // Add this import

const Main = () => {  // Remove props parameter
  const navigate = useNavigate(); // Add this hook
  const roomRef = useRef();
  const userRef = useRef();
  const [err, setErr] = useState(false);
  const [errMsg, setErrMsg] = useState('');

 
  useEffect(() => {
    const handleUserExist = ({ error }) => {
      if (!error) {
        const roomName = roomRef.current.value;
        const userName = userRef.current.value;

        sessionStorage.setItem('user', userName);
        // Add console.log to debug
        console.log('Navigating to:', `/room/${roomName}`);
        navigate(`/room/${roomName}`);
      } else {
        setErr(true);
        setErrMsg('User name already exists');
      }
    };

    socket.on('FE-error-user-exist', handleUserExist);
    return () => socket.off('FE-error-user-exist', handleUserExist);
  }, [navigate]);


  function clickJoin() {
    const roomName = roomRef.current.value;
    const userName = userRef.current.value;

    if (!roomName || !userName) {
      setErr(true);
      setErrMsg('Enter Room Name or User Name');
    } else {
      sessionStorage.setItem('user', userName);
      socket.emit('BE-check-user', { roomId: roomName, userName });
      // Navigate immediately after emitting the socket event
      navigate(`/room/${roomName}`);
      
      // Optional: Add error handling if user exists
      socket.once('FE-error-user-exist', ({ error }) => {
        if (error) {
          setErr(true);
          setErrMsg('User name already exists');
          navigate('/'); // Navigate back to main if there's an error
        }
      });
    }
  }


  return (
    <MainContainer>
      <Row>
        <Label htmlFor="roomName">Room Name</Label>
        <Input type="text" id="roomName" ref={roomRef} />
      </Row>
      <Row>
        <Label htmlFor="userName">User Name</Label>
        <Input type="text" id="userName" ref={userRef} />
      </Row>
      <JoinButton onClick={clickJoin}> Join </JoinButton>
      {err ? <Error>{errMsg}</Error> : null}
    </MainContainer>
  );
};
const MainContainer = styled.div`
  display: flex;
  flex-direction: column;
`;

const Row = styled.div`
  display: flex;
  align-items: center;
  justify-content: flex-end;
  margin-top: 15px;
  line-height: 35px;
`;

const Label = styled.label``;

const Input = styled.input`
  width: 150px;
  height: 35px;
  margin-left: 15px;
  padding-left: 10px;
  outline: none;
  border: none;
  border-radius: 5px;
`;

const Error = styled.div`
  margin-top: 10px;
  font-size: 20px;
  color: #e85a71;
`;

const JoinButton = styled.button`
  height: 40px;
  margin-top: 35px;
  outline: none;
  border: none;
  border-radius: 15px;
  color: #d8e9ef;
  background-color: #4ea1d3;
  font-size: 25px;
  font-weight: 500;

  :hover {
    background-color: #7bb1d1;
    cursor: pointer;
  }
`;

export default Main;
