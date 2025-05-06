import { createContext, ReactNode, useContext } from "react";
import {
  useQuery,
  useMutation,
  UseMutationResult,
} from "@tanstack/react-query";
import { insertUserSchema, User as SelectUser, InsertUser } from "@shared/schema";
import { getQueryFn, apiRequest, queryClient } from "../lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type AuthContextType = {
  user: SelectUser | null;
  isLoading: boolean;
  error: Error | null;
  loginMutation: UseMutationResult<SelectUser, Error, LoginData>;
  logoutMutation: UseMutationResult<void, Error, void>;
  registerMutation: UseMutationResult<SelectUser, Error, InsertUser>;
};

type LoginData = Pick<InsertUser, "username" | "password">;

export const AuthContext = createContext<AuthContextType | null>(null);
export function AuthProvider({ children }: { children: ReactNode }) {
  console.log("AuthProvider initializing");
  const { toast } = useToast();
  const {
    data: user,
    error,
    isLoading,
  } = useQuery<SelectUser | null, Error>({
    queryKey: ["/api/user"],
    queryFn: getQueryFn({ on401: "returnNull" })
  });

  const loginMutation = useMutation({
    mutationFn: async (credentials: LoginData) => {
      console.log("Login mutation called with:", { 
        username: credentials.username, 
        password: credentials.password ? "[REDACTED]" : undefined 
      });
      
      try {
        console.log("About to make login request to /api/login");
        const res = await apiRequest("POST", "/api/login", credentials);
        console.log("Login response received with status:", res.status);
        
        const userData = await res.json();
        console.log("Login successful, user data:", userData);
        return userData;
      } catch (error) {
        console.error("Login error:", error);
        // More detailed error logging
        if (error instanceof Error) {
          console.error("Error message:", error.message);
          console.error("Error stack:", error.stack);
        }
        throw error;
      }
    },
    onSuccess: (user: SelectUser) => {
      console.log("Setting user data in cache:", user);
      queryClient.setQueryData(["/api/user"], user);
      // Also invalidate the user query to force a refresh
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      
      toast({
        title: "Login successful",
        description: `Welcome back, ${user.username}!`,
      });
    },
    onError: (error: Error) => {
      console.error("Login mutation error handler:", error);
      toast({
        title: "Login failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const registerMutation = useMutation({
    mutationFn: async (credentials: InsertUser) => {
      console.log("Register mutation called with:", {
        ...credentials,
        password: credentials.password ? "[REDACTED]" : undefined
      });
      
      try {
        console.log("About to make registration request to /api/register");
        const res = await apiRequest("POST", "/api/register", credentials);
        console.log("Registration response received with status:", res.status);
        
        const userData = await res.json();
        console.log("Registration successful, user data:", userData);
        return userData;
      } catch (error) {
        console.error("Registration error:", error);
        // More detailed error logging
        if (error instanceof Error) {
          console.error("Error message:", error.message);
          console.error("Error stack:", error.stack);
        }
        throw error;
      }
    },
    onSuccess: (user: SelectUser) => {
      console.log("Setting user data in cache after registration:", user);
      queryClient.setQueryData(["/api/user"], user);
      // Also invalidate the user query to force a refresh
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      
      toast({
        title: "Registration successful",
        description: `Welcome, ${user.username}!`,
      });
    },
    onError: (error: Error) => {
      console.error("Registration mutation error handler:", error);
      toast({
        title: "Registration failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      console.log("Logout mutation called");
      try {
        await apiRequest("POST", "/api/logout");
        console.log("Logout successful");
      } catch (error) {
        console.error("Logout error:", error);
        throw error;
      }
    },
    onSuccess: () => {
      console.log("Setting user data to null after logout");
      queryClient.setQueryData(["/api/user"], null);
      // Also invalidate the user query to force a refresh
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      
      toast({
        title: "Logged out",
        description: "You have been logged out successfully.",
      });
    },
    onError: (error: Error) => {
      console.error("Logout mutation error handler:", error);
      toast({
        title: "Logout failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return (
    <AuthContext.Provider
      value={{
        user: user ?? null,
        isLoading,
        error,
        loginMutation,
        logoutMutation,
        registerMutation,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
