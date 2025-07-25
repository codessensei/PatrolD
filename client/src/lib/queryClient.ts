import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    try {
      // Try to parse response as JSON first
      const contentType = res.headers.get('content-type');
      
      if (contentType && contentType.includes('application/json')) {
        const errorJson = await res.json();
        // Transform to a readable format without the file paths
        const errorMessage = errorJson.message || JSON.stringify(errorJson);
        throw new Error(`${res.status}: ${errorMessage}`);
      } else {
        // Fallback to text if not JSON
        const text = (await res.text()) || res.statusText;
        // Remove any file paths or stack traces from the error message
        const cleanText = text.replace(/(?:\/[\w\d\s\-_:.]+)+\.(?:js|ts|jsx|tsx)(?::\d+:\d+)?/g, '');
        throw new Error(`${res.status}: ${cleanText}`);
      }
    } catch (parseError) {
      // If we fail to parse the response, just use the status text
      throw new Error(`${res.status}: ${res.statusText}`);
    }
  }
}

// Helper to get the base API URL, accounting for different environments
function getApiBaseUrl(): string {
  // Always use relative URLs to ensure we're hitting the same origin
  // This avoids CORS issues and makes sure cookies are sent properly
  return '';
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  // Make sure URL has the correct base
  const apiUrl = url.startsWith('http') ? url : `${getApiBaseUrl()}${url}`;
  
  // Log the request for debugging
  console.log(`API Request: ${method} ${apiUrl}`);
  
  try {
    const res = await fetch(apiUrl, {
      method,
      headers: data ? { "Content-Type": "application/json" } : {},
      body: data ? JSON.stringify(data) : undefined,
      credentials: "include", // This ensures cookies are sent with the request
    });

    // Log the response status for debugging
    console.log(`API Response: ${method} ${apiUrl} - Status: ${res.status}`);
    
    await throwIfResNotOk(res);
    return res;
  } catch (error) {
    console.error(`API Error for ${method} ${apiUrl}:`, error);
    throw error;
  }
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const url = queryKey[0] as string;
    // Make sure URL has the correct base
    const apiUrl = url.startsWith('http') ? url : `${getApiBaseUrl()}${url}`;
    
    console.log(`Query Function: GET ${apiUrl}`);
    
    try {
      const res = await fetch(apiUrl, {
        credentials: "include",
      });

      console.log(`Query Response: GET ${apiUrl} - Status: ${res.status}`);
      
      if (unauthorizedBehavior === "returnNull" && res.status === 401) {
        console.log(`Returning null for 401 response to ${apiUrl}`);
        return null;
      }

      await throwIfResNotOk(res);
      const data = await res.json();
      console.log(`Query Data for ${apiUrl}:`, data);
      return data;
    } catch (error) {
      console.error(`Query Error for ${apiUrl}:`, error);
      throw error;
    }
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
