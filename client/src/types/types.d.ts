declare module 'uuid';

export interface Message {
    room: string;
    author: string;
    message: string;
    time: string;
}

export interface User {
    _id?: string; // Optional, as it may not be present when creating a new user
    name: string;
    age: number;
    email?: string;
    password?: string;
    phone?: number;
}

export interface OnlineUser {
  username: string;
  socketId: string;
}

// Opcional: para tipar mensajes privados con authorSocketId
export interface ChatMessage extends Message {
  messageId: string;
  readBy?: string[];
  authorSocketId?: string;
}