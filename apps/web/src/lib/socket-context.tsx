"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { io, type Socket } from "socket.io-client";
import { useAuth } from "./auth-context";
import type { ServerToClientEvents, ClientToServerEvents } from "@uchicago-marketplace/shared";

type TypedSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

const SocketContext = createContext<TypedSocket | null>(null);

const SOCKET_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

export function SocketProvider({ children }: { children: ReactNode }) {
  const { accessToken, isLoading } = useAuth();
  const [socket, setSocket] = useState<TypedSocket | null>(null);

  useEffect(() => {
    if (isLoading || !accessToken) {
      return;
    }

    const s = io(SOCKET_URL, {
      auth: { token: accessToken },
      transports: ["websocket", "polling"],
    }) as TypedSocket;

    s.on("connect", () => {
      console.log("Socket connected");
    });

    s.on("disconnect", (reason) => {
      console.log("Socket disconnected:", reason);
    });

    setSocket(s);

    return () => {
      s.disconnect();
      setSocket(null);
    };
  }, [accessToken, isLoading]);

  return (
    <SocketContext.Provider value={socket}>{children}</SocketContext.Provider>
  );
}

export function useSocket() {
  return useContext(SocketContext);
}
