// src/components/Chat/Chat.tsx
import React, { useEffect, useRef, useState } from 'react';
import './Chat.css';
import { io, Socket } from 'socket.io-client';
import { useLocation } from 'react-router-dom';
import { User, OnlineUser } from '../../types/types';
import { v4 as uuidv4 } from 'uuid';

// Extiende el tipo de mensaje
interface ChatMessage {
  messageId: string;
  room: string;
  author: string;
  message: string;
  time: string;
  readBy?: string[];
  authorSocketId?: string; // para privados
}

interface Reaction {
  messageId: string;
  emoji: string;
  reactor: string;
}

const Chat: React.FC = () => {
  const location = useLocation();
  const user = location.state?.user as User;
  const [room, setRoom] = useState('sala1');
  const [currentMessage, setCurrentMessage] = useState('');
  const [messageList, setMessageList] = useState<ChatMessage[]>([]);
  const [showChat, setShowChat] = useState(false);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const [notifications, setNotifications] = useState<string[]>([]);
  const [reactions, setReactions] = useState<Reaction[]>([]);

  const socketRef = useRef<Socket | null>(null);
  const chatBodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    socketRef.current = io('http://localhost:3001', {
      auth: { token },
    });

    const socket = socketRef.current!;

    socket.on('user_joined', ({ author, users }: { author: string, users: Record<string, string> | undefined }) => {
      const safeUsers = users ?? {};
      const onlineUsersArr: OnlineUser[] = Object.entries(safeUsers).map(([username, socketId]) => ({
        username,
        socketId,
      }));
      setOnlineUsers(onlineUsersArr);
      setNotifications(prev => [
        author === user.name ? 'Tú entraste al chat' : `¡${author} se ha unido al chat!`,
        ...prev
      ]);
    });

    socket.on('user_left', ({ author, users }: { author: string, users: Record<string, string> | undefined }) => {
      const safeUsers = users ?? {};
      const onlineUsersArr: OnlineUser[] = Object.entries(safeUsers).map(([username, socketId]) => ({
        username,
        socketId,
      }));
      setOnlineUsers(onlineUsersArr);
      setNotifications(prev => [
        author === user.name ? 'Tú has abandonado el chat' : `¡${author} ha abandonado el chat!`,
        ...prev
      ]);
    });

    socket.on('receive_message', (data: ChatMessage) => {
      setMessageList(prev => [...prev, { ...data, readBy: [] }]);
      socketRef.current?.emit('message_read', {
        room,
        messageId: data.messageId,
        reader: user.name
      });
    });

    socket.on('status', (data) => {
      if (data.status === 'unauthorized') {
        window.location.href = '/';
      }
    });

    socket.on('user_typing', (author: string) => {
      setTypingUsers(prev => Array.from(new Set([...prev, author])));
    });

    socket.on('user_stop_typing', (author: string) => {
      setTypingUsers(prev => prev.filter(u => u !== author));
    });

    socket.on('update_read_receipts', ({ messageId, reader }) => {
      setMessageList(prev =>
        prev.map(msg =>
          msg.messageId === messageId
            ? {
                ...msg,
                readBy: msg.readBy ? Array.from(new Set([...msg.readBy, reader])) : [reader]
              }
            : msg
        )
      );
    });

    socket.on('update_reactions', (r: Reaction) => {
      setReactions(prev => [...prev, r]);
    });

    return () => {
      socket.off('online_users');
      socket.off('user_joined');
      socket.off('user_left');
      socket.off('receive_message');
      socket.off('user_typing');
      socket.off('user_stop_typing');
      socket.off('update_read_receipts');
      socket.off('update_reactions');
    };
  }, [room, user.name]);

  useEffect(() => {
    if (chatBodyRef.current) {
      chatBodyRef.current.scrollTop = chatBodyRef.current.scrollHeight;
    }
  }, [messageList, notifications]);

  const joinRoom = () => {
    if (room) {
      socketRef.current?.emit('join_room', { room, author: user.name });
      setShowChat(true);
    }
  };

  const sendMessage = async () => {
    if (!currentMessage) return;
    const msg: ChatMessage = {
      messageId: uuidv4(),
      room,
      author: user.name,
      message: currentMessage,
      time: new Date().toLocaleTimeString(),
      readBy: [],
    };
    socketRef.current?.emit('send_message', msg);
    setMessageList(prev => [...prev, msg]);
    setCurrentMessage('');
  };

  const sendReaction = (messageId: string, emoji: string) => {
    socketRef.current?.emit('react_message', {
      room,
      messageId,
      emoji,
      reactor: user.name
    });
  };

  return (
    <div className="chat-container">
      {!showChat ? (
        <div className="join-chat">
          <h2>Bienvenid@ al Chat {user.name}</h2>
          <input
            type="text"
            placeholder="Sala..."
            value={room}
            onChange={(e) => setRoom(e.target.value)}
          />
          <button onClick={joinRoom}>Unirse a la Sala</button>
        </div>
      ) : (
        <div className="chat-box">
          <div className="chat-header">
            Sala: {room}
          </div>
          {/* Lista de usuarios en línea */}
          <div className="online-users">
            <strong>En línea:</strong>
            {onlineUsers.length > 0
              ? onlineUsers.map(u => (
                  <span key={u.socketId} style={{ marginRight: 8 }}>
                    {u.username === user.name ? 'Tú' : u.username}
                  </span>
                ))
              : '— nadie más —'}
          </div>
          {/* Alertas flotantes */}
          <div className="notifications">
            {notifications.map((note, i) => (
              <div key={i} className="toast">{note}</div>
            ))}
          </div>
          <div className="chat-body" ref={chatBodyRef}>
            <div className="messages">
              {messageList.map((msg, idx) => (
                <div key={idx} className={`message ${msg.author === user.name ? 'own' : 'other'}`}>
                  <div className="bubble">
                    <p>{msg.message}</p>
                    <div className="meta">
                      <span>{msg.author === user.name ? 'Tú' : msg.author}</span>
                      <span>{msg.time}</span>
                      {msg.readBy && msg.readBy.length > 0 && (
                        <span className="read-receipt">✔✔</span>
                      )}
                    </div>
                    <div className="reactions">
                      {['👍', '❤️', '😂'].map(emoji => (
                        <button
                          key={emoji}
                          className="reaction-btn"
                          onClick={() => sendReaction(msg.messageId, emoji)}
                          style={{ marginRight: 2 }}
                        >
                          {emoji}
                        </button>
                      ))}
                      {reactions
                        .filter(r => r.messageId === msg.messageId)
                        .map((r, idx2) => (
                          <span key={idx2}>{r.emoji}</span>
                        ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {typingUsers.length > 0 && (
              <div className="typing-indicator">
                {typingUsers
                  .map(u => (u === user.name ? 'Tú' : u))
                  .join(', ')} {typingUsers.length === 1 ? 'está' : 'están'} escribiendo…
              </div>
            )}
          </div>
          <div className="chat-footer">
            <input
              type="text"
              placeholder="Mensaje..."
              value={currentMessage}
              onChange={(e) => {
                setCurrentMessage(e.target.value);
                socketRef.current?.emit('typing', { room, author: user.name });
              }}
              onBlur={() => {
                socketRef.current?.emit('stop_typing', { room, author: user.name });
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  socketRef.current?.emit('stop_typing', { room, author: user.name });
                  sendMessage();
                }
              }}
            />
            <button onClick={sendMessage}>Enviar</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Chat;
