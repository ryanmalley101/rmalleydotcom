// src/types/global.d.ts

// This uses Declaration Merging to add a custom property 
// to the existing global Window interface.
interface Window {
  amplifyConfigured?: boolean; // Use '?' to make it optional, though you will set it.
}

// Ensure this file is picked up by TypeScript. 
// If it's not working, ensure your tsconfig.json includes this folder/file.