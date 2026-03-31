import { useEffect, useRef } from "react";
import { io, Socket } from "socket.io-client";

let socket: Socket | null = null;

export function useSocket() {
  const ref = useRef<Socket | null>(null);

  if (!socket) {
    socket = io({ path: import.meta.env.VITE_SOCKET_PATH });
  }
  ref.current = socket;

  useEffect(() => {
    return () => {
      // do not disconnect on unmount — singleton
    };
  }, []);

  return ref.current;
}
