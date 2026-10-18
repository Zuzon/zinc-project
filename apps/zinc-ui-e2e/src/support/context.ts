declare module 'vitest' {
  export interface ProvidedContext {
    /** web: zinc-server serving zinc-web. */
    baseUrl: string;
    /** desktop: the Electron binary and the staged app it runs. */
    electronPath: string;
    electronApp: string;
    /** ZINC_DATA_DIR seeded by {@link createSeededData}. */
    dataDir: string;
  }
}

export {};
