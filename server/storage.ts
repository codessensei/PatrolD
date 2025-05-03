import { IStorage } from "./storage-types";
import { DatabaseStorage } from "./database-storage";

// Export database storage implementation for persistence
export const storage: IStorage = new DatabaseStorage();